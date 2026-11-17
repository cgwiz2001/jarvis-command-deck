// Speech input logic for the Command Deck (v2.6.17). Pure functions only, so they can be tested in node.
// The recogniser runs with continuous = true. The deck keeps listening through natural pauses,
// and sends only after a silence gap (or when Peter taps the mic again to finish).

export const PAUSE_OPTIONS = [
  { value: "1.5", ms: 1500, label: "Short pause (1.5 seconds)" },
  { value: "2.5", ms: 2500, label: "Normal pause (2.5 seconds)" },
  { value: "4", ms: 4000, label: "Long pause (4 seconds)" },
  { value: "tap", ms: null, label: "Only when I tap the mic again" }
];
export const DEFAULT_PAUSE = "2.5";
export const MAX_IDLE_RESTARTS = 6;

// Returns the pause length in ms, or null for "tap the mic to finish".
export function pauseMs(value) {
  const o = PAUSE_OPTIONS.find(p => p.value === String(value == null ? "" : value).trim());
  return (o || PAUSE_OPTIONS.find(p => p.value === DEFAULT_PAUSE)).ms;
}
export function pauseValue(value) {
  const o = PAUSE_OPTIONS.find(p => p.value === String(value == null ? "" : value).trim());
  return o ? o.value : DEFAULT_PAUSE;
}

const clean = s => String(s || "").replace(/\s+/g, " ").trim();
const norm = s => clean(s).toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, "").replace(/\s+/g, " ").trim();

// Joins final segments. Android Chrome can repeat earlier finals, or send a later final that
// already contains the earlier ones ("hello" then "hello how are you"). Those are merged, not doubled.
export function mergeText(a, b) {
  a = clean(a); b = clean(b);
  if (!a) return b;
  if (!b) return a;
  const na = norm(a), nb = norm(b);
  if (!nb || na === nb || na.endsWith(" " + nb)) return a;     // exact repeat of what we have
  if (nb.startsWith(na + " ") || nb === na) return b;         // cumulative: the new one contains the old
  // Overlap: the new segment starts with the last few words we already have (3 words or more).
  const aw = a.split(" "), bw = b.split(" "), naw = na.split(" "), nbw = nb.split(" ");
  const max = Math.min(naw.length, nbw.length - 1);
  for (let k = max; k >= 3; k--) {
    if (naw.slice(-k).join(" ") === nbw.slice(0, k).join(" ")) return clean(aw.join(" ") + " " + bw.slice(k).join(" "));
  }
  return a + " " + b;
}

// results: an array-like of SpeechRecognitionResult-shaped items ({isFinal, 0: {transcript}} or {isFinal, transcript}).
export function readResults(results) {
  let fin = "", interim = "";
  const n = results ? results.length : 0;
  for (let i = 0; i < n; i++) {
    const x = results[i]; if (!x) continue;
    const t = clean(x.transcript != null ? x.transcript : (x[0] && x[0].transcript));
    if (!t) continue;
    if (x.isFinal) fin = mergeText(fin, t); else interim = mergeText(interim, t);
  }
  return { final: fin, interim };
}

// Keeps the whole utterance across recogniser restarts.
export class Transcript {
  constructor() { this.committed = ""; this.final = ""; this.interim = ""; }
  // Called with the full ev.results of the current recogniser session (Chrome resends the whole list).
  update(results) {
    const before = this.text();
    const r = readResults(results);
    this.final = r.final; this.interim = r.interim;
    return this.text() !== before;
  }
  // The recogniser ended (Android does this by itself). Keep everything heard so far, interim too.
  endSession() {
    this.committed = mergeText(this.committed, mergeText(this.final, this.interim));
    this.final = ""; this.interim = "";
  }
  finalText() { return mergeText(this.committed, this.final); }
  text() { return mergeText(this.finalText(), this.interim); }
  hasText() { return !!this.text(); }
}

// Silence timer decision. Nothing is sent before Peter has said something.
export function silenceState({ now, lastSpeechAt, pause, hasText }) {
  if (!hasText || pause == null || !lastSpeechAt) return { action: "wait", remaining: null, fraction: 0 };
  const left = Math.max(0, pause - (now - lastSpeechAt));
  return left <= 0 ? { action: "send", remaining: 0, fraction: 1 } : { action: "wait", remaining: left, fraction: 1 - left / pause };
}

// What to do when the recogniser fires onend.
// finishing: Peter tapped to finish, or the silence timer fired. cancelled: listening was aborted.
export function onEndDecision({ finishing, cancelled, error, hasText, idleRestarts = 0 }) {
  if (cancelled) return "discard";
  if (finishing) return hasText ? "send" : "stop";
  if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture" || error === "network") return hasText ? "send" : "stop";
  if (!hasText && error === "no-speech") return "stop";       // nothing said at all: keep the old talk-mode retry logic
  if (idleRestarts >= MAX_IDLE_RESTARTS) return hasText ? "send" : "stop";
  return "restart";                                          // Android ended by itself mid-thought: keep listening
}

export function listeningNote({ pause, remaining, talk }) {
  const t = talk ? " Talk mode is on." : "";
  if (remaining != null && remaining > 0) {
    const s = Math.max(1, Math.ceil(remaining / 1000));
    return "Still listening. Sending in " + (s === 1 ? "1 second" : s + " seconds") + " unless you keep talking. Tap the mic to send now." + t;
  }
  if (pause == null) return "Listening. Take your time, and tap the mic when you've finished." + t;
  return "Listening. I'll send after a " + (pause / 1000) + " second pause, or tap the mic to send now." + t;
}
