// node tests/listen.test.mjs  — checks continuous speech input: pauses, Android restarts, dedupe, silence timer
import { mergeText, readResults, Transcript, silenceState, onEndDecision, pauseMs, pauseValue, listeningNote, PAUSE_OPTIONS, DEFAULT_PAUSE, MAX_IDLE_RESTARTS } from "../listen.js";

let fail = 0, pass = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log("FAIL", label); } };
const eq = (a, b, label) => ok(a === b, label + ` (got ${JSON.stringify(a)})`);
const R = (...xs) => xs.map(([t, f]) => ({ isFinal: !!f, 0: { transcript: t }, length: 1 }));

// mergeText
eq(mergeText("", "hello"), "hello", "empty + text");
eq(mergeText("hello", "hello"), "hello", "exact repeat is not doubled");
eq(mergeText("hello", "Hello."), "hello", "repeat differing only in case and punctuation");
eq(mergeText("hello", "hello how are you"), "hello how are you", "cumulative final replaces the earlier one");
eq(mergeText("can you check the inbox", "check the inbox for Finance Bot"), "can you check the inbox for Finance Bot", "3-word overlap merged");
eq(mergeText("send it to", "to Email Bot"), "send it to to Email Bot", "1-word overlap kept (could be real speech)");
eq(mergeText("tell Finance Bot", "about the invoice"), "tell Finance Bot about the invoice", "plain append");
eq(mergeText("I said yes and", "yes"), "I said yes and yes", "short repeat inside a phrase is kept");

// readResults: desktop style (separate finals) and Android style (repeated / cumulative finals)
eq(readResults(R(["Jarvis ", 1], [" can you check", 1], [" my calendar", 0])).final, "Jarvis can you check", "desktop finals joined");
eq(readResults(R(["Jarvis", 1], [" my calendar", 0])).interim, "my calendar", "interim kept separately");
eq(readResults(R(["Jarvis", 1], ["Jarvis can you", 1], ["Jarvis can you check my calendar", 1])).final, "Jarvis can you check my calendar", "Android cumulative finals deduped");
eq(readResults(R(["hello there", 1], ["hello there", 1], ["general Kenobi", 1])).final, "hello there general Kenobi", "Android repeated final deduped");
eq(readResults([{ isFinal: true, transcript: "plain shape" }]).final, "plain shape", "plain {isFinal, transcript} shape works");

// Transcript across a pause and an unexpected Android onend + restart
const t = new Transcript();
t.update(R(["Jarvis, can you ask Finance Bot", 0]));
eq(t.text(), "Jarvis, can you ask Finance Bot", "live interim shown while talking");
t.update(R(["Jarvis, can you ask Finance Bot", 1]));
eq(t.text(), "Jarvis, can you ask Finance Bot", "final replaces interim without doubling");
t.endSession();   // Android ended by itself during a pause
eq(t.text(), "Jarvis, can you ask Finance Bot", "text kept after onend");
t.update(R(["Jarvis can you ask Finance Bot", 1]));      // Android repeats the earlier final in the new session
eq(t.text(), "Jarvis, can you ask Finance Bot", "repeat after restart is not doubled");
t.update(R(["Jarvis can you ask Finance Bot", 1], ["what I spent on fuel this month", 0]));
eq(t.text(), "Jarvis, can you ask Finance Bot what I spent on fuel this month", "new words after restart are added");
t.update(R(["Jarvis can you ask Finance Bot", 1], ["what I spent on fuel this month", 1]));
t.endSession();
t.update(R(["and put it in my inbox", 1]));
eq(t.text().replace(",", ""), "Jarvis can you ask Finance Bot what I spent on fuel this month and put it in my inbox", "three sessions make one full message");
eq(t.finalText(), t.text(), "finalText matches when nothing is interim");
const t2 = new Transcript(); t2.update(R(["half a sentence", 0])); t2.endSession();
eq(t2.text(), "half a sentence", "interim words survive an onend");
const t3 = new Transcript(); ok(t3.update(R(["a", 0])) === true && t3.update(R(["a", 0])) === false, "update reports whether the text changed");

// silence timer
const P = 2500;
eq(silenceState({ now: 10000, lastSpeechAt: 0, pause: P, hasText: false }).action, "wait", "never sends before anything is said");
eq(silenceState({ now: 10000, lastSpeechAt: 9000, pause: P, hasText: true }).action, "wait", "a 1 second pause does not send");
eq(silenceState({ now: 10000, lastSpeechAt: 9000, pause: P, hasText: true }).remaining, 1500, "remaining time reported for the ring");
ok(Math.abs(silenceState({ now: 10000, lastSpeechAt: 9000, pause: P, hasText: true }).fraction - 0.4) < 1e-9, "ring fraction");
eq(silenceState({ now: 10000, lastSpeechAt: 7500, pause: P, hasText: true }).action, "send", "sends after 2.5 seconds of quiet");
eq(silenceState({ now: 99999, lastSpeechAt: 1, pause: null, hasText: true }).action, "wait", "tap-only mode never sends on its own");

// onend decisions
eq(onEndDecision({ finishing: false, cancelled: false, error: "", hasText: true }), "restart", "Android early end with text: restart, keep listening");
eq(onEndDecision({ finishing: false, cancelled: false, error: "", hasText: false }), "restart", "Android early end before speaking: restart");
eq(onEndDecision({ finishing: false, cancelled: false, error: "no-speech", hasText: true }), "restart", "no-speech after words in tap mode: keep listening");
eq(onEndDecision({ finishing: false, cancelled: false, error: "no-speech", hasText: false }), "stop", "nothing said at all: stop as before");
eq(onEndDecision({ finishing: true, cancelled: false, error: "", hasText: true }), "send", "tap to finish sends");
eq(onEndDecision({ finishing: true, cancelled: false, error: "", hasText: false }), "stop", "tap to finish with nothing said");
eq(onEndDecision({ finishing: false, cancelled: true, error: "aborted", hasText: true }), "discard", "aborted turn is discarded");
eq(onEndDecision({ finishing: false, cancelled: false, error: "not-allowed", hasText: false }), "stop", "blocked mic stops");
eq(onEndDecision({ finishing: false, cancelled: false, error: "network", hasText: true }), "send", "network error sends what was heard");
eq(onEndDecision({ finishing: false, cancelled: false, error: "", hasText: true, idleRestarts: MAX_IDLE_RESTARTS }), "send", "restart loop is capped");

// setting
eq(DEFAULT_PAUSE, "2.5", "default pause is 2.5 seconds");
eq(pauseMs(null), 2500, "unset uses 2.5 seconds");
eq(pauseMs("1.5"), 1500, "1.5 seconds"); eq(pauseMs("4"), 4000, "4 seconds"); eq(pauseMs("tap"), null, "tap only");
eq(pauseMs("junk"), 2500, "bad value falls back"); eq(pauseValue("junk"), "2.5", "bad value shows the default");
ok(PAUSE_OPTIONS.length === 4 && PAUSE_OPTIONS.every(o => /^[A-Z]/.test(o.label) && !/ms\b|sec\b/.test(o.label)), "plain option labels");
ok(/Sending in 2 seconds/.test(listeningNote({ pause: 2500, remaining: 1400, talk: false })), "countdown note");
ok(/tap the mic when you've finished/.test(listeningNote({ pause: null, remaining: null, talk: false })), "tap-only note");
ok(/2\.5 second pause/.test(listeningNote({ pause: 2500, remaining: null, talk: true })) && /Talk mode is on/.test(listeningNote({ pause: 2500, remaining: null, talk: true })), "listening note");

console.log(`listen: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
