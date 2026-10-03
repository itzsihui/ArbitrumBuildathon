// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {BorneoCheckout} from "../src/BorneoCheckout.sol";
import {MockERC3009} from "./mocks/MockERC3009.sol";

contract BorneoCheckoutTest is Test {
    BorneoCheckout internal checkout;
    MockERC3009 internal usdc;
    MockERC3009 internal usdg;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal merchant = makeAddr("merchant");
    address internal attacker = makeAddr("attacker");
    address internal relayer = makeAddr("relayer");
    uint256 internal buyerKey = 0xB0B;
    address internal buyer;

    uint16 internal constant FEE_BPS = 50;
    bytes32 internal constant ORDER_ID = keccak256("order-1");
    uint256 internal constant AMOUNT = 20_000; // 0.02 (6 decimals)

    event OrderSettled(
        bytes32 indexed orderId,
        address indexed merchant,
        address indexed payer,
        address token,
        uint256 amount,
        uint256 fee,
        uint256 points
    );

    struct Auth {
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function setUp() public {
        vm.warp(1_750_000_000);
        buyer = vm.addr(buyerKey);
        usdc = new MockERC3009("USD Coin", "2");
        usdg = new MockERC3009("Global Dollar", "1");

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdg);
        checkout = new BorneoCheckout(owner, treasury, FEE_BPS, tokens);

        usdc.mint(buyer, 1_000_000_000);
        usdg.mint(buyer, 1_000_000_000);
    }

    function _sign(MockERC3009 token, bytes32 orderId, address merchant_, uint256 amount, bytes32 nonce)
        internal
        view
        returns (Auth memory a)
    {
        orderId;
        merchant_;
        a.validAfter = block.timestamp - 1;
        a.validBefore = block.timestamp + 300;
        a.nonce = nonce;
        bytes32 structHash = keccak256(
            abi.encode(
                token.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                buyer,
                address(checkout),
                amount,
                a.validAfter,
                a.validBefore,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (a.v, a.r, a.s) = vm.sign(buyerKey, digest);
    }

    function _signOrder(MockERC3009 token, bytes32 orderId, address merchant_, uint256 amount)
        internal
        view
        returns (Auth memory)
    {
        bytes32 nonce = checkout.orderNonce(orderId, merchant_, address(token), amount);
        return _sign(token, orderId, merchant_, amount, nonce);
    }

    function _auth(Auth memory a) internal pure returns (BorneoCheckout.Authorization memory) {
        return BorneoCheckout.Authorization(a.validAfter, a.validBefore, a.nonce, a.v, a.r, a.s);
    }

    function _settle(MockERC3009 token, bytes32 orderId, address merchant_, uint256 amount, Auth memory a)
        internal
        returns (uint256 fee, uint256 points)
    {
        return checkout.settle(
            orderId, merchant_, address(token), buyer, amount, _auth(a)
        );
    }

    // ------------------------------------------------------------------
    // Happy path
    // ------------------------------------------------------------------

    function test_settle_paysMerchantTreasuryAndCreditsPoints() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        uint256 expectedFee = (AMOUNT * FEE_BPS) / 10_000;

        vm.expectEmit(address(checkout));
        emit OrderSettled(ORDER_ID, merchant, buyer, address(usdc), AMOUNT, expectedFee, expectedFee);
        vm.prank(relayer);
        (uint256 fee, uint256 points) = _settle(usdc, ORDER_ID, merchant, AMOUNT, a);

        assertEq(fee, expectedFee);
        assertEq(points, expectedFee);
        assertEq(usdc.balanceOf(merchant), AMOUNT - expectedFee);
        assertEq(usdc.balanceOf(treasury), expectedFee);
        assertEq(usdc.balanceOf(address(checkout)), 0);
        assertEq(checkout.xpoints(buyer), expectedFee);
        assertTrue(checkout.isSettled(ORDER_ID));

        BorneoCheckout.Order memory o = checkout.getOrder(ORDER_ID);
        assertEq(o.payer, buyer);
        assertEq(o.merchant, merchant);
        assertEq(o.token, address(usdc));
        assertEq(o.amount, AMOUNT);
        assertEq(o.fee, expectedFee);
        assertEq(o.paidAt, block.timestamp);
    }

    function test_settle_worksWithUsdg() public {
        Auth memory a = _signOrder(usdg, ORDER_ID, merchant, AMOUNT);
        _settle(usdg, ORDER_ID, merchant, AMOUNT, a);
        assertEq(usdg.balanceOf(merchant) + usdg.balanceOf(treasury), AMOUNT);
    }

    function test_settle_zeroFeeSkipsTreasury() public {
        vm.prank(owner);
        checkout.setFeeBps(0);
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        (uint256 fee,) = _settle(usdc, ORDER_ID, merchant, AMOUNT, a);
        assertEq(fee, 0);
        assertEq(usdc.balanceOf(merchant), AMOUNT);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    // ------------------------------------------------------------------
    // Attacks
    // ------------------------------------------------------------------

    function test_revert_relayerRedirectsToOtherMerchant() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        bytes32 expected = checkout.orderNonce(ORDER_ID, attacker, address(usdc), AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(BorneoCheckout.NonceMismatch.selector, expected, a.nonce));
        vm.prank(attacker);
        checkout.settle(ORDER_ID, attacker, address(usdc), buyer, AMOUNT, _auth(a));
    }

    function test_revert_relayerRecomputesNonceForOtherMerchant() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        bytes32 forged = checkout.orderNonce(ORDER_ID, attacker, address(usdc), AMOUNT);
        vm.expectRevert(MockERC3009.InvalidSignature.selector);
        a.nonce = forged;
        checkout.settle(ORDER_ID, attacker, address(usdc), buyer, AMOUNT, _auth(a));
    }

    function test_revert_relayerChangesAmount() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        bytes32 expected = checkout.orderNonce(ORDER_ID, merchant, address(usdc), AMOUNT + 1);
        vm.expectRevert(abi.encodeWithSelector(BorneoCheckout.NonceMismatch.selector, expected, a.nonce));
        _settle(usdc, ORDER_ID, merchant, AMOUNT + 1, a);
    }

    function test_revert_relayerSwapsToken() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        bytes32 expected = checkout.orderNonce(ORDER_ID, merchant, address(usdg), AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(BorneoCheckout.NonceMismatch.selector, expected, a.nonce));
        _settle(usdg, ORDER_ID, merchant, AMOUNT, a);
    }

    function test_revert_randomNonceNotBoundToOrder() public {
        Auth memory a = _sign(usdc, ORDER_ID, merchant, AMOUNT, keccak256("random"));
        vm.expectRevert();
        _settle(usdc, ORDER_ID, merchant, AMOUNT, a);
    }

    function test_revert_doubleSettle() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        _settle(usdc, ORDER_ID, merchant, AMOUNT, a);
        vm.expectRevert(abi.encodeWithSelector(BorneoCheckout.OrderAlreadySettled.selector, ORDER_ID));
        _settle(usdc, ORDER_ID, merchant, AMOUNT, a);
    }

    function test_revert_frontRunDirectReceive() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        vm.prank(attacker);
        vm.expectRevert(MockERC3009.CallerMustBePayee.selector);
        usdc.receiveWithAuthorization(buyer, address(checkout), AMOUNT, a.validAfter, a.validBefore, a.nonce, a.v, a.r, a.s);
    }

    function test_revert_expiredAuthorization() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        vm.warp(a.validBefore);
        vm.expectRevert(MockERC3009.AuthorizationExpired.selector);
        _settle(usdc, ORDER_ID, merchant, AMOUNT, a);
    }

    function test_revert_wrongPayerClaimed() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        vm.expectRevert(MockERC3009.InvalidSignature.selector);
        checkout.settle(ORDER_ID, merchant, address(usdc), attacker, AMOUNT, _auth(a));
    }

    function test_revert_tokenNotAllowed() public {
        MockERC3009 rogue = new MockERC3009("Rogue", "1");
        Auth memory a = _signOrder(rogue, ORDER_ID, merchant, AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(BorneoCheckout.TokenNotAllowed.selector, address(rogue)));
        _settle(rogue, ORDER_ID, merchant, AMOUNT, a);
    }

    function test_revert_invalidMerchant() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, address(checkout), AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(BorneoCheckout.InvalidMerchant.selector, address(checkout)));
        _settle(usdc, ORDER_ID, address(checkout), AMOUNT, a);
    }

    function test_revert_zeroAmount() public {
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, 0);
        vm.expectRevert(BorneoCheckout.ZeroAmount.selector);
        _settle(usdc, ORDER_ID, merchant, 0, a);
    }

    function test_revert_whenPaused() public {
        vm.prank(owner);
        checkout.pause();
        Auth memory a = _signOrder(usdc, ORDER_ID, merchant, AMOUNT);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        _settle(usdc, ORDER_ID, merchant, AMOUNT, a);
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function test_admin_onlyOwner() public {
        vm.startPrank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        checkout.setFeeBps(10);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        checkout.setTreasury(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        checkout.setTokenAllowed(attacker, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        checkout.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        checkout.sweep(address(usdc), attacker);
        vm.stopPrank();
    }

    function test_admin_feeCap() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BorneoCheckout.FeeTooHigh.selector, uint16(1_001)));
        checkout.setFeeBps(1_001);
    }

    function test_admin_twoStepOwnership() public {
        address next = makeAddr("next");
        vm.prank(owner);
        checkout.transferOwnership(next);
        assertEq(checkout.owner(), owner);
        vm.prank(next);
        checkout.acceptOwnership();
        assertEq(checkout.owner(), next);
    }

    function test_admin_sweepRecoversStrayTokens() public {
        usdc.mint(address(checkout), 5);
        vm.prank(owner);
        checkout.sweep(address(usdc), treasury);
        assertEq(usdc.balanceOf(treasury), 5);
    }

    function test_constructor_rejectsZeroTreasury() public {
        address[] memory tokens = new address[](0);
        vm.expectRevert(BorneoCheckout.ZeroAddress.selector);
        new BorneoCheckout(owner, address(0), FEE_BPS, tokens);
    }

    // ------------------------------------------------------------------
    // Fuzz
    // ------------------------------------------------------------------

    function testFuzz_settle_conservesValue(uint256 amount, uint16 feeBps, bytes32 orderId) public {
        amount = bound(amount, 1, 1_000_000_000);
        feeBps = uint16(bound(feeBps, 0, checkout.MAX_FEE_BPS()));
        vm.prank(owner);
        checkout.setFeeBps(feeBps);

        Auth memory a = _signOrder(usdc, orderId, merchant, amount);
        (uint256 fee,) = _settle(usdc, orderId, merchant, amount, a);

        assertEq(usdc.balanceOf(merchant) + usdc.balanceOf(treasury), amount);
        assertEq(fee, (amount * feeBps) / 10_000);
        assertEq(usdc.balanceOf(address(checkout)), 0);
    }
}
