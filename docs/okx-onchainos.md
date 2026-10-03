# OKX Onchain OS × Borneo

Borneo is an open agentic storefront protocol. For **OKX Dev Day** it settles on
**X Layer** with **USDT0** via **x402**, using the OKX Payment SDK and Onchain OS
Agentic Wallet / MCP tooling.

## Docs map

| Need | Link |
|---|---|
| What is X Layer? | [About X Layer](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/about-xlayer) |
| What is Onchain OS? | [Onchain OS](https://web3.okx.com/onchainos/dev-docs/home/what-is-onchainos) |
| Agent wallets | [Agentic Wallet](https://web3.okx.com/onchainos/dev-docs/home/agentic-wallet-overview) |
| Register A2A | [A2A guide](https://web3.okx.com/onchainos/dev-docs/okxai/how-to-become-a2a) |
| Expose A2MCP | [A2MCP guide](https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp) |
| Seller x402 SDK | [Payment SDK](https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk) |
| Test as a user | [OKX.AI user debug](https://web3.okx.com/onchainos/dev-docs/okxai/user) |
| Hackathon terms | [Builder guidelines](https://www.okx.com/learn/okx-dev-day-terms) |

## How Borneo maps

| Surface | Role |
|---|---|
| `GET /api/search` | Open discovery (any HTTP agent) |
| `GET /api/liquidity` | X Layer balance + OKX DEX route (native → USDT0) |
| `GET /s/{slug}/llms.txt` | Per-store agent discovery |
| `POST /s/{slug}/buy` | A2MCP-shaped x402 buy (402 → pay → 200) |
| `/buyer/xpoints` | Protocol fee → XPoints + invite loop |
| Visa `/checkout` | Optional scoped-card mandate rail |
| Cursor MCP `onchainos` | Wallet / market / payment tools for builders |

## Env checklist

See [`.env.example`](../.env.example) and [`scripts/setup-xlayer-usdt0.md`](../scripts/setup-xlayer-usdt0.md).
