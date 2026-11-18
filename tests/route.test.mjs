// node tests/route.test.mjs  — checks that "every bot" requests are queued for the whole crew
import { isBroadcastRequest, isAllRouteName, broadcastItems, claimsUnsentAsk, broadcastLine, failureText, NOT_SENT_LINE } from "../route.js";

let fail = 0, pass = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log("FAIL", label); } };

// Peter's real requests from Wednesday 18 November (History note), which never reached the Inbox
ok(isBroadcastRequest("Jarvis, can you get fresh updates from every bot and are at them if there are any? If there is anything outstanding from me?"), "get fresh updates from every bot");
ok(isBroadcastRequest("Case, can you ask every bot to submit their latest status?"), "ask every bot to submit their latest status");
// other ways of saying it
for (const s of ["can you ask all the bots to update their status", "Have the bots update their status", "ask the crew for an update", "tell every bot to stand down",
  "please ask each bot what it's working on", "ping all of the bots for a status update", "every bot should send me its status", "get an update from all the bots", "Can you ask every part for an update?"])
  ok(isBroadcastRequest(s), "broadcast: " + s);
// questions and single-bot requests are not broadcasts
for (const s of ["Can you tell me what every bot is doing?", "what are all the bots doing", "Jarvis, are you actually asking the bots now for their latest update",
  "So what would be required to get a fresh update from the bots as of now?", "ask Finance Bot what I spent", "I'm checking on all the parts and.", "", "thanks", "How are the bots receiving messages from their inbox?"])
  ok(!isBroadcastRequest(s), "not broadcast: " + JSON.stringify(s));

// route names the model may return
for (const n of ["all", "All", "everyone", "every bot", "all bots", "the crew", "crew"]) ok(isAllRouteName(n), "all-route name " + n);
for (const n of ["Finance Bot", "Leo", "", null, "allison"]) ok(!isAllRouteName(n), "not all-route " + n);

// items: one per bot, unique ids, Inbox shape
const names = ["Dashboard Bot", "Finance Bot", "Marketing Bot", "Email Bot", "Data and Files Bot", "Business Bot", "Leo", "Leona", "Leon", "PC Health Bot"];
const items = broadcastItems("Please post your latest status", names, Date.UTC(2026, 10, 18, 0, 14));
ok(items.length === 10, "ten items");
ok(new Set(items.map(x => x.id)).size === 10 && items.every(x => /^r[0-9a-z]+[a-z]$/.test(x.id)), "unique ids");
ok(items.every((x, k) => x.routedTo === names[k] && x.status === "new" && x.text === "Please post your latest status" && x.reply === null && x.repliedAt === null), "item fields");
ok(items.every(x => x.createdAt === "2026-11-18T00:14:00.000Z"), "createdAt");

// honest replies when nothing was queued
ok(claimsUnsentAsk("Peter, I've asked each bot for fresh updates and checked for anything waiting on you."), "catches 'I've asked each bot'");
ok(claimsUnsentAsk("I'll ask Data and Files Bot to confirm exactly where that file lives."), "catches 'I'll ask'");
ok(!claimsUnsentAsk("Finance Bot tracks your spend at one hundred pounds."), "no false claim");
ok(/haven't sent anything/.test(NOT_SENT_LINE), "not-sent line is plain");
ok(/all ten crew bots/.test(broadcastLine(10, true)) && /couldn't confirm/.test(broadcastLine(10, false)), "broadcast lines");
ok(failureText("ask") === "Couldn't send that to Jarvis. Tap to retry.", "Jarvis failure text");
ok(failureText("queue", "Finance Bot") === "Couldn't send that to Finance Bot. Tap to retry.", "bot failure text");
ok(/crew's Inbox/.test(failureText("queue", "all")) && /Jarvis's Inbox/.test(failureText("queue", "")), "crew and inbox failure text");

console.log(`route: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
