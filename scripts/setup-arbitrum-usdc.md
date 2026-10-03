# Arbitrum Sepolia + USDC setup (Borneo)

Borneo settles the crypto rail with **Circle USDC on Arbitrum** via x402. Buyers sign an EIP-3009 `transferWithAuthorization`; Borneo's in-process facilitator verifies it and relays it onchain, so the merchant receives USDC directly from the buyer.

## Network

| | Testnet (default) | Mainnet |
|---|---|---|
| CAIP-2 | `eip155:421614` | `eip155:42161` |
| Chain ID | 421614 | 42161 |
| RPC | `https://sepolia-rollup.arbitrum.io/rpc` | `https://arb1.arbitrum.io/rpc` |
| Explorer | [sepolia.arbiscan.io](https://sepolia.arbiscan.io) | [arbiscan.io](https://arbiscan.io) |
| Gas | ETH | ETH |
| Stablecoin | USDC `0x75fa…AA4d` | USDC `0xaf88…5831` |
| EIP-712 domain | `USD Coin` / `2` | `USD Coin` / `2` |

## Steps

1. Create an EVM wallet for the buyer and one for the merchant (MetaMask works).
2. Add **Arbitrum Sepolia** (chain ID 421614).
3. Get test **USDC** for the buyer from the [Circle faucet](https://faucet.circle.com) (pick Arbitrum Sepolia).
4. Get a little Arbitrum Sepolia **ETH** for the wallet that relays payments (the buyer wallet, unless you set `FACILITATOR_PRIVATE_KEY`). Any Arbitrum Sepolia faucet works, or fund the same address with Sepolia ETH and bridge it in-app at `/buyer/gas` (Arbitrum SDK `EthBridger`, tracked until it lands on Arbitrum).
5. In `.env`: `CHAIN_NETWORK=eip155:421614`, `BUYER_PRIVATE_KEY=0x…`, `MERCHANT_ADDRESS=0x…`.
6. Live ETH → USDC route quotes come from Uniswap V3 on Arbitrum One. No API key needed.

## Smoke test

```bash
# Without payment → 402 + PAYMENT-REQUIRED
curl -i -X POST http://localhost:3000/s/<slug>/buy \
  -H 'content-type: application/json' \
  -d '{"skuId":"<id>","quantity":1}'
```

After authorize in `/buyer`, expect HTTP 200 + a `txHash` that opens on Arbiscan.

## Switch to mainnet

```diff
- CHAIN_NETWORK=eip155:421614
+ CHAIN_NETWORK=eip155:42161
```

Token, RPC, explorer and EIP-712 domain switch automatically. Prices are USD strings (e.g. `0.01`), converted to 6-decimal USDC atomic units.
