// Rank and pick browser speechSynthesis voices, preferring natural British English.
// Used by the Command Deck voice picker and the spoken reply loop.

const NATURAL_RE = /\b(natural|neural|online|enhanced|premium|wavenet|studio)\b/i;
const PREFERRED_RE = /\b(Daniel|Serena|Kate|Arthur|Martha|Sonia|Ryan)\b/i;
const GOOGLE_UK_RE = /Google UK English (Female|Male)/i;

export function voiceBlob(v) {
  return `${(v && v.name) || ""} ${(v && v.voiceURI) || ""} ${(v && v.lang) || ""}`;
}

export function isBritish(v) {
  if (!v) return false;
  const lang = v.lang || "";
  if (/en[-_]GB/i.test(lang)) return true;
  return /UK English|United Kingdom|\bEnglish UK\b|\ben[-_]GB\b/i.test(voiceBlob(v));
}

export function isEnglish(v) {
  if (!v) return false;
  const lang = v.lang || "";
  if (/^en\b/i.test(lang)) return true;
  return /\bEnglish\b/i.test(voiceBlob(v));
}

export function voiceScore(v) {
  if (!v || !isEnglish(v)) return -1;
  const name = v.name || "";
  const uri = v.voiceURI || "";
  const blob = name + " " + uri;
  let s = isBritish(v) ? 100 : 10;
  if (NATURAL_RE.test(blob)) s += 50;
  if (GOOGLE_UK_RE.test(name)) s += 40;
  if (PREFERRED_RE.test(name)) s += 40;
  return s;
}

export function compareVoices(a, b) {
  const d = voiceScore(b) - voiceScore(a);
  if (d) return d;
  return String(a && a.name || "").localeCompare(String(b && b.name || ""));
}

export function partitionVoices(list) {
  const src = Array.isArray(list) ? list : [];
  const gb = src.filter(isBritish).sort(compareVoices);
  const other = src.filter(v => isEnglish(v) && !isBritish(v)).sort(compareVoices);
  return { gb, other };
}

export function pickBestVoice(list, saved) {
  const src = Array.isArray(list) ? list : [];
  if (saved) {
    const hit = src.find(v => v.voiceURI === saved || v.name === saved);
    if (hit) return hit;
  }
  let best = null, bestScore = -1;
  for (const v of src) {
    const s = voiceScore(v);
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return best;
}
