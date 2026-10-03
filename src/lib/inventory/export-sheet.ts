import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  enrichFashionMeta,
  type FashionAxis,
  type FashionSubcategory,
} from "@/lib/inventory/fashion";
import {
  mergeDraftLines,
  normalizeDraft,
  type MerchantDraft,
  type MerchantDraftLine,
} from "@/lib/inventory/parse";

export const SHEET_AXES = [
  "color",
  "size",
  "fit",
  "waist",
  "inseam",
  "length",
  "width",
  "band",
  "cup",
  "material",
  "finish",
  "metal",
  "frameColor",
  "lensColor",
  "pattern",
] as const satisfies readonly FashionAxis[];

export const SHEET_COLUMNS = [
  "title",
  "description",
  "quantity",
  "price",
  "subcategory",
  "style",
  ...SHEET_AXES,
] as const;

export type SheetRow = Record<(typeof SHEET_COLUMNS)[number], string>;

export function draftLineToSheetRow(
  line: MerchantDraftLine,
  quantity?: string | number,
  price?: string,
): SheetRow {
  const fashion =
    line.fashion ?? enrichFashionMeta(line.title, line.description);
  const qty = quantity ?? line.quantity;
  const priceVal = price ?? line.price ?? "";
  const row: SheetRow = {
    title: line.title || fashion.style || "",
    description: line.description || "",
    quantity: String(qty ?? ""),
    price: String(priceVal ?? ""),
    subcategory: fashion.subcategory,
    style: fashion.style || line.title || "",
    color: "",
    size: "",
    fit: "",
    waist: "",
    inseam: "",
    length: "",
    width: "",
    band: "",
    cup: "",
    material: "",
    finish: "",
    metal: "",
    frameColor: "",
    lensColor: "",
    pattern: "",
  };
  for (const axis of SHEET_AXES) {
    row[axis] = String(fashion.attrs?.[axis] ?? "");
  }
  return row;
}

export function draftToSheetRows(
  draft: MerchantDraft,
  quantities?: string[],
  prices?: string[],
): SheetRow[] {
  return draft.lines.map((line, i) =>
    draftLineToSheetRow(line, quantities?.[i], prices?.[i]),
  );
}

export function sheetRowToDraftLine(row: SheetRow): MerchantDraftLine {
  const title = String(row.title || row.style || "Untitled").trim() || "Untitled";
  const description = String(row.description || "").trim() || undefined;
  const quantity = Math.max(1, Math.floor(Number(row.quantity) || 1));
  const priceNum = Number(String(row.price ?? "").replace(/[^\d.]/g, ""));
  const price =
    Number.isFinite(priceNum) && priceNum > 0 ? priceNum.toFixed(2) : undefined;
  const subcategory = (String(row.subcategory || "").trim() ||
    undefined) as FashionSubcategory | undefined;
  const attrs: NonNullable<MerchantDraftLine["fashion"]>["attrs"] = {};
  for (const axis of SHEET_AXES) {
    const value = String(row[axis] ?? "").trim();
    if (value) attrs[axis] = value;
  }
  const fashion = enrichFashionMeta(title, description, {
    subcategory: subcategory || enrichFashionMeta(title, description).subcategory,
    style: String(row.style || title).trim() || title,
    attrs,
  });
  return {
    quantity,
    title,
    name: title,
    description,
    price,
    fashion,
  };
}

export function downloadCsv(filename: string, rows: SheetRow[]) {
  const csv = Papa.unparse(rows, { columns: [...SHEET_COLUMNS] });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function downloadExcel(filename: string, rows: SheetRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...SHEET_COLUMNS],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(
    blob,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse CSV or Excel file text/bytes into draft lines (fashion columns). */
export async function parseSheetFile(file: File): Promise<MerchantDraftLine[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
    return raw.map((record) => sheetRowToDraftLine(normalizeRecord(record)));
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return parsed.data
    .filter((r) => Object.values(r).some((v) => String(v).trim()))
    .map((record) => sheetRowToDraftLine(normalizeRecord(record)));
}

function normalizeRecord(record: Record<string, unknown>): SheetRow {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    lower[k.trim().toLowerCase()] = String(v ?? "").trim();
  }
  const get = (...keys: string[]) => {
    for (const key of keys) {
      if (lower[key]) return lower[key];
    }
    return "";
  };
  return {
    title: get("title", "name"),
    description: get("description"),
    quantity: get("quantity", "qty"),
    price: get("price"),
    subcategory: get("subcategory", "category"),
    style: get("style"),
    color: get("color"),
    size: get("size"),
    fit: get("fit"),
    waist: get("waist"),
    inseam: get("inseam"),
    length: get("length"),
    width: get("width"),
    band: get("band"),
    cup: get("cup"),
    material: get("material"),
    finish: get("finish"),
    metal: get("metal"),
    frameColor: get("framecolor", "frame_color", "frame"),
    lensColor: get("lenscolor", "lens_color", "lens"),
    pattern: get("pattern"),
  };
}

/** Merge imported lines into an existing draft (append / update by composed key). */
export function mergeImportedLines(
  existing: MerchantDraft | null,
  incoming: MerchantDraftLine[],
): MerchantDraft {
  if (!incoming.length) {
    return (
      normalizeDraft(existing) ?? {
        name: "Borneo Store",
        lines: [],
      }
    );
  }
  if (!existing?.lines.length) {
    return normalizeDraft({
      name: existing?.name || "Borneo Store",
      slug: existing?.slug,
      lines: incoming,
    })!;
  }
  return mergeDraftLines(existing, incoming);
}
