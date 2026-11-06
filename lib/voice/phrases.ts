import type { SpokenWord } from "@/lib/voice/speech-player";

/** Group words into on-screen phrases: break at sentence ends, at a comma once
 *  a phrase has some weight, and never past six words. */
export function phrasesOf(words: SpokenWord[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  words.forEach((w, i) => {
    cur.push(i);
    const end = /[.!?]["')]?$/.test(w.text);
    const soft = /[,;:]$/.test(w.text) && cur.length >= 3;
    if (end || soft || cur.length >= 6) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}
