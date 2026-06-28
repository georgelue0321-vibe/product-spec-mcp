import { z } from "zod";

export const looseBoolean = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
}, z.boolean());

export const looseNumber = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  if (normalized === "") return value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number());

export function looseStringArray(description: string) {
  return z
    .preprocess((value) => {
      if (Array.isArray(value)) return value;
      if (
        value &&
        typeof value === "object" &&
        "item" in value &&
        Array.isArray((value as { item?: unknown }).item)
      ) {
        return (value as { item: unknown[] }).item;
      }
      return value;
    }, z.array(z.string()))
    .describe(description);
}
