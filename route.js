// Request routing helpers for the Command Deck (v2.6.18). Pure functions, tested in node.
// Before v2.6.18 the deck could only queue a job for ONE named crew member. A request for
// "every bot" or "all the bots" had no route, so nothing reached the Inbox, while Jarvis's
// spoken reply still said he'd asked them.

const BOTS = String.raw`(?:bots?|parts?|crew(?: members?)?|team|agents?)`;
// A verb that passes work on, followed (soon) by every/each/all ... bots, or by "the bots/crew".
const VERB = String.raw`(?:ask|tell(?! me\b)|get(?! me\b)|request|message|ping|have|make|brief|remind|instruct|check (?:in )?with|contact|send|chase|nudge|poll|update|let)`;
const RE_ALL = [
  new RegExp(String.raw`\b${VERB}\b[^.?!]{0,60}?\b(?:every|each|all(?: of)?(?: the| my| your)?)\s+(?:single\s+|one\s+of\s+the\s+)?${BOTS}\b`, "i"),
  new RegExp(String.raw`\b${VERB}\b[^.?!]{0,30}?\b(?:the|my|your)\s+(?:whole\s+|entire\s+)?(?:bots|crew|team|agents)\b`, "i"),
  new RegExp(String.raw`\b(?:from|to)\s+(?:every|each|all(?: of)?(?: the| my)?)\s+${BOTS}\b`, "i"),
  new RegExp(String.raw`\b(?:every|each|all(?: of)?(?: the| my)?)\s+${BOTS}\s+(?:to|should|must|needs? to)\s+\w`, "i")
];
// True when the user is asking for something to go to the whole crew (not a question about them).
export function isBroadcastRequest(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  // A question about the crew ("what would it take to get an update from the bots?") is not a request.
  const body = t.replace(/^(?:jarvis|so|ok(?:ay)?|right|and|well|hey)[,\s]+/gi, "").replace(/^(?:jarvis|so|ok(?:ay)?|right|and|well)[,\s]+/gi, "");
  if (/^(?:what|how|why|when|where|who|which|is|are|was|were|do|does|did|have you|has|would it|is it)\b/i.test(body) && !/\b(?:can|could|would|will) you\b|\bplease\b/i.test(t)) return false;
  return RE_ALL.some(re => re.test(t));
}

const ALL_NAMES = /^(?:all|everyone|everybody|every bot|each bot|all bots|all the bots|crew|the crew|whole crew|the whole crew|all crew|team|the team|broadcast)$/i;
// The model may answer with {"route": {"bot": "all", "task": "..."}}.
export function isAllRouteName(name) { return ALL_NAMES.test(String(name || "").trim()); }

// One Inbox item per crew member, written in a single PATCH.
export function broadcastItems(task, names, nowMs) {
  const base = "r" + Number(nowMs).toString(36), at = new Date(nowMs).toISOString();
  return names.map((name, k) => ({ id: base + String.fromCharCode(97 + (k % 26)), createdAt: at, text: task, status: "new", routedTo: name, reply: null, repliedAt: null }));
}

// Jarvis sometimes says "I've asked each bot" or "I'll ask Data and Files Bot" when nothing was queued.
const ASK_CLAIM = /\b(?:i(?:'ve|’ve| have)\s+(?:already\s+)?(?:asked|messaged|pinged|contacted|told|requested)|i(?:'ll|’ll| will)\s+(?:now\s+)?(?:ask|message|ping|contact|tell|request))\b/i;
export function claimsUnsentAsk(reply) { return ASK_CLAIM.test(String(reply || "")); }
export const NOT_SENT_LINE = "I haven't sent anything to the crew yet. Ask me to send it to a named bot, or to every bot, and I'll queue it.";

export function crewCountWords(n) {
  const w = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  return w[n] || String(n);
}
export function broadcastLine(n, confirmed) {
  const who = "all " + crewCountWords(n) + " crew bots";
  if (confirmed === false) return "I queued that for " + who + ", but I couldn't confirm it in the Inbox yet.";
  return "I've sent that to " + who + ". Each one has its own item in the Inbox, queued for instant routing through Second Brain.";
}

// Plain failure messages with a retry, keeping the text.
export function failureText(kind, name) {
  if (kind === "ask") return "Couldn't send that to Jarvis. Tap to retry.";
  if (name === "all") return "Couldn't send that to the crew's Inbox. Tap to retry.";
  if (name) return "Couldn't send that to " + name + ". Tap to retry.";
  return "Couldn't add that to Jarvis's Inbox. Tap to retry.";
}
