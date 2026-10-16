// "Under Review" -> "Under review": only the first letter is a capital. Short all-capital words ("AI", "CO", "PO") are acronyms and stay as they are.
export function sentenceCase(text) {
  if (typeof text !== 'string' || !text) return text;
  const words = text.split(' ').map(word => (/^[A-Z]{2,4}$/.test(word) ? word : word.toLowerCase()));
  const first = words.findIndex(word => word !== '');
  if (first >= 0 && !/^[A-Z]{2,4}$/.test(words[first])) words[first] = words[first].charAt(0).toUpperCase() + words[first].slice(1);
  return words.join(' ');
}
