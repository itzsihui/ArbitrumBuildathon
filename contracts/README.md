# BorneoCheckout contracts

Foundry workspace for `BorneoCheckout`, the x402 settlement contract Borneo uses on Arbitrum. See the [root README](../README.md#smart-contract-borneocheckout) for the design.

| Network | Address |
|---|---|
| Arbitrum Sepolia | [`0xf8188490C10d0248DBB27bD1A07F8a7b4f0e9fc4`](https://sepolia.arbiscan.io/address/0xf8188490C10d0248DBB27bD1A07F8a7b4f0e9fc4) |

## Commands

```shell
forge build
forge test                                                     # unit + fuzz (mock EIP-3009 token)
forge test --match-contract Fork --fork-url https://sepolia-rollup.arbitrum.io/rpc   # real USDC + Paxos USDG

# Deploy (USDC + USDG allowlisted for the target chain)
DEPLOYER_PRIVATE_KEY=0x… TREASURY_ADDRESS=0x… PROTOCOL_FEE_BPS=50 \
  forge script script/DeployBorneoCheckout.s.sol --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast

# Verify (Blockscout, no key) or Arbiscan (ARBISCAN_API_KEY)
forge verify-contract <address> src/BorneoCheckout.sol:BorneoCheckout \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --verifier blockscout --verifier-url https://arbitrum-sepolia.blockscout.com/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address,uint16,address[])" <owner> <treasury> 50 "[<usdc>,<usdg>]")
```

Then set `CHECKOUT_ADDRESS` in the app's `.env`.
