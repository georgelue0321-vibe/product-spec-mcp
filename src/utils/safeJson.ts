export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(obj: unknown, fallback = "{}"): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return fallback;
  }
}
