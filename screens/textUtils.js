const TITLE_CASE_STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'com', 'para', 'por', 'no', 'na', 'nos', 'nas', 'um', 'uma']);

export function toTitleCase(text) {
  return (text || '')
    .split(' ')
    .map((word, i) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (i !== 0 && TITLE_CASE_STOPWORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
