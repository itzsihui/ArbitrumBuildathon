# Borneo × OKX Dev Day

Source of truth for this prototype. Landing copy, demo script, and product decisions should map here.

**Design read:** cinematic product landing for OKX Dev Day judges — intent-native commerce on X Layer / Onchain OS (Syne + IBM Plex, jade / ember / ink).

**Dials:** `DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 5` · `VISUAL_DENSITY: 4`

**Primary track:** Build a Market

---

## Problem

Users hold fragmented assets. Buying merch, tokenized RWAs, or micro-payments usually means manual swaps, gas friction, and separate rails. Agent commerce catalogs are also walled — merchants listing only inside a few chat apps are invisible to the long tail of agents.

**Challenge framing:** An AI shopping agent bridges natural-language intent to **X Layer liquidity routing** and **USDT0 x402 settlement** via OKX Onchain OS, then shares protocol upside back as **XPoints** so users switch for seamless conversion *and* earn rewards.

---

## Expected submissions (map 1:1)

| Pillar | What we ship | Live surface |
|---|---|---|
| **AI Agent Layer** | Intent buyer agent — clarify, search, compare, hand off to pay | `/buyer` |
| **Liquidity routing** | Balance check + OKX DEX quote/execute (native → USDT0) before settle | Consent modal + `/api/liquidity` |
| **Merchant access** | Chat onboard → published agent storefront (+ RWA desk SKUs) | `/onboard`, `/market` |
| **Seamless payment** | USDT0 x402 on X Layer (OKX facilitator) + optional Visa rail | `/buyer` checkout |
| **XPoints flywheel** | Protocol fee bps → XPoints + invite boost | `/buyer/xpoints` |
| **Trust / consent** | Preview + authorize; locked quote; catalog cannot change payee/amount | Consent modal |

Do not claim voice unless we ship it. Vertical: fashion + tokenized/RWA demo listings.

---

## Demo path (judges)

1. `/` landing: fragmented balances → intent → route → settle → earn
2. `/buyer`: **"Weekend outfit"** (or "Buy this drop" / RWA) → multi-store picks
3. Consent / cart: **liquidity map** — mixed `quoteCurrency` (WETH/OKB display) → USDT0 settle (hackathon-safe); optional `ALT_SETTLE_TOKEN` for full multi-asset
4. Authorize → x402 settle per store → explorer receipt → XPoints earned
5. Optional: `POST /s/{slug}/buy` 402 challenge + `/buyer/xpoints` invite loop

Fail-soft: missing `BUYER_PRIVATE_KEY` still shows the 402 challenge. Missing DEX liquidity shows a **plan** route and settles when USDT0 is funded.

Outfit demo stores: `/s/atelier-tee`, `/s/harbor-caps`, `/s/stride-kicks`.

---

## Architecture (short)

- **Buyer agent:** `/buyer`, `/api/buyer-chat` — discovers via `/llms.txt` + registry
- **Liquidity:** `/api/liquidity` + `src/lib/liquidity/route.ts` — OKX DEX aggregator
- **Crypto rail:** HTTP 402 → USDT0 on X Layer → OKX facilitator settle
- **XPoints:** app-layer fee rewards (merchant still receives full listed USDT0)
- **Builder tooling:** Onchain OS skills + Cursor MCP (`onchainos mcp`)

```mermaid
sequenceDiagram
  participant User
  participant Agent as BuyerAgent
  participant Route as LiquidityRouter
  participant Buy as POSTbuy_x402
  participant OKX as OKXFacilitator
  participant XL as XLayer
  participant Pts as XPointsLedger

  User->>Agent: Intent buy
  Agent->>Route: Ensure USDT0
  alt Short USDT0
    Route->>XL: Swap native to USDT0
  end
  Agent->>Buy: PAYMENT-SIGNATURE
  Buy->>OKX: verify plus settle
  OKX->>XL: USDT0 to merchant
  Buy->>Pts: Credit XPoints
```

---

## Trust model

1. Buyer sees a **transaction preview** (item, merchant, amount, route, rail).
2. Buyer **confirms** (`Authorize purchase`). No confirm, no charge.
3. x402: payTo + atomic amount must match the locked quote.
4. XPoints are **not** a token or a security — a demo rewards ledger funded conceptually by the protocol fee.
5. Protocol log is visible so the handshake is inspectable.

---

## Landing page contract

- Shopper: `Shop with Borneo` → `/buyer`
- Sellers: `Publish a storefront` → `/onboard`
- Hero thesis: intent → route → settle → earn on X Layer
