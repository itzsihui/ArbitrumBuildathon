// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BorneoCheckout} from "../src/BorneoCheckout.sol";

/// @notice forge script script/DeployBorneoCheckout.s.sol --rpc-url arbitrum_sepolia --broadcast
/// Env: DEPLOYER_PRIVATE_KEY, optional TREASURY_ADDRESS, PROTOCOL_FEE_BPS.
contract DeployBorneoCheckout is Script {
    function run() external returns (BorneoCheckout checkout) {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        if (uint160(treasury) < 0x100) treasury = deployer;
        uint16 feeBps = uint16(vm.envOr("PROTOCOL_FEE_BPS", uint256(50)));

        address[] memory tokens = _tokens();

        vm.startBroadcast(key);
        checkout = new BorneoCheckout(deployer, treasury, feeBps, tokens);
        vm.stopBroadcast();

        console2.log("BorneoCheckout", address(checkout));
        console2.log("owner", deployer);
        console2.log("treasury", treasury);
        console2.log("feeBps", feeBps);
    }

    function _tokens() internal view returns (address[] memory tokens) {
        tokens = new address[](2);
        if (block.chainid == 421_614) {
            tokens[0] = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d; // USDC
            tokens[1] = 0xFFC95faa3d63Cde504a05B567C600B78C0b41892; // USDG
        } else if (block.chainid == 42_161) {
            tokens[0] = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // USDC
            tokens[1] = 0x004B506865409877C9fA29bfb1ebA929984B9bbC; // USDG
        } else {
            revert("unsupported chain");
        }
    }
}
