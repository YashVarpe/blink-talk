export const WORDS = ["a","about","all","am","and","are","bathroom","because","blanket","cold","come","doctor","drink","eat","family","feel","food","good","happy","have","head","hello","help","here","hot","hungry","I","in","is","love","medicine","me","need","no","not","now","pain","please","sleep","sorry","thank","thirsty","tired","to","want","water","what","when","where","yes","you"];
export function suggestWords(prefix: string, n = 3): string[] {
  const p = prefix.toLowerCase();
  if (!p) return [];
  return WORDS.filter((w) => w.toLowerCase().startsWith(p) && w.toLowerCase() !== p).slice(0, n);
}