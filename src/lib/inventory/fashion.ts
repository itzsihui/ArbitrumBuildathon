/**
 * Fashion inventory domain knowledge for the merchant seller agent.
 *
 * SKU naming conventions (parent → sellable unit):
 * - 1D: Style / Color            e.g. Wallet / Black
 * - 2D: Style / Color / Size     e.g. Oxford Shirt / Navy / M
 * - 3D: Style / Color / WaistxInseam or Band+Cup
 *       e.g. Jeans / Indigo / 30x32
 */

export type FashionSubcategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "footwear"
  | "intimates"
  | "bags"
  | "belts_slg"
  | "jewelry"
  | "eyewear"
  | "hats"
  | "soft_accessories";

export type FashionAxis =
  | "color"
  | "size"
  | "fit"
  | "waist"
  | "inseam"
  | "length"
  | "width"
  | "band"
  | "cup"
  | "material"
  | "finish"
  | "metal"
  | "frameColor"
  | "lensColor"
  | "circumference"
  | "pattern";

export type FashionVariantArity = "1d" | "2d" | "3d";

export type FashionTracking = "batch" | "serial";

export type FashionMeta = {
  subcategory: FashionSubcategory;
  style?: string;
  attrs?: Partial<Record<FashionAxis, string>>;
  tracking?: FashionTracking;
};

export type FashionSubcategoryDef = {
  id: FashionSubcategory;
  label: string;
  arity: FashionVariantArity;
  requiredAxes: FashionAxis[];
  optionalAxes: FashionAxis[];
  sizingSystems: string[];
  tracking: FashionTracking;
  keywords: string[];
  presets: Partial<Record<FashionAxis, string[]>>;
};

const ALPHA_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const COLORS = [
  "Black",
  "White",
  "Navy",
  "Ivory",
  "Beige",
  "Gray",
  "Brown",
  "Red",
  "Green",
  "Blue",
  "Natural",
  "Indigo",
];
const WAISTS = ["28", "29", "30", "31", "32", "33", "34", "36", "38"];
const INSEAMS = ["28", "30", "32", "34"];
const SHOE_US = ["6", "7", "8", "9", "10", "11", "12", "13"];
const FITS = ["Slim", "Regular", "Relaxed"];
const BANDS = ["32", "34", "36", "38"];
const CUPS = ["A", "B", "C", "D", "DD"];
const BAG_SIZES = ["Mini", "Small", "Medium", "Large"];
const BELT_LENGTHS = ["32\"", "34\"", "36\"", "38\"", "85cm", "90cm", "95cm"];
const RING_SIZES = ["5", "6", "7", "8", "9", "10"];
const HAT_SIZES = ["S/M", "M/L", "OSFA", "7 1/8", "7 1/4", "7 3/8"];

export const FASHION_SUBCATEGORIES: FashionSubcategoryDef[] = [
  {
    id: "tops",
    label: "Tops & Outerwear",
    arity: "2d",
    requiredAxes: ["color", "size"],
    optionalAxes: ["fit", "length"],
    sizingSystems: ["Alpha (XS–XXL)", "Numeric collar/chest"],
    tracking: "batch",
    keywords: [
      "shirt",
      "tee",
      "t-shirt",
      "tshirt",
      "blouse",
      "blazer",
      "coat",
      "jacket",
      "hoodie",
      "sweater",
      "crew",
      "oxford",
      "polo",
      "cardigan",
      "parka",
      "vest",
      "jersey",
      "sweatshirt",
    ],
    presets: {
      color: COLORS,
      size: ALPHA_SIZES,
      fit: FITS,
      length: ["Petite", "Regular", "Tall"],
    },
  },
  {
    id: "bottoms",
    label: "Bottoms",
    arity: "3d",
    requiredAxes: ["color", "waist", "inseam"],
    optionalAxes: ["fit"],
    sizingSystems: ["Dual-numeric (30x32)", "Alpha S–L"],
    tracking: "batch",
    keywords: [
      "jean",
      "jeans",
      "trouser",
      "chino",
      "short",
      "shorts",
      "pant",
      "pants",
      "denim",
      "skirt",
    ],
    presets: { color: COLORS, waist: WAISTS, inseam: INSEAMS, fit: FITS },
  },
  {
    id: "dresses",
    label: "Dresses & Jumpsuits",
    arity: "2d",
    requiredAxes: ["color", "size"],
    optionalAxes: ["length", "waist", "fit"],
    sizingSystems: ["Alpha XS–XL", "Numeric dress (US 2–12)"],
    tracking: "batch",
    keywords: ["dress", "gown", "romper", "jumpsuit", "midi", "maxi"],
    presets: {
      color: COLORS,
      size: ALPHA_SIZES,
      length: ["Petite", "Regular", "Tall"],
      waist: WAISTS,
      fit: FITS,
    },
  },
  {
    id: "footwear",
    label: "Footwear",
    arity: "2d",
    requiredAxes: ["color", "size"],
    optionalAxes: ["width"],
    sizingSystems: ["US/UK", "EU", "Mondopoint/CM"],
    tracking: "batch",
    keywords: [
      "sneaker",
      "shoe",
      "boot",
      "loafer",
      "heel",
      "sandal",
      "trainer",
      "oxford shoe",
    ],
    presets: {
      color: COLORS,
      size: SHOE_US,
      width: ["Narrow/B", "Standard/D", "Wide/EE"],
    },
  },
  {
    id: "intimates",
    label: "Intimates & Swimwear",
    arity: "3d",
    requiredAxes: ["color", "band", "cup"],
    optionalAxes: ["size"],
    sizingSystems: ["Band/Cup (32A–38DD)", "Alpha XS–XL"],
    tracking: "batch",
    keywords: ["bra", "underwear", "swim", "swimsuit", "bikini", "brief"],
    presets: { color: COLORS, band: BANDS, cup: CUPS, size: ALPHA_SIZES },
  },
  {
    id: "bags",
    label: "Bags & Luggage",
    arity: "1d",
    requiredAxes: ["color"],
    optionalAxes: ["material", "size"],
    sizingSystems: ["Alpha/Volume (Mini–Large, 20L)"],
    tracking: "serial",
    keywords: [
      "tote",
      "bag",
      "backpack",
      "crossbody",
      "suitcase",
      "duffel",
      "clutch",
      "purse",
    ],
    presets: {
      color: COLORS,
      material: ["Leather", "Canvas", "Nylon"],
      size: BAG_SIZES,
    },
  },
  {
    id: "belts_slg",
    label: "Belts & SLG",
    arity: "1d",
    requiredAxes: ["color"],
    optionalAxes: ["size", "finish"],
    sizingSystems: ["Belt length", "One-size"],
    tracking: "batch",
    keywords: ["belt", "wallet", "cardholder", "card holder", "keychain"],
    presets: {
      color: COLORS,
      size: [...BELT_LENGTHS, "OS"],
      finish: ["Gold", "Silver", "Matte"],
    },
  },
  {
    id: "jewelry",
    label: "Jewelry",
    arity: "2d",
    requiredAxes: ["metal", "size"],
    optionalAxes: ["finish"],
    sizingSystems: ["Ring US 5–10", "Chain 16–20\""],
    tracking: "serial",
    keywords: [
      "ring",
      "necklace",
      "bracelet",
      "earring",
      "pendant",
      "chain",
    ],
    presets: {
      metal: ["Gold", "Sterling Silver", "Rose Gold", "Steel"],
      size: [...RING_SIZES, "16\"", "18\"", "20\"", "OS"],
      finish: ["18k Gold", "Sterling Silver", "Plated"],
    },
  },
  {
    id: "eyewear",
    label: "Eyewear",
    arity: "1d",
    requiredAxes: ["frameColor"],
    optionalAxes: ["lensColor", "size"],
    sizingSystems: ["Lens-Bridge-Temple (e.g. 52-18-140)"],
    tracking: "batch",
    keywords: ["sunglass", "sunglasses", "glasses", "optical", "frame"],
    presets: {
      frameColor: COLORS,
      lensColor: ["Smoke", "Brown", "Clear", "Mirror"],
      size: ["52-18-140", "54-18-145", "OS"],
    },
  },
  {
    id: "hats",
    label: "Hats & Headwear",
    arity: "2d",
    requiredAxes: ["color", "size"],
    optionalAxes: [],
    sizingSystems: ["Fitted", "S/M/L", "OSFA"],
    tracking: "batch",
    keywords: ["cap", "hat", "beanie", "fedora", "bucket", "trucker"],
    presets: { color: COLORS, size: HAT_SIZES },
  },
  {
    id: "soft_accessories",
    label: "Soft Accessories",
    arity: "1d",
    requiredAxes: ["color"],
    optionalAxes: ["pattern", "size"],
    sizingSystems: ["One-size", "Glove S–L"],
    tracking: "batch",
    keywords: ["scarf", "tie", "pocket square", "glove", "gloves", "shawl"],
    presets: {
      color: COLORS,
      pattern: ["Solid", "Stripe", "Plaid", "Print"],
      size: ["OS", "S", "M", "L"],
    },
  },
];

const BY_ID = Object.fromEntries(
  FASHION_SUBCATEGORIES.map((d) => [d.id, d]),
) as Record<FashionSubcategory, FashionSubcategoryDef>;

export function fashionDef(
  id: FashionSubcategory | undefined,
): FashionSubcategoryDef | null {
  if (!id) return null;
  return BY_ID[id] ?? null;
}

function keywordMatches(hay: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(hay);
}

export function classifyFashionSubcategory(
  title: string,
  description?: string,
): FashionSubcategory {
  const hay = `${title} ${description ?? ""}`.toLowerCase();
  let best: FashionSubcategory = "tops";
  let bestScore = 0;
  for (const def of FASHION_SUBCATEGORIES) {
    let score = 0;
    for (const kw of def.keywords) {
      if (keywordMatches(hay, kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = def.id;
    }
  }
  return best;
}

/** Required + optional axes defined for a subcategory. */
export function subcategoryFashionAxes(
  sub: FashionSubcategory,
): FashionAxis[] {
  const def = fashionDef(sub);
  if (!def) return [];
  return [...def.requiredAxes, ...def.optionalAxes];
}

/** Inventory table columns that apply to a subcategory (others stay empty). */
export function inventoryTableAxesForSubcategory(
  sub: FashionSubcategory,
): FashionAxis[] {
  const allowed = new Set(subcategoryFashionAxes(sub));
  return INVENTORY_TABLE_AXES.filter((axis) => allowed.has(axis));
}

export function requiredAxes(
  sub: FashionSubcategory | undefined,
): FashionAxis[] {
  return fashionDef(sub)?.requiredAxes ?? ["color", "size"];
}

export function missingAxes(
  sub: FashionSubcategory | undefined,
  attrs?: Partial<Record<FashionAxis, string>> | null,
): FashionAxis[] {
  return requiredAxes(sub).filter((axis) => !String(attrs?.[axis] ?? "").trim());
}

export function isFashionLineComplete(line: {
  title?: string;
  fashion?: FashionMeta | null;
}): boolean {
  const title = String(line.title ?? "").trim();
  if (!title) return false;
  const fashion = line.fashion;
  if (!fashion?.subcategory) return false;
  return missingAxes(fashion.subcategory, fashion.attrs).length === 0;
}

export function fashionCompletenessAsk(lines: Array<{
  title: string;
  fashion?: FashionMeta | null;
}>): string {
  const gaps = lines
    .map((line, i) => {
      const sub = line.fashion?.subcategory;
      const miss = missingAxes(sub, line.fashion?.attrs);
      if (!sub) return `Row ${i + 1} (${line.title || "untitled"}): pick a subcategory`;
      if (miss.length === 0) return null;
      const def = fashionDef(sub);
      return `Row ${i + 1} (${line.title}): fill ${miss.join(", ")} (${def?.label ?? sub})`;
    })
    .filter(Boolean);
  if (gaps.length === 0) return "";
  return `Complete fashion details in the inventory form before publishing:\n• ${gaps.join("\n• ")}`;
}

export function formatFashionSkuTitle(args: {
  style: string;
  attrs?: Partial<Record<FashionAxis, string>> | null;
  subcategory?: FashionSubcategory;
}): string {
  const style = args.style.trim() || "Item";
  const def = fashionDef(args.subcategory);
  const axes = [
    ...(def?.requiredAxes ?? []),
    ...(def?.optionalAxes ?? []),
  ];
  const parts = [style];
  const seen = new Set<string>();
  for (const axis of axes) {
    const v = String(args.attrs?.[axis] ?? "").trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    if (axis === "waist" && args.attrs?.inseam) {
      const inseam = String(args.attrs.inseam).trim();
      parts.push(`${v}x${inseam}`);
      seen.add(inseam.toLowerCase());
      continue;
    }
    if (axis === "inseam") continue;
    if (axis === "band" && args.attrs?.cup) {
      parts.push(`${v}${String(args.attrs.cup).trim()}`);
      seen.add(String(args.attrs.cup).trim().toLowerCase());
      continue;
    }
    if (axis === "cup") continue;
    parts.push(v);
  }
  return parts.join(" / ");
}

/** Inventory sheet columns shown during merchant onboard demos. */
export const INVENTORY_TABLE_AXES: FashionAxis[] = [
  "color",
  "size",
  "fit",
  "waist",
  "inseam",
  "length",
  "width",
  "band",
  "cup",
];

const DEMO_QTY = [12, 24, 8, 15, 20, 10, 18, 6, 30, 14, 22, 16];
const DEMO_PRICES = ["0.01", "0.02", "0.03", "0.04", "0.05"];

/**
 * Prefill only axes that belong to this subcategory (e.g. caps get color + size,
 * not waist/band/cup). Irrelevant attrs are omitted.
 */
export function prefillDemoFashionAttrs(
  subcategory: FashionSubcategory,
  index: number,
  existing?: Partial<Record<FashionAxis, string>> | null,
): Partial<Record<FashionAxis, string>> {
  const def = fashionDef(subcategory)!;
  const applicable = new Set(subcategoryFashionAxes(subcategory));
  const attrs: Partial<Record<FashionAxis, string>> = {};

  for (const [key, value] of Object.entries(existing ?? {})) {
    const axis = key as FashionAxis;
    if (!applicable.has(axis)) continue;
    const v = String(value ?? "").trim();
    if (v) attrs[axis] = v;
  }

  const fill = (axis: FashionAxis) => {
    if (!applicable.has(axis)) return;
    if (String(attrs[axis] ?? "").trim()) return;
    const presets = axisPresets(axis, subcategory);
    if (presets.length) attrs[axis] = presets[index % presets.length]!;
  };

  for (const axis of def.requiredAxes) fill(axis);
  for (const axis of def.optionalAxes) fill(axis);

  return attrs;
}

export function enrichFashionMeta(
  title: string,
  description?: string,
  existing?: FashionMeta | null,
): FashionMeta {
  const subcategory =
    existing?.subcategory ?? classifyFashionSubcategory(title, description);
  const def = fashionDef(subcategory)!;
  const style = existing?.style?.trim() || title.trim();
  return {
    subcategory,
    style,
    attrs: { ...(existing?.attrs ?? {}) },
    tracking: existing?.tracking ?? def.tracking,
  };
}

export type DraftLineLike = {
  quantity: number;
  title: string;
  name?: string;
  description?: string;
  price?: string;
  fashion?: FashionMeta | null;
};

/** Classify each line; preserve existing fashion attrs. */
export function enrichDraftWithFashion<T extends DraftLineLike>(
  draft: { name?: string; slug?: string; lines: T[] },
): { name?: string; slug?: string; lines: T[] } {
  return {
    ...draft,
    lines: draft.lines.map((line) => {
      const fashion = enrichFashionMeta(
        line.title,
        line.description,
        line.fashion,
      );
      return { ...line, fashion };
    }),
  };
}

/**
 * After URL/Shopify import — prefill fashion axes, qty, and price so the
 * inventory sheet is demo-ready without manual data entry.
 */
export function enrichDraftForDemoImport<T extends DraftLineLike>(
  draft: { name?: string; slug?: string; lines: T[] },
): { name?: string; slug?: string; lines: T[] } {
  const classified = enrichDraftWithFashion(draft);
  return {
    ...classified,
    lines: classified.lines.map((line, index) => {
      const fashion = line.fashion ?? enrichFashionMeta(line.title, line.description);
      const attrs = prefillDemoFashionAttrs(
        fashion.subcategory,
        index,
        fashion.attrs,
      );
      return {
        ...line,
        quantity: DEMO_QTY[index % DEMO_QTY.length] ?? line.quantity,
        price: DEMO_PRICES[index % DEMO_PRICES.length] ?? line.price,
        fashion: { ...fashion, style: fashion.style?.trim() || line.title.trim(), attrs },
      };
    }),
  };
}

export function draftNeedsFashionVariants(
  lines: DraftLineLike[],
): boolean {
  return lines.some((line) => !isFashionLineComplete(line));
}

/** Apply composed titles from fashion attrs onto lines ready to publish. */
export function applyFashionTitlesToLines<T extends DraftLineLike>(
  lines: T[],
): T[] {
  return lines.map((line) => {
    if (!line.fashion?.subcategory) return line;
    const style = line.fashion.style?.trim() || line.title.trim();
    const titled = formatFashionSkuTitle({
      style,
      attrs: line.fashion.attrs,
      subcategory: line.fashion.subcategory,
    });
    const attrBits = Object.entries(line.fashion.attrs ?? {})
      .filter(([, v]) => String(v).trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    const trackingNote =
      line.fashion.tracking === "serial"
        ? "Serial/lot tracking recommended for this category."
        : undefined;
    const description = [line.description, attrBits, trackingNote]
      .filter(Boolean)
      .join(" — ");
    return {
      ...line,
      title: titled,
      name: titled,
      description: description || line.description,
    };
  });
}

const MAX_EXPAND = 40;

/**
 * Expand a parent line when attrs contain comma-separated option lists
 * on size/waist/inseam/color. Returns original line if nothing to expand.
 */
export function expandFashionVariants<T extends DraftLineLike>(
  line: T,
): { lines: T[]; capped: boolean } {
  const fashion = line.fashion;
  if (!fashion?.subcategory) return { lines: [line], capped: false };

  const colorOpts = splitOpts(fashion.attrs?.color);
  const sizeOpts = splitOpts(fashion.attrs?.size);
  const waistOpts = splitOpts(fashion.attrs?.waist);
  const inseamOpts = splitOpts(fashion.attrs?.inseam);

  const combos: Array<Partial<Record<FashionAxis, string>>> = [];

  if (waistOpts.length && inseamOpts.length) {
    for (const color of colorOpts.length ? colorOpts : [fashion.attrs?.color || ""]) {
      for (const waist of waistOpts) {
        for (const inseam of inseamOpts) {
          combos.push({
            ...fashion.attrs,
            color: color || fashion.attrs?.color,
            waist,
            inseam,
          });
        }
      }
    }
  } else if (sizeOpts.length > 1 || colorOpts.length > 1) {
    for (const color of colorOpts.length ? colorOpts : [fashion.attrs?.color || ""]) {
      for (const size of sizeOpts.length ? sizeOpts : [fashion.attrs?.size || ""]) {
        combos.push({
          ...fashion.attrs,
          color: color || fashion.attrs?.color,
          size: size || fashion.attrs?.size,
        });
      }
    }
  }

  if (combos.length <= 1) return { lines: [line], capped: false };

  const capped = combos.length > MAX_EXPAND;
  const slice = combos.slice(0, MAX_EXPAND);
  const style = fashion.style?.trim() || line.title.trim();
  const lines = slice.map((attrs) => {
    const nextFashion: FashionMeta = {
      ...fashion,
      style,
      attrs: Object.fromEntries(
        Object.entries(attrs).filter(([, v]) => String(v ?? "").trim()),
      ) as FashionMeta["attrs"],
    };
    const titled = formatFashionSkuTitle({
      style,
      attrs: nextFashion.attrs,
      subcategory: fashion.subcategory,
    });
    return {
      ...line,
      title: titled,
      name: titled,
      fashion: nextFashion,
    };
  });
  return { lines, capped };
}

function splitOpts(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function axisLabel(axis: FashionAxis): string {
  const labels: Record<FashionAxis, string> = {
    color: "Color",
    size: "Size",
    fit: "Fit",
    waist: "Waist",
    inseam: "Inseam",
    length: "Length",
    width: "Width",
    band: "Band",
    cup: "Cup",
    material: "Material",
    finish: "Finish",
    metal: "Metal",
    frameColor: "Frame",
    lensColor: "Lens",
    circumference: "Circumference",
    pattern: "Pattern",
  };
  return labels[axis];
}

/** Presets for an axis — prefer subcategory, else any fashion taxonomy that defines it. */
export function axisPresets(
  axis: FashionAxis,
  subcategory?: FashionSubcategory,
): string[] {
  const local = subcategory ? fashionDef(subcategory)?.presets[axis] : undefined;
  if (local?.length) return local;
  for (const def of FASHION_SUBCATEGORIES) {
    const list = def.presets[axis];
    if (list?.length) return list;
  }
  return [];
}

/** Example placeholder for empty fashion axis inputs (not a label). */
export function axisPlaceholder(
  axis: FashionAxis,
  subcategory?: FashionSubcategory,
): string {
  const example = axisPresets(axis, subcategory)[0];
  if (example) return `e.g. ${example}`;
  const fallbacks: Partial<Record<FashionAxis, string>> = {
    color: "e.g. Navy",
    size: "e.g. M",
    fit: "e.g. Slim",
    waist: "e.g. 32",
    inseam: "e.g. 30",
    length: "e.g. Regular",
    width: "e.g. Standard/D",
    band: "e.g. 34",
    cup: "e.g. B",
    material: "e.g. Leather",
    finish: "e.g. Matte",
    metal: "e.g. Gold",
    frameColor: "e.g. Tortoise",
    lensColor: "e.g. Clear",
    circumference: "e.g. 57cm",
    pattern: "e.g. Solid",
  };
  return fallbacks[axis] ?? `e.g. ${axisLabel(axis)}`;
}

/** Empty <select> prompt with a concrete example from presets when available. */
export function axisSelectPrompt(
  axis: FashionAxis,
  subcategory?: FashionSubcategory,
): string {
  const example = axisPresets(axis, subcategory)[0];
  if (example) return `Pick ${axisLabel(axis).toLowerCase()} (e.g. ${example})`;
  return `Pick ${axisLabel(axis).toLowerCase()}…`;
}
