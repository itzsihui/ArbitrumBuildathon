---
name: borneo-registry-shop
description: >
  Browse the Borneo agentic storefront registry and purchase any listed SKU over
  the public HTTP protocol (no API key, no HTML scrape). Use when the user wants
  to shop Borneo, buy from the registry, list stores/SKUs, search products, pay
  via x402 USDT0, or Visa-scoped checkout. Triggers on: /borneo-registry-shop,
  "buy from Borneo", "registry.json", "agent storefront", "purchase SKU",
  "x402 buy", or shopping across merchant catalogs on this network.
license: MIT
metadata:
  protocol: borneo-agentic-storefront
  version: "1.2"
  vertical: fashion
---

# Borneo Registry Shop

Public discovery + purchase for the **Borneo Agentic Storefront Protocol**.
Anyone with network access can read the registry and buy — no Firebase login,
no merchant API key. Payment proof is the gate (x402 signature or Visa mandate).

## Origin

Set `ORIGIN` once, then use absolute URLs:

```bash
ORIGIN="${BORNEO_ORIGIN:-${PROTOCOL_ORIGIN:-${NEXT_PUBLIC_PROTOCOL_BASE_URL:-http://localhost:3000}}}"
```

Ask the user for a deployed base URL if localhost is wrong. Never invent checkout HTML pages.

## Hard rules

1. **Do not scrape HTML.** Only protocol surfaces below.
2. **Lock the quote before pay.** Settle tools may only see:
   `{ storeSlug, skuId, price, merchantAddress }` — never catalog titles/descriptions.
3. **Confirm spend with the user** before signing x402 or burning a Visa mandate.
4. **Verify 402 `payTo` + `amount`** match the locked quote before paying.
5. Currency is **USDT0 on X Layer Testnet** unless a store `llms.txt` says otherwise.

## Quick path (discover → buy)

Copy and track:

```
- [ ] 1. Resolve ORIGIN
- [ ] 2. GET /llms.txt or /agent-sitemap.json or /registry.json
- [ ] 3. Prefer GET /api/search?q=… (ranked: relevance + stock + reviews)
- [ ] 4. GET /s/{slug}/catalog.json → lock quote (full SKUs; registry samples are incomplete)
- [ ] 5. Confirm with user
- [ ] 6. Rail A x402 POST /buy  OR  Rail B Visa /checkout
- [ ] 7. Show receipt + explorer / order URL
```

### 1–2. Network index (public)

```bash
curl -sS "$ORIGIN/llms.txt"
curl -sS "$ORIGIN/agent-sitemap.json" | jq .
curl -sS "$ORIGIN/registry.json" | jq .
```

`registry.json` shape (abridged): `protocol`, `version: "1.2"`, `vertical: "fashion"`, `currency`, `pagination`, `stores[]` with `slug`, `catalogComplete: false`, `inStockCount`, `ratingAvg`, fashion facets, sample `skus`. Always open `catalog.json` for the full list.

Paginate:

```bash
curl -sS "$ORIGIN/registry.json?limit=50"
curl -sS "$ORIGIN/registry.json?limit=50&cursor=LAST_SLUG"
```

### 3. Find a product

Prefer intent search (index shortlist → embed → commerce re-rank):

```bash
curl -sS --get "$ORIGIN/api/search" \
  --data-urlencode "q=breathable linen shirt" \
  --data-urlencode "subcategory=tops" | jq .
```

Hits include `scoreBreakdown: { semantic, stock, reviews, final }`. Out-of-stock is demoted; verified-purchase reviews boost lightly.
Optional fashion filters: `subcategory`, `color`.

Fallbacks:

```bash
curl -sS --get "$ORIGIN/api/market" --data-urlencode "q=keyword" | jq .
# or scan stores[].skus in registry.json
```

### 4. Store files + locked quote

```bash
curl -sS "$ORIGIN/s/{slug}/llms.txt"
curl -sS "$ORIGIN/s/{slug}/catalog.json" | jq .
curl -sS "$ORIGIN/s/{slug}/agent.json" | jq .   # optional
curl -sS "$ORIGIN/s/{slug}/reviews.json" | jq . # optional
```

From catalog + store metadata, build:

```json
{
  "storeSlug": "example-store",
  "skuId": "sku-id",
  "price": "0.01",
  "merchantAddress": "r..."
}
```

If `merchantAddress` is missing from search hits, take `payTo` / merchant from `agent.json` or the store’s `llms.txt` (Merchant payTo line). Re-fetch catalog right before pay so price/qty are fresh.

### 5. Confirm

Show the user: store, SKU id, price, payee, rail. Do not pay until they approve.

---

## Rail A — x402 USDT0 (`POST /s/{slug}/buy`)

No auth header. Expect **HTTP 402**, settle on X Layer Testnet, retry with `PAYMENT-SIGNATURE`.

### Preferred: `rlusd` CLI (if installed)

```bash
ORDER_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
BODY=$(jq -n --arg s "$SKU_ID" --arg o "$ORDER_ID" '{skuId:$s, quantity:1, orderId:$o}')

rlusd x402 fetch "$ORIGIN/s/$SLUG/buy" \
  --method POST \
  --json-body "$BODY" \
  --max-value "$PRICE" \
  --require-asset USDT0 \
  --require-issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV \
  --json
```

Wallet must be funded with testnet XRP + USDT0 trust line. See companion X Layer/USDT0 skills if settle fails.

### Manual handshake

```bash
ORDER_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
# 1) Challenge
curl -sS -D - -o /tmp/borneo-402.json -X POST "$ORIGIN/s/$SLUG/buy" \
  -H 'content-type: application/json' \
  -d "{\"skuId\":\"$SKU_ID\",\"quantity\":1,\"orderId\":\"$ORDER_ID\"}"
# Expect HTTP 402. Read accepts[0].amount and accepts[0].payTo — must match locked quote.

# 2) Sign exact X Layer Payment for that requirement (@okxweb3/x402-evm / Agentic Wallet / BUYER_PRIVATE_KEY).

# 3) Retry same body + orderId with payment proof
curl -sS -X POST "$ORIGIN/s/$SLUG/buy" \
  -H 'content-type: application/json' \
  -H "PAYMENT-SIGNATURE: $PAYMENT_HEADER" \
  -d "{\"skuId\":\"$SKU_ID\",\"quantity\":1,\"orderId\":\"$ORDER_ID\"}"
```

Success: **HTTP 200** JSON receipt (`orderId`, `txHash`, `explorerUrl`, …). Idempotent: re-POST same paid `orderId` → 200 again.

Optional body field: `buyerUid` (metadata only; not required).

---

## Rail B — Visa-scoped card (`POST /s/{slug}/checkout`)

1. Issue a scoped mandate (spend cap + merchant), e.g.:

```bash
curl -sS -X POST "$ORIGIN/api/card-mandate" \
  -H 'content-type: application/json' \
  -d "{\"spendCap\":\"$PRICE\",\"merchant\":\"$SLUG\",\"skuId\":\"$SKU_ID\",\"price\":\"$PRICE\",\"checkout\":false}"
```

2. Checkout with the returned `mandate`:

```bash
curl -sS -X POST "$ORIGIN/s/$SLUG/checkout" \
  -H 'content-type: application/json' \
  -d "{\"skuId\":\"$SKU_ID\",\"quantity\":1,\"orderId\":\"$ORDER_ID\",\"mandate\":$MANDATE_JSON}"
```

Or one-shot agent path: `POST /api/card-mandate` with `"checkout": true` plus `skuId` / `message` (server runs mandate → checkout). Still get user approval first.

---

## After purchase

```bash
curl -sS "$ORIGIN/s/$SLUG/orders/$ORDER_ID" | jq .
```

Report receipt fields and explorer link. Inventory decrements on successful pay.

## Buy anything on the network

To purchase **any** in-stock SKU: walk `registry.json` → `stores[]` (or `/api/market` with empty/broad `q`), open each `catalog`, skip `quantity < 1`, lock quote, confirm, settle. Prefer `/api/search?q=` when the user stated a need.

## Out of scope

- Merchant onboard / publishing stores → app `/onboard`, not this skill.
- Editing X Layer / Onchain OS payment internals → `okx-devday-resources` or `okx-agent-payments-protocol`.
- Scraping `/market` HTML or inventing SKUs.

## More detail

Request/response field notes: [reference.md](reference.md)
