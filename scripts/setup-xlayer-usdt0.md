# X Layer Testnet + USDT0 setup (Borneo)

Borneo settles the crypto rail with **USDT0 on X Layer** via x402 and the **OKX Payment SDK** (`@okxweb3/x402-*`).

## Network

| | Testnet (default) | Mainnet |
|---|---|---|
| CAIP-2 | `eip155:1952` | `eip155:196` |
| Chain ID | 1952 | 196 |
| RPC | `https://testrpc.xlayer.tech/terigon` | `https://rpc.xlayer.tech` |
| Explorer | [xlayer-test](https://www.okx.com/web3/explorer/xlayer-test) | [xlayer](https://www.okx.com/web3/explorer/xlayer) |
| Gas | OKB | OKB |
| Stablecoin | USDT0 `0x9e29…fb0c` | USDT0 `0x779d…3736` |

## Steps

1. Create / fund an EVM wallet (MetaMask or Agentic Wallet).
2. Add **X Layer Testnet** (chain ID 1952).
3. Claim test **OKB** (gas) and **USDT0** from the [X Layer faucet](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/about-xlayer) / OKX docs.
4. Put the buyer private key in `.env` as `BUYER_PRIVATE_KEY`.
5. Put the merchant receive address in `MERCHANT_ADDRESS`.
6. Apply for OKX API credentials at the [Onchain OS Developer Portal](https://web3.okx.com/onchain-os/dev-portal) and set `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`.

## Smoke test

```bash
# Without payment → 402 + PAYMENT-REQUIRED
curl -i -X POST http://localhost:3000/s/<slug>/buy \
  -H 'content-type: application/json' \
  -d '{"skuId":"<id>","quantity":1}'
```

After authorize in `/buyer`, expect HTTP 200 + `txHash` on the X Layer explorer.

## Switch to mainnet

```diff
- XLAYER_NETWORK=eip155:1952
+ XLAYER_NETWORK=eip155:196
```

Also update `TOKEN_ADDRESS`, `XLAYER_RPC_URL`, and `EXPLORER_BASE`. Prices are USD strings (e.g. `0.01`); the OKX SDK converts to atomic USDT0 units.
