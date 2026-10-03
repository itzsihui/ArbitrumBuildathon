// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Subset of ERC-3009 used for pull-based settlement.
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @title BorneoCheckout
/// @notice Onchain settlement for Borneo agentic-commerce orders on Arbitrum.
///
/// A buyer (human or AI agent) signs an ERC-3009 `ReceiveWithAuthorization` for the
/// exact order total with `to = address(this)`. Anyone may relay it via {settle}; the
/// contract pulls the funds, pays the merchant, routes the protocol fee to the
/// treasury and credits the buyer with XPoints, atomically, in one transaction.
///
/// The ERC-3009 nonce is not random: it MUST equal {orderNonce}, a commitment to
/// (chain, checkout, orderId, merchant, token, amount). Because the buyer's signature
/// covers the nonce, a relayer cannot redirect funds to another merchant, change the
/// order, or replay the authorization. `receiveWithAuthorization` additionally enforces
/// `msg.sender == to`, so the authorization cannot be front-run into a bare transfer.
contract BorneoCheckout is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Hard cap on the protocol fee (10%).
    uint16 public constant MAX_FEE_BPS = 1_000;
    uint16 private constant BPS_DENOMINATOR = 10_000;

    /// @dev Domain tag for order commitments; versioned so future checkouts cannot collide.
    bytes32 public constant ORDER_TYPEHASH =
        keccak256("BorneoOrder(uint256 chainId,address checkout,bytes32 orderId,address merchant,address token,uint256 amount)");

    /// @notice Buyer's ERC-3009 ReceiveWithAuthorization (to = this contract).
    struct Authorization {
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Order {
        address payer;
        address merchant;
        address token;
        uint96 paidAt;
        uint256 amount;
        uint256 fee;
    }

    address public treasury;
    uint16 public feeBps;

    mapping(address token => bool allowed) public allowedToken;
    mapping(bytes32 orderId => Order) private _orders;
    mapping(address account => uint256 points) public xpoints;

    event OrderSettled(
        bytes32 indexed orderId,
        address indexed merchant,
        address indexed payer,
        address token,
        uint256 amount,
        uint256 fee,
        uint256 points
    );
    event TokenAllowed(address indexed token, bool allowed);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address indexed treasury);

    error ZeroAddress();
    error ZeroAmount();
    error TokenNotAllowed(address token);
    error OrderAlreadySettled(bytes32 orderId);
    error InvalidMerchant(address merchant);
    error NonceMismatch(bytes32 expected, bytes32 provided);
    error FeeTooHigh(uint16 feeBps);
    error AmountNotReceived(uint256 expected, uint256 received);

    constructor(address owner_, address treasury_, uint16 feeBps_, address[] memory tokens) Ownable(owner_) {
        _setTreasury(treasury_);
        _setFee(feeBps_);
        for (uint256 i; i < tokens.length; ++i) {
            _setTokenAllowed(tokens[i], true);
        }
    }

    // ---------------------------------------------------------------------
    // Settlement
    // ---------------------------------------------------------------------

    /// @notice The ERC-3009 nonce a buyer must sign for this order.
    function orderNonce(bytes32 orderId, address merchant, address token, uint256 amount)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(ORDER_TYPEHASH, block.chainid, address(this), orderId, merchant, token, amount));
    }

    /// @notice Settle an order using the buyer's ERC-3009 ReceiveWithAuthorization.
    /// @param orderId Unique order identifier (Borneo uses keccak256 of the order UUID).
    /// @param merchant Payout address of the store.
    /// @param token Allowlisted ERC-3009 stablecoin (USDC, USDG).
    /// @param payer Buyer address that signed the authorization.
    /// @param amount Gross order total in token units.
    /// @param auth Buyer's signed ReceiveWithAuthorization; `auth.nonce` must equal {orderNonce}.
    function settle(
        bytes32 orderId,
        address merchant,
        address token,
        address payer,
        uint256 amount,
        Authorization calldata auth
    ) external nonReentrant whenNotPaused returns (uint256 fee, uint256 points) {
        if (amount == 0) revert ZeroAmount();
        if (!allowedToken[token]) revert TokenNotAllowed(token);
        if (merchant == address(0) || merchant == address(this)) revert InvalidMerchant(merchant);
        if (_orders[orderId].paidAt != 0) revert OrderAlreadySettled(orderId);

        bytes32 expected = orderNonce(orderId, merchant, token, amount);
        if (auth.nonce != expected) revert NonceMismatch(expected, auth.nonce);

        // Effects before interactions: mark the order paid and credit points.
        fee = (amount * feeBps) / BPS_DENOMINATOR;
        points = fee;
        _orders[orderId] = Order({
            payer: payer,
            merchant: merchant,
            token: token,
            paidAt: uint96(block.timestamp),
            amount: amount,
            fee: fee
        });
        xpoints[payer] += points;

        _pull(token, payer, amount, auth);

        IERC20(token).safeTransfer(merchant, amount - fee);
        if (fee != 0) IERC20(token).safeTransfer(treasury, fee);

        emit OrderSettled(orderId, merchant, payer, token, amount, fee, points);
    }

    /// @notice Read a settled order. `paidAt == 0` means unpaid.
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    function isSettled(bytes32 orderId) external view returns (bool) {
        return _orders[orderId].paidAt != 0;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        _setTokenAllowed(token, allowed);
    }

    function setFeeBps(uint16 feeBps_) external onlyOwner {
        _setFee(feeBps_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recover tokens sent to this contract by mistake. Settlement never leaves
    /// a balance behind, so this cannot touch buyer or merchant funds in flight.
    function sweep(address token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
    }

    function _pull(address token, address payer, uint256 amount, Authorization calldata auth) private {
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC3009(token).receiveWithAuthorization(
            payer, address(this), amount, auth.validAfter, auth.validBefore, auth.nonce, auth.v, auth.r, auth.s
        );
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert AmountNotReceived(amount, received);
    }

    function _setTokenAllowed(address token, bool allowed) private {
        if (token == address(0)) revert ZeroAddress();
        allowedToken[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function _setFee(uint16 feeBps_) private {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_);
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_);
    }

    function _setTreasury(address treasury_) private {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }
}
