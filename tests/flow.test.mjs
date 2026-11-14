// node tests/flow.test.mjs  — checks which events fire outbound vs inbound beams
import { inboxFlowEvents, statusFlowEvents, botStatusSig, seenSnapshot } from "../flow.js";

let fail = 0, pass = 0;
const eq = (got, want, label) => { if (got === want) pass++; else { fail++; console.log("FAIL", label || "", "\n  got:  " + JSON.stringify(got) + "\n  want: " + JSON.stringify(want)); } };
const dirs = evs => evs.map(e => e.dir + (e.delay ? "@" + e.delay : "") + ":" + e.reason).join(",");

const item = (status, extra = {}) => ({ id: "r1", status, routedTo: "Leo", reply: null, repliedAt: null, ...extra });

eq(dirs(inboxFlowEvents("new", item("routed"), 7)), "out:routed", "new to routed is outbound");
eq(dirs(inboxFlowEvents({ status: "new" }, item("routed"), 7)), "out:routed", "object snapshot new to routed is outbound");
eq(dirs(inboxFlowEvents("routed", item("answered", { reply: "Done." }), 7)), "in:answered", "routed to answered is inbound only");
eq(dirs(inboxFlowEvents("new", item("answered", { reply: "Done." }), 7)), "out:routed,in@2400:answered", "new to answered plays the missed outbound then inbound");
eq(dirs(inboxFlowEvents(undefined, item("routed"), 7)), "out:routed", "first sighting as routed is outbound");
eq(dirs(inboxFlowEvents({ status: "answered", reply: "" }, item("answered", { reply: "Here is the figure." }), 7)), "in:reply", "a later reply on an already-answered item is inbound");
eq(dirs(inboxFlowEvents({ status: "answered", reply: "Here is the figure." }, item("answered", { reply: "Here is the figure." }), 7)), "", "unchanged answered item is quiet");
eq(dirs(inboxFlowEvents("answered", item("answered", { reply: "Here is the figure." }), 7)), "", "legacy string snapshot does not replay inbound on upgrade");
eq(dirs(inboxFlowEvents("new", item("answered"), 0)), "core:answered-core", "a Jarvis-only answer flares the core, not a crew beam");
eq(dirs(inboxFlowEvents("new", item("routed"), 0)), "", "no outbound crew beam when there is no crew bot");

const sig = b => botStatusSig(b);
const bot = (note, at = "2026-11-14T16:00:00Z") => ({ name: "Leo", state: "idle", note, updatedAt: at });
eq(dirs(statusFlowEvents(null, sig(bot("Hello")), 7)), "", "first sighting of a bot is quiet");
eq(dirs(statusFlowEvents(sig(bot("Hello")), sig(bot("Hello")), 7)), "", "unchanged status is quiet");
eq(dirs(statusFlowEvents(sig(bot("Hello")), sig(bot("Updated the note")), 7)), "in:status", "a bot status note change is inbound");
eq(dirs(statusFlowEvents(sig(bot("Hello", "t1")), sig(bot("Hello", "t2")), 7)), "in:status", "a bot updatedAt change is inbound");
eq(dirs(statusFlowEvents(sig(bot("Hello")), sig(bot("Hello")), 0)), "", "Jarvis's own status line does not fire a crew beam");
eq(seenSnapshot(item("answered", { reply: "Hi" })).status, "answered", "snapshot keeps status");
eq(seenSnapshot(item("answered", { reply: "Hi" })).reply, "Hi", "snapshot keeps reply");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
