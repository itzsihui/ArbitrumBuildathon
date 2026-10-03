# OKX Dev Day — submission pack

**Deadline:** 25 September 2026, 23:59 UTC  
**Form:** https://forms.gle/81S2gnFCzqSoeDEA7  
**Track:** Build a Market (primary)  
**Builder kit:** https://www.okx.com/en-sg/learn/okx-dev-day-builder-kit

## What to submit

| Item | Notes |
|------|--------|
| Team + track | Build a Market; Remote or Singapore as chosen |
| Project summary | Intent → route → settle → earn on X Layer |
| Repository | This repo (public) + README contract table |
| Demo video | 2–4 minutes (shot list below) |
| Product link | Deployed Vercel URL |
| Declaration | Accept hackathon T&Cs |

## Demo video shot list (~3 min)

1. **0:00–0:20** Landing: thesis line *Intent → Route → Settle → Earn*
2. **0:20–0:50** `/buyer`: “Deploy funds into this tokenized asset” or fashion drop intent → picks including `/s/xlayer-rwa-desk`
3. **0:50–1:20** Consent modal: liquidity route preview (USDT0 balance / native→USDT0 plan)
4. **1:20–2:10** Authorize → protocol log / steps showing route + x402 + explorer link
5. **2:10–2:40** `/buyer/xpoints`: XPoints earned + copy invite link (`?ref=`)
6. **2:40–3:00** Optional: curl or Network tab `POST /s/{slug}/buy` → 402 challenge

## Deploy

Live production:

- **Product URL:** https://okx-dev-day2026.vercel.app
- Project: https://vercel.com/itzsihuis-projects/okx-dev-day2026
- GitHub: `itzsihui/OKXDevDay2026` (`main`)

Set the same env vars on Vercel as `.env.example` (especially `BUYER_PRIVATE_KEY`, `OKX_*`, `OPENAI_API_KEY`, Firebase). Then:

```bash
vercel link --yes --project okx-dev-day2026
vercel deploy --prod
```

Fund `BUYER_PRIVATE_KEY` with testnet OKB + USDT0 per `scripts/setup-xlayer-usdt0.md`.

**You still need to:** shoot the 2–4 min demo video and submit https://forms.gle/81S2gnFCzqSoeDEA7 by 25 Sep 23:59 UTC.

## Evidence of new work (existing-project rule)

Highlight commits for:

- `src/lib/liquidity/route.ts` + `/api/liquidity`
- `src/lib/ownership.ts` (XPoints ledger) + `/buyer/xpoints`
- `xlayer-rwa-desk` sample store
- Narrative: `AI.md`, `PITCH.md`, landing problem section
