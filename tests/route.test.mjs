// node tests/route.test.mjs  — checks that "every bot" requests are queued for the whole crew
import { isBroadcastRequest, isAllRouteName, isSelfRouteName, isSelfJob, confirmationTarget, sanitizeReply, nameList, botLine, selfLine, alreadySentLine, pendingValid, PENDING_MS, broadcastItems, claimsUnsentAsk, broadcastLine, failureText, NOT_SENT_LINE } from "../route.js";

let fail = 0, pass = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log("FAIL", label); } };
const eq = (a, b, label) => ok(a === b, label + ` (got ${JSON.stringify(a)})`);

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
ok(/haven't sent this to anyone yet/.test(NOT_SENT_LINE) && /straight away\.$/.test(NOT_SENT_LINE), "not-sent line is plain and complete");
ok(/^I've sent this to all ten bots: Dashboard Bot, Finance Bot, .* and PC Health Bot\. Each one has its own item in the Inbox now\.$/.test(broadcastLine(10, true, names)), "broadcast line names every bot");
ok(/couldn't confirm/.test(broadcastLine(10, false)), "broadcast line, unconfirmed");

// ---- v2.6.19: Peter's exact phrasings from 1:02 am on Wednesday 18 November ----
for (const s of ["ask the bot for their names", "ask the bots for their names", "ask them for their names", "ask everyone for their names", "ask everybody for their current names",
  "ask the crew for their names", "ask all of them for their names", "tell the team to post their status", "can you ask each of them what they're called"])
  ok(isBroadcastRequest(s), "whole-crew phrasing: " + s);
ok(!isBroadcastRequest("ask the bot for its report", true), "'the bot' with a named crew member is not a broadcast");
ok(isBroadcastRequest("ask every bot and Finance Bot too", true), "explicit every bot still wins");
// short follow-ups
for (const s of ["every bot", "Every bot.", "every bots", "all of them", "everyone", "everybody", "the crew", "the bots", "all bots", "all ten", "to all of them", "Yes, every bot", "yes, all of them please", "send it to every bot", "ask them", "ask the bots", "ask every bot"])
  ok(confirmationTarget(s) === "all", "follow-up means every bot: " + s);
for (const s of ["yes", "Yes please", "send it", "do it", "go ahead", "ok", "please do", "yes, send it", "Jarvis, do it"])
  ok(confirmationTarget(s) === "same", "follow-up means go ahead: " + s);
for (const s of ["no", "what's the time?", "can you update the bot directory note", "tell me a joke", "", "ask Finance Bot what I spent last week on fuel and on the car"])
  ok(confirmationTarget(s) === null, "not a follow-up: " + JSON.stringify(s));
// pending request lifetime
ok(pendingValid({ task: "x", at: 1000 }, 1000 + PENDING_MS - 1) && !pendingValid({ task: "x", at: 1000 }, 1000 + PENDING_MS) && !pendingValid(null, 1), "pending request lasts fifteen minutes");

// self jobs: Jarvis does Second Brain edits himself, via his own Inbox
ok(isSelfJob("can you update the following file (bot directory- who does what) in second brain twith the updated bot names"), "Peter's directory request is a job for Jarvis");
for (const s of ["update the bot directory note with the new names", "rename Financia to Finance Bot in the who does what note", "add a line to the shopping list note", "the bot directory needs updating"])
  ok(isSelfJob(s), "self job: " + s);
for (const s of ["ask Finance Bot to update the expenses note", "what's in the bot directory note?", "ask every bot to update their status note", "tell me a joke"])
  ok(!isSelfJob(s, /Finance Bot/.test(s)), "not a self job: " + s);
for (const n of ["Jarvis", "jarvis", "me", "myself", "self"]) ok(isSelfRouteName(n), "self route name " + n);
ok(!isSelfRouteName("Leo") && !isSelfRouteName("all"), "other names are not self");

// honest replies: claims and parroted lines are removed as whole sentences, nothing is cut mid-sentence
const t2 = "Peter, I've asked every bot to reply with their exact current crew name so we can update the directory. They'll drop those into the inbox shortly. I haven't sent anything to the crew yet. Ask me to send it to a named bot, or to every bot, and I'll queue it.";
eq(sanitizeReply(t2), "", "turn 2 reply: every false claim and parroted line removed");
const t3 = "Peter, a request to every bot asking for their exact current crew name so we can update the directory. They'll drop those into the inbox shortly. I haven't sent anything to the crew yet. Ask me to send it to a named bot, or to every bot, and .";
eq(sanitizeReply(t3), "", "turn 3 reply: nothing truncated is left behind");
eq(sanitizeReply("Peter, I don't have the file contents or the exact updated bot names yet. Paste them here and I'll update the bot directory note in Second Brain for you."), "", "never asks Peter to paste");
eq(sanitizeReply("Finance Bot will pull last week's spend. It covers personal and work."), "Finance Bot will pull last week's spend. It covers personal and work.", "plain description kept");
eq(sanitizeReply("It's just after midnight."), "It's just after midnight.", "chat kept");
ok(!/\band \.$/.test(sanitizeReply(t3) + " " + NOT_SENT_LINE), "no 'and .' ending");
eq(nameList(["A", "B", "C"]), "A, B and C", "name list");
eq(botLine("Finance Bot", true), "I've sent this to Finance Bot. It's in the Inbox now.", "named bot line");
ok(/my own Inbox/.test(selfLine(true)) && /read the notes and the current bot names myself/.test(selfLine(true)), "self line");
eq(alreadySentLine("all ten bots", "1:02 am"), "That's already gone to all ten bots at 1:02 am, so I haven't sent it again.", "already sent line");
ok(failureText("ask") === "Couldn't send that to Jarvis. Tap to retry.", "Jarvis failure text");
ok(failureText("queue", "Finance Bot") === "Couldn't send that to Finance Bot. Tap to retry.", "bot failure text");
ok(/crew's Inbox/.test(failureText("queue", "all")) && /Jarvis's Inbox/.test(failureText("queue", "")), "crew and inbox failure text");

console.log(`route: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
