// Request routing helpers for the Command Deck (v2.6.18). Pure functions, tested in node.
// Before v2.6.18 the deck could only queue a job for ONE named crew member. A request for
// "every bot" or "all the bots" had no route, so nothing reached the Inbox, while Jarvis's
// spoken reply still said he'd asked them.

const BOTS = String.raw`(?:bots?|parts?|crew(?: members?)?|team|agents?)`;
// A verb that passes work on.
const VERB = String.raw`(?:ask|tell(?! me\b)|get(?! me\b)|request|message|ping|have|make|brief|remind|instruct|check (?:in )?with|contact|send|chase|nudge|poll|update|let|find out from)`;
// Strong: every/each/all/everyone/whole crew. Always means the whole crew.
const STRONG = [
  new RegExp(String.raw`\b${VERB}\b[^.?!]{0,60}?\b(?:every|each|all(?: of)?(?: the| my| your)?)\s+(?:single\s+|one\s+of\s+the\s+)?${BOTS}\b`, "i"),
  new RegExp(String.raw`\b${VERB}\b[^.?!]{0,30}?\b(?:everyone|everybody|all of them|each of them|every one of them|the whole (?:crew|team)|the entire (?:crew|team)|the lot)\b`, "i"),
  new RegExp(String.raw`\b(?:from|to)\s+(?:every|each|all(?: of)?(?: the| my)?)\s+${BOTS}\b`, "i"),
  new RegExp(String.raw`\b(?:from|to)\s+(?:everyone|everybody|all of them|each of them)\b`, "i"),
  new RegExp(String.raw`\b(?:every|each|all(?: of)?(?: the| my)?)\s+${BOTS}\s+(?:to|should|must|needs? to)\s+\w`, "i")
];
// Weak: "the bot", "the bots", "the crew", "them". Whole crew only when no crew member is named.
const WEAK = [
  new RegExp(String.raw`\b${VERB}\b[^.?!]{0,30}?\b(?:the|my|your)\s+(?:whole\s+|entire\s+)?(?:bots?|crew|team|agents?|parts?)\b(?!['’]?s?\s+(?:directory|note|notes|file|list|roster|page|doc|document|folder))`, "i"),
  new RegExp(String.raw`\b(?:ask|tell(?! me\b)|message|ping|brief|remind|chase|nudge)\s+them\b`, "i")
];
const isQuestion = t => {
  const body = t.replace(/^(?:(?:jarvis|so|ok(?:ay)?|right|and|well|hey)[,\s]+)+/gi, "");
  return /^(?:what|how|why|when|where|who|which|is|are|was|were|do|does|did|have you|has|would it|is it)\b/i.test(body) && !/\b(?:can|could|would|will) you\b|\bplease\b/i.test(t);
};
// True when the user is asking for something to go to the whole crew (not a question about them).
// crewNamed: the message names a specific crew member, so weak phrasings ("the bot") mean that one.
export function isBroadcastRequest(text, crewNamed = false) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || isQuestion(t)) return false;
  if (STRONG.some(re => re.test(t))) return true;
  return !crewNamed && WEAK.some(re => re.test(t));
}

// Work Jarvis does himself in Second Brain (edit a note, update the directory, tidy a file).
const SELF_VERB = String.raw`(?:update|edit|change|rename|fix|correct|add|append|rewrite|tidy|reorganise|reorganize|move|create|make|write|refresh|amend|replace)`;
const SELF_THING = String.raw`(?:note|notes|file|doc|document|directory|page|list|folder|second brain|bot status|roster)`;
export function isSelfJob(text, crewNamed = false) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || crewNamed || isQuestion(t) || isBroadcastRequest(t)) return false;
  return new RegExp(String.raw`\b${SELF_VERB}\b[^.?!]{0,90}?\b${SELF_THING}\b`, "i").test(t)
    || new RegExp(String.raw`\b${SELF_THING}\b[^.?!]{0,60}?\b(?:needs?|should) (?:to )?(?:be )?(?:updat|chang|edit|fix|renam)`, "i").test(t);
}

// A short follow-up that confirms the pending request. "all": send to every bot. "same": the target already named.
export function confirmationTarget(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim().replace(/^(?:jarvis|case)[,\s]+/i, "");
  if (!t || t.split(" ").length > 9) return null;
  if (/^(?:(?:yes|yeah|yep|yup|ok(?:ay)?|sure|please|right)[,!. ]+)?(?:(?:send|queue|do|ask|give) (?:it|that|this|them)?\s*)?(?:to |for )?(?:every ?bot|every bots|every one(?: of them)?|everyone|everybody|all(?: of)?(?: them| the bots| bots| ten(?: bots)?| the crew)?|each (?:bot|of them|one)|the (?:whole |entire )?(?:crew|team|bots)|all crew)(?: please| then| now)?[.!]*$/i.test(t)) return "all";
  if (t.split(" ").length <= 6 && /^(?:(?:yes|ok(?:ay)?|please)[,!. ]+)?(?:can you |could you |please )?(?:ask|send (?:it|that|this) to|tell|message) (?:the bots?|them|every ?bot|every one of them|everyone|everybody|all of them|all the bots|the (?:whole )?crew)(?: please| then| now)?[.!?]*$/i.test(t)) return "all";
  if (/^(?:yes|yeah|yep|yup|ok(?:ay)?|sure|please|please do|go ahead|go on|do it|do that|send it|send that|send them|queue it|yes please|go for it|make it so|that's right|correct)(?:[,!. ]+(?:please|now|then|do it|send it|go ahead|thanks))*[.!]*$/i.test(t)) return "same";
  return null;
}

// The deck's own reply sanitiser: drop whole sentences that claim a job was sent or will be answered,
// that parrot the deck's outcome lines, or that ask Peter to paste what's already in Second Brain.
const CLAIM = [
  /\b(?:i(?:'ve|’ve| have| had)|i(?:'ll|’ll| will)|i'm|i’m|i am|let me)\b[^.?!]{0,80}\b(?:ask(?:ed|ing)?|sen[dt](?:ing)?|queu(?:e|ed|ing)|rout(?:e|ed|ing)|pass(?:ed|ing)? (?:it|that|this|on)|messag(?:e|ed|ing)|ping(?:ed|ing)?|contact(?:ed|ing)?|request(?:ed|ing)?|forward(?:ed|ing)?|notif(?:y|ied)|told|tell(?:ing)?)\b/i,
  /\b(?:they(?:'ll|’ll| will)|it(?:'ll|’ll| will)|each (?:bot|one) will|the bots will|they should|expect)\b[^.?!]{0,80}\b(?:reply|replies|drop|respond|get back|come back|pick (?:it|that|this) up|land|arrive)\b/i,
  /^(?:peter, )?a request to (?:every|each|all)\b/i,
  /\b(?:haven't sent anything|ask me to send|queued for instant routing|has its own item|in the inbox now|i've sent this to|already been sent)\b/i,
  /\bpaste\b/i,
  /\b(?:i don't|i do not|i don’t|i can't|i cannot|i can’t) (?:have|see|access|read|open|get)\b[^.?!]{0,60}\b(?:file|note|contents|names|second brain|directory)\b/i
];
export function sanitizeReply(reply) {
  const parts = String(reply || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*/g) || [];
  return parts.map(x => x.trim()).filter(x => x && !CLAIM.some(re => re.test(x))).join(" ").replace(/\s+/g, " ").trim();
}

export function nameList(names) {
  const n = names.filter(Boolean);
  return n.length < 2 ? (n[0] || "") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
}

const SELF_NAMES = /^(?:jarvis|me|myself|self|jarvis \(self\)|chief of staff)$/i;
export function isSelfRouteName(name) { return SELF_NAMES.test(String(name || "").trim()); }
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
export const NOT_SENT_LINE = "I haven't sent this to anyone yet. Say every bot, or name a bot, and I'll send it straight away.";

export function crewCountWords(n) {
  const w = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  return w[n] || String(n);
}
// Outcome lines, written by the deck only after the Inbox write succeeded.
export function broadcastLine(n, confirmed, names) {
  const list = names && names.length ? ": " + nameList(names) : "";
  if (confirmed === false) return "I've written this to the Inbox for all " + crewCountWords(n) + " bots" + list + ", but I couldn't confirm the items yet.";
  return "I've sent this to all " + crewCountWords(n) + " bots" + list + ". Each one has its own item in the Inbox now.";
}
export function botLine(name, confirmed) {
  if (confirmed === false) return "I've written this to the Inbox for " + name + ", but I couldn't confirm the item yet.";
  return "I've sent this to " + name + ". It's in the Inbox now.";
}
export function selfLine(confirmed) {
  if (confirmed === false) return "I've written this to my own Inbox as a job for me, but I couldn't confirm the item yet.";
  return "I've added this to my own Inbox as a job for me. I'll do it in Second Brain, where I can read the notes and the current bot names myself.";
}
export function alreadySentLine(who, whenText) {
  return "That's already gone to " + who + (whenText ? " at " + whenText : "") + ", so I haven't sent it again.";
}
export const WHICH_LINE = "Who should get it: every bot, or one bot by name?";

// The last request that wasn't sent, so a short follow-up ("every bot", "yes") can send it.
export const PENDING_MS = 15 * 60 * 1000;
export function pendingValid(p, now) { return !!(p && p.task && now - p.at < PENDING_MS); }

// Plain failure messages with a retry, keeping the text.
export function failureText(kind, name) {
  if (kind === "ask") return "Couldn't send that to Jarvis. Tap to retry.";
  if (name === "all") return "Couldn't send that to the crew's Inbox. Tap to retry.";
  if (name) return "Couldn't send that to " + name + ". Tap to retry.";
  return "Couldn't add that to Jarvis's Inbox. Tap to retry.";
}
