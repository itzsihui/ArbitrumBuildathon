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
| Onchain proof | Arbiscan link for at least one settled purchase |

## Demo video shot list (~3 min)

1. **0:00–0:20** Landing: thesis line *Intent → Route → Settle → Earn*, "any HTTP agent can pay"
2. **0:20–0:50** `/buyer`: “Deploy funds into this tokenized asset” or fashion drop intent → picks including `/s/arbitrum-rwa-desk`
3. **0:50–1:20** Consent modal: liquidity route preview (USDC balance / ETH → USDC quote from Arbitrum One)
4. **1:20–2:10** Authorize → protocol log showing 402 challenge → EIP-3009 signature → settle → open the tx on Arbiscan
5. **2:10–2:40** `/buyer/xpoints`: XPoints earned + copy invite link (`?ref=`)
6. **2:40–3:00** curl `POST /s/{slug}/buy` → 402 challenge with `eip155:421614` USDC requirements (shows any agent can integrate)

## Deploy

Set the env vars from `.env.example` on Vercel (at minimum `CHAIN_NETWORK=eip155:421614`, `BUYER_PRIVATE_KEY`, `MERCHANT_ADDRESS`, `OPENAI_API_KEY`, Firebase). Remove any old `XLAYER_*`, `OKX_*`, `TOKEN_ADDRESS`, `TOKEN_SYMBOL` and `EXPLORER_BASE` values so the Arbitrum defaults apply. Then:

```bash
vercel deploy --prod
```

Fund `BUYER_PRIVATE_KEY` with Arbitrum Sepolia USDC + a little ETH per `scripts/setup-arbitrum-usdc.md`.

## Evidence of new work (existing-project rule)

Highlight commits for:

- Arbitrum settlement: `src/lib/config.ts` chain presets + in-process x402 facilitator in `src/lib/protocol/x402.ts`
- `src/lib/liquidity/route.ts` + `/api/liquidity` (Arbitrum One route quotes)
- `src/lib/ownership.ts` (XPoints ledger) + `/buyer/xpoints`
- `arbitrum-rwa-desk` sample store
