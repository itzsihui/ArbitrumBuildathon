# Fashion SKU naming conventions

Sellable units use composed titles. Parent style stays editable on the inventory form; axes come from the subcategory taxonomy.

| Arity | Pattern | Example |
|-------|---------|---------|
| 1D | Style / Color | `Wallet / Black` |
| 2D | Style / Color / Size | `Oxford Shirt / Navy / M` |
| 3D bottoms | Style / Color / WaistxInseam | `Jeans / Indigo / 30x32` |
| 3D intimates | Style / Color / BandCup | `Bra / Nude / 34B` |

## Subcategory → required axes

| Subcategory | Required | Optional |
|-------------|----------|----------|
| Tops & Outerwear | color, size | fit, length, material |
| Bottoms | color, waist, inseam | fit, material |
| Dresses & Jumpsuits | color, size | length, waist, fit |
| Footwear | color, size | width, material |
| Intimates & Swimwear | color, band, cup | size |
| Bags & Luggage | color | material, size |
| Belts & SLG | color | size, finish |
| Jewelry | metal, size | finish |
| Eyewear | frameColor | lensColor, size |
| Hats & Headwear | color, size | — |
| Soft Accessories | color | pattern, size |

## Sizing notes

- **Tops / dresses / hats**: alpha (`XS`–`XXL`) or hat (`OSFA`, `S/M`, `M/L`); dresses may also set **waist** for body-fit shopping
- **Bottoms**: waist × inseam numerics (`30` × `32`) — required for shoppers filtering by body size
- **Intimates**: band + cup (`34` + `B`)
- **Footwear**: triple string in `size` — `42EUR/8UK/9US` (EU / UK / US in one cell). Optional `width`: `Narrow/B`, `Standard/D`, `Wide/EE`
- **Bags**: color required; `size` as `Mini` / `Small` / `Medium` / `Large`

## Sample files

| File | Scope |
|------|--------|
| `clothing-boutique.csv` | Clothing — tops, bottoms (waist×inseam), dresses (waist), intimates (band/cup) |
| `sneaker-drop.csv` | Footwear only — triple EU/UK/US sizes |
| `hackathon-inventory.csv` | Merch — tees, caps, canvas totes |

## Tracking hints

- **Batch**: apparel dye lots (tops, bottoms, most accessories)
- **Serial**: high-value bags / fine jewelry — noted in SKU description for agents

Merchants must complete every required axis (plus qty and USDC price) on the edit form before publish. Titles are composed from the final edited attributes.
