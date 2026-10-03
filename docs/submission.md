# Arbitrum Open House — Buildathon submission pack

**Buildathon:** Sep 14 – Oct 4, 2026 (online) · https://openhouse.arbitrum.io/  
**Founder House:** Oct 23 – 25, 2026 (Singapore) — apply separately  
**Fit:** agentic commerce, wallet infrastructure; Founder House "Promising Products — AI agents"

## What to submit

| Item | Notes |
|------|--------|
| Project summary | AI shopping agents that settle USDC on Arbitrum via x402: intent → route → settle → earn |
| Repository | This repo (public) + README contract table |
| Demo video | 2–4 minutes (shot list below) |
| Product link | Deployed Vercel URL |
| Onchain proof | BorneoCheckout [`0xf818…9fc4`](https://sepolia.arbiscan.io/address/0xf8188490C10d0248DBB27bD1A07F8a7b4f0e9fc4) · settled purchase [`0x6984…3545`](https://sepolia.arbiscan.io/tx/0x698479add48aa055711965108a33457357465d4e36897029f96300757fa23545) |

## How it maps to the judging criteria

| Criterion | Borneo |
|---|---|
| Deployed on an Arbitrum chain | BorneoCheckout live on Arbitrum Sepolia; app settles every x402 order through it. Same script deploys to Arbitrum One. |
| Smart contract quality | Order-bound EIP-3009 nonce (no redirect / replay / front-run), exactly-once orders, on-chain fee split + XPoints, Ownable2Step / Pausable / ReentrancyGuard / SafeERC20. 22 unit tests, 1 000-run fuzz, fork tests against real USDC + USDG. |
| Product-market fit | Agents need a way to pay merchants safely over plain HTTP; any agent can buy from any Borneo store with a single 402 round trip and no ETH for gas. |
| Innovation | x402 + a checkout contract that binds each authorization to one order, with on-chain rewards. |
| Real problem solving | Fragmented assets → Uniswap V3 route quote → stablecoin settle in one flow; merchants get paid on-chain with an auditable receipt. |
| Paxos USDG | USDG is allowlisted in the checkout, the default second settle asset, and covered by a fork test against the real Paxos contract. |

## Demo video shot list (~3 min)

1. **0:00–0:20** Landing: thesis line *Intent → Route → Settle → Earn*, "any HTTP agent can pay"
2. **0:20–0:50** `/buyer`: “Deploy funds into this tokenized asset” or fashion drop intent → picks including `/s/arbitrum-rwa-desk`
3. **0:50–1:20** Consent modal: liquidity route preview (USDC balance / ETH → USDC quote from Arbitrum One)
4. **1:20–2:10** Authorize → protocol log showing 402 challenge (payTo = BorneoCheckout, order nonce) → ReceiveWithAuthorization signature → `settle` → open the tx on Arbiscan and show the `OrderSettled` event + merchant/treasury split
5. **2:10–2:40** `/buyer/xpoints`: XPoints earned + copy invite link (`?ref=`)
6. **2:40–3:00** curl `POST /s/{slug}/buy` → 402 challenge with `eip155:421614` USDC requirements (shows any agent can integrate)

## Deploy

Set the env vars from `.env.example` on Vercel (at minimum `CHAIN_NETWORK=eip155:421614`, `BUYER_PRIVATE_KEY`, `MERCHANT_ADDRESS`, `CHECKOUT_ADDRESS`, `TREASURY_ADDRESS`, `OPENAI_API_KEY`, Firebase). Remove any old `XLAYER_*`, `OKX_*`, `TOKEN_ADDRESS`, `TOKEN_SYMBOL` and `EXPLORER_BASE` values so the Arbitrum defaults apply. Then:

```bash
vercel deploy --prod
```

Fund `BUYER_PRIVATE_KEY` with Arbitrum Sepolia USDC + a little ETH per `scripts/setup-arbitrum-usdc.md`.

## Evidence of new work (existing-project rule)

Highlight commits for:

- `contracts/` BorneoCheckout (Foundry: contract, tests, fork tests, deploy script)
- Arbitrum settlement: `src/lib/config.ts` chain presets + x402 facilitator in `src/lib/protocol/x402-evm.ts` (checkout + direct modes)
- `src/lib/liquidity/route.ts` + `/api/liquidity` (Arbitrum One route quotes)
- `src/lib/ownership.ts` (XPoints ledger) + `/buyer/xpoints`
- `arbitrum-rwa-desk` sample store
