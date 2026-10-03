# Sample inventories

Drop any CSV on **Open a store** (`/onboard`). Fashion columns: `title`, `description`, `quantity`, `price`, `subcategory`, `style`, plus axes (`color`, `size`, `fit`, `waist`, `inseam`, `length`, `width`, `band`, `cup`, `material`, …). Prices are tiny so Base Sepolia test buys stay cheap.

| File | Scope |
|---|---|
| `clothing-boutique.csv` | Clothing — tops, bottoms (waist×inseam), dresses, bras |
| `sneaker-drop.csv` | Footwear only — size as `42EUR/8UK/9US` |
| `hackathon-inventory.csv` | Merch — tees, caps, canvas totes |

Shoe sizes use a **triple string** in one cell: `EU/UK/US` (e.g. `37EUR/4UK/5.5US`). See `fashion-sku-naming.md` for axis rules.

Example chat instead of CSV: `boutique with 10 linen shirts, 8 jeans, 6 sneakers` then set prices in the form.
