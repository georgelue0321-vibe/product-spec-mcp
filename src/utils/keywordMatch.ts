export function matchKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((kw) => lowerText.includes(kw.toLowerCase()));
}

export function matchAnyKeyword(text: string, keywords: string[]): string | null {
  const lowerText = text.toLowerCase();
  for (const kw of keywords) {
    if (lowerText.includes(kw.toLowerCase())) {
      return kw;
    }
  }
  return null;
}

export function extractKeywords(text: string, keywordList: string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywordList.filter((kw) => lowerText.includes(kw.toLowerCase()));
}
