// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAtomicSwap.sol";
import "./lzApp/NonblockingLzAppUpgradeable.sol";
import "hardhat/console.sol";
import "./interfaces/ISideLzAppUpgradable.sol";

contract AtomicSwap is
    OwnableUpgradeable,
    IAtomicSwap,
    ReentrancyGuardUpgradeable
{
    ISideLzAppUpgradable public bridge;

    mapping(bytes32 => AtomicSwapID) public swapOrderID;
    mapping(bytes32 => AtomicSwapStatus) public swapOrderStatus;
    mapping(bytes32 => AtomicSwapOperators) public swapOrderOperators;
    mapping(bytes32 => Coin) public swapOrderSellToken;
    mapping(bytes32 => Coin) public swapOrderBuyToken;

    // Bid
    // Primary mapping using BidKey (order + bidder)
    mapping(bytes32 => mapping(address => Bid)) public bids;

    uint256 swapOrderCounter;
    uint16 chainID;

    modifier onlyExist(bytes32 id) {
        if (swapOrderID[id].id == bytes32(0x0)) {
            revert NonExistPool();
        }
        _;
    }

    function initialize(
        address admin,
        uint16 _chainID,
        address _bridge
    )
        external
        //address _endpoint
        initializer
    {
        __Ownable_init_unchained();
        transferOwnership(admin);
        bridge = ISideLzAppUpgradable(_bridge);
        chainID = _chainID;
    }

    /**
     * @notice Creates a new swap order in the contract.
     * @param makeswap Struct containing the details of the swap order to be created.
     */
    function makeSwap(
        MakeSwapMsg calldata makeswap // This function is accessible externally // This function can receive Ether // This function can be overridden in derived contracts
    ) external payable virtual {
        // Validation: Ensure the sell token and buy token are not the same non-zero address.
        if (
            makeswap.sellToken.token != address(0) &&
            makeswap.sellToken.token == makeswap.buyToken.token
        ) {
            revert InvalidTokenPair(); // Revert the transaction with a reason.
        }

        // Validation: Ensure the caller is the maker of the swap order.
        if (makeswap.makerSender != msg.sender) {
            revert NotOwnerOfToken(); // Revert the transaction with a reason.
        }

        // Initialize a variable to hold any Ether sent with the transaction.
        uint nativeFee = msg.value;

        // Lock the sell token amount in the contract.
        if (makeswap.sellToken.token == address(0)) {
            // If the sell token is Ether,
            // Ensure sufficient Ether was sent with the transaction.
            require(msg.value > makeswap.sellToken.amount, "Not enough ether");
            // Update the native fee to exclude the sell token amount.
            nativeFee = nativeFee - makeswap.sellToken.amount;
        } else {
            // If the sell token is an ERC20 token,
            // Instantiate an IERC20 interface for the sell token.
            IERC20 sellToken = IERC20(makeswap.sellToken.token);
            // Ensure the caller has approved the contract to transfer the sell token amount.
            if (
                sellToken.allowance(msg.sender, address(this)) <
                makeswap.sellToken.amount
            ) {
                revert NotAllowedAmount(); // Revert the transaction with a reason.
            }
            // Transfer the sell token amount from the caller to the contract.
            require(
                sellToken.transferFrom(
                    msg.sender,
                    address(this),
                    makeswap.sellToken.amount
                ),
                "Failed in Lock token"
            );
        }

        // Generate a unique ID for the new swap order.
        bytes32 id = _generateNewAtomicSwapID(msg.sender, makeswap.dstChainID);
        // Add the new swap order to the contract's state.
        _addNewSwapOrder(id, msg.sender, makeswap, Side.NATIVE, 0x0);

        // If the swap order is of type INTERCHAIN, send a creation message to the other chain.
        if (makeswap.poolType == PoolType.INTERCHAIN) {
            // Prepare the payload for the interchain message.
            bytes memory payload = abi.encode(
                0,
                MsgType.MAKESWAP,
                id,
                makeswap
            );
            // Send the interchain creation message.
            bridge.sendLzMsg{value: nativeFee}(
                chainID,
                payable(msg.sender),
                payload
            );
        }

        // Emit an event to notify that a new swap order has been created.
        emit AtomicSwapOrderCreated(id);
    }

    /**
     * @notice This function allows a taker to complete a swap order by exchanging tokens.
     * @param takeswap A struct containing the ID of the swap order to be taken.
     */
    function takeSwap(
        TakeSwapMsg calldata takeswap // Allows this function to receive Ether // Allows this function to be overridden in derived contracts
    )
        external
        payable
        virtual
        nonReentrant // Prevents reentrancy attacks
        onlyExist(takeswap.orderID) // Ensures the swap order exists
    {
        // Retrieve the operators and status of the swap order
        AtomicSwapOperators storage _operators = swapOrderOperators[
            takeswap.orderID
        ];
        AtomicSwapStatus storage _orderStatus = swapOrderStatus[
            takeswap.orderID
        ];

        // Ensure the caller is the designated taker of the swap order
        require(_operators.taker == msg.sender, "NoPermissionToTake");

        // Ensure the swap order has not already been completed
        require(_orderStatus.status != Status.COMPLETE, "AlreadyCompleted");

        // Retrieve the buy token details of the swap order
        Coin storage _buyToken = swapOrderBuyToken[takeswap.orderID];

        // Initialize a variable to hold any native fee (Ether) sent with the transaction
        uint nativeFee = msg.value;

        // Handle the token exchange
        if (_buyToken.token == address(0)) {
            // If the buy token is Ether, ensure sufficient Ether was sent with the transaction
            require(msg.value > _buyToken.amount, "Not enough funds to buy");

            // Transfer the buy token amount to the maker's receiver address
            payable(_operators.makerReceiver).transfer(_buyToken.amount);

            // Update the native fee to exclude the buy token amount
            nativeFee = msg.value - _buyToken.amount;
        } else {
            // If the buy token is an ERC20 token, transfer the buy token amount from the taker to the maker's receiver address
            IERC20 _token = IERC20(_buyToken.token);
            require(
                _token.transferFrom(
                    msg.sender,
                    _operators.makerReceiver,
                    _buyToken.amount
                ),
                "Failed in token transfer"
            );
        }

        // If the swap order is of type INTERCHAIN, send a completion message to the other chain
        if (swapOrderID[takeswap.orderID].poolType == PoolType.INTERCHAIN) {
            // Prepare the payload for the interchain message
            bytes memory payload = abi.encode(0, MsgType.TAKESWAP, takeswap);

            // Send the interchain completion message
            bridge.sendLzMsg{value: nativeFee}(
                chainID,
                payable(msg.sender),
                payload
            );
        }

        // Update the status of the swap order to 'COMPLETE' and record the completion timestamp
        _orderStatus.status = Status.COMPLETE;
        _orderStatus.completedAt = block.timestamp;

        // Emit an event to notify that the swap order has been taken
        emit AtomicSwapOrderTook(
            _operators.maker,
            _operators.taker,
            takeswap.orderID
        );
    }

    /**
     * @notice This function allows the maker of a swap order to cancel it.
     * @dev The function documentation mentions an upcoming update with EIP 1193 to improve user readability regarding transaction messages.
     * @param cancelswap A struct containing the ID of the swap order to be canceled.
     */
    function cancelSwap(
        CancelSwapMsg calldata cancelswap // Allows this function to receive Ether // Allows this function to be overridden in derived contracts
    )
        external
        payable
        virtual
        nonReentrant // Prevents reentrancy attacks
        onlyExist(cancelswap.orderID) // Ensures the swap order exists
    {
        // Extract the order ID from the input parameter
        bytes32 id = cancelswap.orderID;

        // Retrieve the operators of the swap order
        AtomicSwapOperators memory _operators = swapOrderOperators[id];

        // Ensure the caller is the maker of the swap order
        if (_operators.maker != msg.sender) {
            revert NoPermissionToCancel();
        }

        // Update the status of the swap order to 'CANCEL'
        swapOrderStatus[id].status = Status.CANCEL;

        // Unlock the tokens by transferring them back to the maker
        address sellTokenAddress = swapOrderSellToken[id].token;
        uint256 amount = swapOrderBuyToken[id].amount;
        if (sellTokenAddress == address(0)) {
            // If the sell token is Ether, transfer Ether back to the maker
            payable(msg.sender).transfer(amount);
        } else {
            // If the sell token is an ERC20 token, transfer the token back to the maker
            IERC20 sellToken = IERC20(sellTokenAddress);
            sellToken.transfer(msg.sender, amount);
        }

        PoolType poolType = swapOrderID[id].poolType;
        // Remove the swap order from storage
        _removeAtomicSwapOrder(id);

        // If the swap order is of type INTERCHAIN, send a cancellation message to the other chain
        if (poolType == PoolType.INTERCHAIN) {
            // Prepare the payload for the interchain message
            bytes memory payload = abi.encode(0, MsgType.CANCELSWAP, id);

            // Send the interchain cancellation message
            bridge.sendLzMsg{value: msg.value}(
                chainID,
                payable(msg.sender),
                payload
            );
        }

        // Emit an event to notify that the swap order has been canceled
        emit AtomicSwapOrderCanceled(id);
    }

    function onReceivePacket(
        uint16 _srcChainID,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) public virtual override {
        MsgType msgType = abi.decode(_payload[:32], (MsgType));
        if (msgType == MsgType.MAKESWAP) {
            bytes32 id = bytes32(_payload[32:64]);
            MakeSwapMsg memory makeswap = abi.decode(
                _payload[64:],
                (MakeSwapMsg)
            );
            _addNewSwapOrder(
                id,
                bytesToAddress(_srcAddress),
                makeswap,
                Side.REMOTE,
                _srcChainID
            );
        } else if (msgType == MsgType.TAKESWAP) {
            TakeSwapMsg memory takeswap = abi.decode(
                _payload[32:],
                (TakeSwapMsg)
            );
            swapOrderStatus[takeswap.orderID].status = Status.COMPLETE;
        } else if (msgType == MsgType.CANCELSWAP) {
            bytes32 id = bytes32(_payload[32:]);
            _removeAtomicSwapOrder(id);
        } else if (msgType == MsgType.PLACEBID) {
            PlaceBidMsg memory _bidMsg = abi.decode(
                _payload[32:],
                (PlaceBidMsg)
            );
            _addNewBid(_bidMsg);
        } else if (msgType == MsgType.ACCEPTBID) {
            AcceptBidMsg memory _acceptBidMsg = abi.decode(
                _payload[32:],
                (AcceptBidMsg)
            );
            bytes32 _orderID = _acceptBidMsg.orderID;
            address _bidder = _acceptBidMsg.bidder;

            Bid storage _bid = bids[_orderID][_bidder];
            Coin storage _buyToken = swapOrderBuyToken[_orderID];
            address _makerReceiver = swapOrderOperators[_orderID].makerReceiver;
            if (_buyToken.token != address(0)) {
                _safeTransfer(_buyToken.token, _makerReceiver, _bid.amount);
            } else {
                payable(_makerReceiver).transfer(_bid.amount);
            }
            bids[_orderID][_bidder].status = BidStatus.Executed;
        }
    }

    // Generate AtomicOrder ID
    function _generateNewAtomicSwapID(
        address sender,
        uint16 dstChainID
    ) internal returns (bytes32 id) {
        id = keccak256(
            abi.encode(chainID, dstChainID, sender, swapOrderCounter)
        );
        swapOrderCounter++;
    }

    // Refactored functions
    function _addNewSwapOrder(
        bytes32 id,
        address sender,
        MakeSwapMsg memory makeswap,
        Side side,
        uint16 _srcChainID
    ) private {
        if (swapOrderID[id].id != bytes32(0x0)) {
            revert AlreadyExistPool();
        }
        AtomicSwapID memory _orderID = AtomicSwapID(
            id,
            chainID,
            makeswap.dstChainID,
            makeswap.poolType
        );

        AtomicSwapOperators memory _operators = AtomicSwapOperators(
            makeswap.makerSender,
            makeswap.desiredTaker,
            makeswap.makerReceiver,
            makeswap.desiredTaker
        );

        AtomicSwapStatus memory _orderStatus = AtomicSwapStatus(
            side,
            Status.INITIAL,
            block.timestamp,
            0,
            0
        );

        if (side == Side.REMOTE) {
            _orderID.srcChainID = chainID;
            _orderID.dstChainID = _srcChainID;
            swapOrderOperators[id].taker = _operators.taker;
            swapOrderOperators[id].makerReceiver = _operators.makerReceiver;
        } else {
            swapOrderOperators[id] = _operators;
            swapOrderSellToken[id] = makeswap.sellToken;
            swapOrderStatus[id] = _orderStatus;
        }

        swapOrderID[id] = _orderID;
        swapOrderBuyToken[id] = makeswap.buyToken;
        emit AtomicSwapOrderCreated(id);
    }

    function _removeAtomicSwapOrder(bytes32 id) internal {
        delete (swapOrderID[id]);
    }

    function bytesToAddress(
        bytes memory bys
    ) private pure returns (address addr) {
        assembly {
            addr := mload(add(bys, 20))
        }
    }

    /**
     * @notice This function allows a user to place a bid on a specific order.
     * @dev This function is designed to be called only on the taker chain.
     * @param placeBidMsg A struct containing details of the bid being placed.
     */
    function placeBid(
        PlaceBidMsg calldata placeBidMsg // Allows this function to receive Ether
    )
        external
        payable
        nonReentrant // Prevents reentrancy attacks
        onlyExist(placeBidMsg.orderID) // Ensures the order exists
    {
        // Ensure the caller is the bidder
        if (placeBidMsg.bidder != msg.sender) {
            revert InvalidBidder(msg.sender, placeBidMsg.bidder);
        }

        // Extract order ID and bid amount from the message
        bytes32 _orderID = placeBidMsg.orderID;
        uint256 _bidAmount = placeBidMsg.bidAmount;

        // Retrieve the buy token details and pool type associated with the order
        Coin storage _buyToken = swapOrderBuyToken[_orderID];
        PoolType _poolType = swapOrderID[_orderID].poolType;

        // Retrieve the current bid (if any) for this order by this bidder
        Bid storage _bid = bids[_orderID][msg.sender];

        // Ensure the new bid amount is greater than or equal to the current bid amount
        if (_bidAmount < _bid.amount) {
            revert InvalidBidAmount();
        }

        // Calculate the required buy token amount and the additional token amount being bid
        uint256 buyTokenAmount = swapOrderBuyToken[_orderID].amount;
        uint256 tokenAmount = _bidAmount - _bid.amount;

        // Handle ERC20 token or Ether bids
        if (_buyToken.token != address(0)) {
            // Ensure the bidder has sufficient funds for the bid
            require(_bidAmount >= buyTokenAmount, "Not enough fund to bid");

            // Transfer the additional bid amount from the bidder to this contract
            _safeTransferFrom(
                _buyToken.token,
                msg.sender,
                address(this),
                tokenAmount
            );
        } else {
            // Ensure the bidder has sent sufficient Ether for the bid
            require(msg.value >= buyTokenAmount, "Not enough fund to bid");
        }

        // Record the new bid
        _addNewBid(placeBidMsg);

        // If this is an interchain order, prepare and send the bid message to the maker chain
        if (_poolType == PoolType.INTERCHAIN) {
            // Encode the bid message into a payload
            bytes memory payload = abi.encode(0, MsgType.PLACEBID, placeBidMsg);

            // Send the interchain message with the necessary payload
            bridge.sendLzMsg{value: msg.value - tokenAmount}(
                chainID,
                payable(msg.sender),
                payload
            );
        }
    }

    /**
     * @notice This function allows the maker of an order to accept a specific bid.
     * @param _orderID The ID of the order for which a bid is being accepted.
     * @param _bidder The address of the bidder whose bid is being accepted.
     */
    function acceptBid(
        bytes32 _orderID,
        address _bidder
    )
        external
        payable
        nonReentrant // Prevents reentrancy attacks
        onlyExist(_orderID) // Ensures the order exists
    {
        // Retrieve the addresses of the maker and receivers from storage
        address _maker = swapOrderOperators[_orderID].maker;
        address _makerReceiver = swapOrderOperators[_orderID].makerReceiver;
        address _bidderReceiver = bids[_orderID][_bidder].bidderReceiver;

        // Ensure that the caller is the maker of the order
        if (_maker != msg.sender) {
            revert NoPermissionToAccept();
        }

        // Retrieve the selected bid from storage
        Bid storage selectedBid = bids[_orderID][_bidder];

        // Ensure that the bid belongs to the specified bidder
        if (selectedBid.bidder != _bidder) {
            revert WrongBidder();
        }

        // Ensure that the bid is in the 'Placed' status
        if (selectedBid.status != BidStatus.Placed) {
            revert NoPlaceStatusOfBid(selectedBid.status);
        }

        // Update the bid status to 'Executed'
        selectedBid.status = BidStatus.Executed;

        // Retrieve the sell and buy tokens details from storage
        Coin storage _sellToken = swapOrderSellToken[_orderID];
        Coin storage _buyToken = swapOrderBuyToken[_orderID];

        // Exchange tokens: Transfer sell tokens to the bidder receiver
        if (_sellToken.token != address(0)) {
            _safeTransfer(_sellToken.token, _bidderReceiver, _sellToken.amount); // ERC20 transfer
        } else {
            payable(_bidderReceiver).transfer(_sellToken.amount); // Ether transfer
        }

        // Check the pool type to handle interchain or local transfers
        PoolType _poolType = swapOrderID[_orderID].poolType;
        if (_poolType == PoolType.INTERCHAIN) {
            // Prepare the message for interchain transfer
            AcceptBidMsg memory acceptBidMsg = AcceptBidMsg(_orderID, _bidder);
            bytes memory payload = abi.encode(
                0,
                MsgType.ACCEPTBID,
                acceptBidMsg
            );
            // Send the interchain message with the necessary payload
            bridge.sendLzMsg{value: msg.value}(
                chainID,
                payable(msg.sender),
                payload
            );
        } else {
            // Local transfer: Transfer buy tokens to the maker receiver
            if (_buyToken.token != address(0)) {
                _safeTransfer(
                    _buyToken.token,
                    _makerReceiver,
                    selectedBid.amount
                ); // ERC20 transfer
            } else {
                payable(_makerReceiver).transfer(selectedBid.amount); // Ether transfer
            }
        }
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        IERC20 _token = IERC20(token);
        if (_token.allowance(msg.sender, address(this)) < amount) {
            revert NotAllowedAmount();
        }
        require(
            _token.transferFrom(from, to, amount),
            "Failed to transfer from"
        );
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        IERC20 _token = IERC20(token);
        require(_token.transfer(to, amount), "Failed to transfer from");
    }

    function _addNewBid(PlaceBidMsg memory bidMsg) internal {
        // Populate the primary bids mapping
        Bid memory newBid = Bid({
            amount: bidMsg.bidAmount,
            order: bidMsg.orderID,
            status: BidStatus.Placed,
            bidder: bidMsg.bidder,
            bidderReceiver: bidMsg.bidderReceiver,
            receiveTimestamp: block.timestamp,
            expireTimestamp: bidMsg.expireTimestamp
        });
        bids[bidMsg.orderID][bidMsg.bidder] = newBid;
    }
}
