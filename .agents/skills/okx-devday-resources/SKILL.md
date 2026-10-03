---
name: okx-devday-resources
description: >
  Load OKX Dev Day / Onchain OS context for Borneo: X Layer, Agentic Wallet,
  A2A, A2MCP, Payment SDK (x402 USDT0), and builder guidelines. TRIGGER when
  working on OKX payments, X Layer, x402, A2MCP, Agentic Wallet, or OKX Dev Day.
license: MIT
metadata:
  hackathon: okx-dev-day
  chain: x-layer
  version: "1.0"
---

# OKX Dev Day Resources

Use these as the canonical docs for Borneo on OKX Onchain OS.
Prefer them over any legacy chain material in the repo.

## Core platform

| Topic | URL |
|---|---|
| X Layer (about) | https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/about-xlayer |
| Onchain OS | https://web3.okx.com/onchainos/dev-docs/home/what-is-onchainos |
| Agentic Wallet | https://web3.okx.com/onchainos/dev-docs/home/agentic-wallet-overview |

## Agents & payments

| Topic | URL |
|---|---|
| A2A services | https://web3.okx.com/onchainos/dev-docs/okxai/how-to-become-a2a |
| A2MCP | https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp |
| Payment SDK (seller) | https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk |
| Debug as a user | https://web3.okx.com/onchainos/dev-docs/okxai/user |
| Builder guidelines | https://www.okx.com/learn/okx-dev-day-terms |

## Install Onchain OS skills + MCP

```bash
npx skills add okx/onchainos-skills --yes
# or full installer:
npx -y @okxweb3/onchainos-installer install
```

Cursor MCP (see `.cursor/mcp.json`):

```bash
# Requires onchainos CLI on PATH after installer
onchainos mcp
```

Relevant skills from the pack: `okx-agentic-wallet`, `okx-agent-payments-protocol`,
`okx-ai`, `okx-guide`.

## Borneo settlement defaults

- Network: X Layer Testnet `eip155:1952` (mainnet `eip155:196`)
- Asset: USDT0 via x402 `exact`
- Seller path: `POST /s/{slug}/buy` → HTTP 402 `PAYMENT-REQUIRED` → replay with `PAYMENT-SIGNATURE`
- Facilitator: `OKXFacilitatorClient` (`OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE`)
- Buyer demo key: `BUYER_PRIVATE_KEY`

See `scripts/setup-xlayer-usdt0.md` and `docs/okx-onchainos.md`.
