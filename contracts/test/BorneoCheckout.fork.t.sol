// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BorneoCheckout} from "../src/BorneoCheckout.sol";

interface IERC3009Domain {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/// @dev Settles against the live USDC and USDG deployments on an Arbitrum Sepolia fork.
/// Run with: forge test --match-contract Fork --fork-url arbitrum_sepolia
contract BorneoCheckoutForkTest is Test {
    address internal constant USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address internal constant USDG = 0xFFC95faa3d63Cde504a05B567C600B78C0b41892;
    bytes32 internal constant RECEIVE_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    BorneoCheckout internal checkout;
    address internal treasury = makeAddr("treasury");
    address internal merchant = makeAddr("merchant");
    uint256 internal buyerKey = 0xA11CE;
    address internal buyer;

    function setUp() public {
        if (block.chainid != 421_614) vm.skip(true);
        buyer = vm.addr(buyerKey);
        address[] memory tokens = new address[](2);
        tokens[0] = USDC;
        tokens[1] = USDG;
        checkout = new BorneoCheckout(address(this), treasury, 50, tokens);
    }

    function _settle(address token, bytes32 orderId, uint256 amount) internal {
        bytes32 nonce = checkout.orderNonce(orderId, merchant, token, amount);
        BorneoCheckout.Authorization memory auth;
        auth.validAfter = block.timestamp - 1;
        auth.validBefore = block.timestamp + 300;
        auth.nonce = nonce;
        bytes32 structHash =
            keccak256(abi.encode(RECEIVE_TYPEHASH, buyer, address(checkout), amount, auth.validAfter, auth.validBefore, nonce));
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", IERC3009Domain(token).DOMAIN_SEPARATOR(), structHash));
        (auth.v, auth.r, auth.s) = vm.sign(buyerKey, digest);
        checkout.settle(orderId, merchant, token, buyer, amount, auth);
    }

    function _fundBuyer(address token, uint256 amount) internal {
        // Pull from a funded holder: storage layouts of FiatToken / Paxos tokens differ.
        address holder = token == USDC ? 0xf88462851DaCF8aC47f68f3F576D1f21b15410C3 : address(0);
        if (holder != address(0) && IERC20(token).balanceOf(holder) >= amount) {
            vm.prank(holder);
            IERC20(token).transfer(buyer, amount);
        } else {
            deal(token, buyer, amount);
        }
    }

    function test_fork_settleRealUsdc() public {
        uint256 amount = 20_000;
        _fundBuyer(USDC, amount);
        _settle(USDC, keccak256("fork-usdc"), amount);
        assertEq(IERC20(USDC).balanceOf(merchant) + IERC20(USDC).balanceOf(treasury), amount);
        assertEq(IERC20(USDC).balanceOf(address(checkout)), 0);
    }

    function test_fork_settleRealUsdg() public {
        uint256 amount = 20_000;
        _fundBuyer(USDG, amount);
        _settle(USDG, keccak256("fork-usdg"), amount);
        assertEq(IERC20(USDG).balanceOf(merchant) + IERC20(USDG).balanceOf(treasury), amount);
        assertEq(IERC20(USDG).balanceOf(address(checkout)), 0);
    }
}
