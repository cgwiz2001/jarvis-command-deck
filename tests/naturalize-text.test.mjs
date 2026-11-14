// node tests/naturalize-text.test.mjs  — checks naturalizeText() (screen) and naturalize() (speech)
import { naturalizeText, naturalize } from "../readout.js";
const now = new Date("2026-11-14T13:00:00Z");
let fail = 0, pass = 0;
const eq = (got, want, label) => { if (got === want) pass++; else { fail++; console.log("FAIL", label || "", "\n  got:  " + got + "\n  want: " + want); } };
const has = (got, frag, label) => { if (got.includes(frag)) pass++; else { fail++; console.log("FAIL has", label || "", "\n  got:  " + got + "\n  want fragment: " + frag); } };
const not = (got, frag, label) => { if (!got.includes(frag)) pass++; else { fail++; console.log("FAIL not", label || "", "\n  got:  " + got + "\n  unwanted: " + frag); } };
const T = x => naturalizeText(x, { now });

// dates and times
eq(T("14 Nov 10:34 GMT: Sped up the router."), "14 November at 10:34 am: Sped up the router.");
eq(T("13 Nov 21:57 GMT: Replied"), "13 November at 9:57 pm: Replied");
eq(T("Inbox count 14 Nov 12:30: 7 messages"), "Inbox count 14 November at 12:30 pm: seven messages");
eq(T("Sat 14 Nov ~6:25am GMT: Emelia"), "Saturday 14 November at around 6:25 am: Emelia");
eq(T("Weekly check 9 Nov: done"), "Weekly check 9 November: done");
eq(T("Leon (00:34 GMT): Idle"), "Leon (12:34 am): Idle");
eq(T("cleared it at 06:00"), "cleared it at 6:00 am");
eq(T("updated 16:28 GMT today"), "updated 4:28 pm today");
eq(T("Jarvis (12:33 pm London): Done."), "Jarvis (12:33 pm): Done.");
eq(T("7 emails as of 12:30 pm London time."), "seven emails as of 12:30 pm.");
eq(T("at 2026-11-14T10:34:33Z"), "at 14 November 2026 at 10:34 am");
eq(T("Spend 8-14 Nov: x"), "Spend 8 to 14 November: x");
eq(T("(30–31 Oct; all passed)"), "(30 to 31 October; all passed)");
eq(T("booking (Tue 17 Nov) looks"), "booking (Tuesday 17 November) looks");
eq(T("Fri 13 Nov in brief."), "Friday 13 November in brief.");
eq(T("Emelia Sat morning folded"), "Emelia Saturday morning folded");
eq(T("Amelia (5 Nov 04:48 GMT): still"), "Amelia (5 November at 4:48 am): still");
eq(T("Nov 14, 2026"), "14 November 2026");
eq(T("run at 6pm"), "run at 6 pm");
eq(T("ready by 9:05 AM"), "ready by 9:05 am");
eq(T("12 Jul 2026 14:00 UTC"), "12 July 2026 at 3:00 pm", "BST conversion in summer");
eq(T("23:30 UTC"), "11:30 pm", "a lone clock converts using today's date (GMT in November)");

eq(T("YouCut £9.99 by 16 Nov. Blocked: x"), "YouCut £9.99 by 16 November. Blocked: x", "sentence full stop kept");
eq(T("see you Sat."), "see you Saturday.");

// false-positive guards (screen keeps them exactly)
for (const keep of ["v1.8.159", "v4.0.106", "v1.8.141–v1.8.159", "5e77322", "03004968", "£199.02", "US$236.35", "£22.75", "636.5 mi", "HTTP 202", "MT5", "UtilityPC-2", "pixiegrokbot2026", "rmwgdst97", "$68.5k", "-4.2%", "12-week low", "145 GB", "Tip #51", "HUD v19.35"])
  has(T("x " + keep + " y"), keep, "keep " + keep);
eq(T("2 may be late"), "two may be late", "lowercase may is not a month");
eq(T("ratio 4:3 kept"), "ratio 4:3 kept");
eq(T("about 30 to 40 seconds"), "about 30 to 40 seconds");
eq(T("31 Second Brain note moves"), "31 Second Brain note moves");
eq(T("Personal £199.02/8, Work £22.75, 636.5 mi"), "Personal £199.02/8, Work £22.75, 636.5 mi");

// speech
const sp = naturalize;
has(sp("Sat 14 Nov ~6:25am GMT: ok"), "Saturday 14 November at around 6:25 am");
has(sp("Leo (21:57 GMT): idle"), "9:57 pm");
has(sp("v4.0.106 passed"), "version four point zero point one hundred and six");
has(sp("Autoglass 03004968 still"), "zero three zero zero four nine six eight");
has(sp("MT5 net US$236.35"), "two hundred and thirty-six dollars thirty-five");
has(sp("UtilityPC-2 is offline"), "UtilityPC 2 is offline");
not(sp("UtilityPC-2 is offline"), "minus");
has(sp("31 Second Brain note moves (HTTP 202)"), "thirty-one Second Brain");
has(sp("HTTP 202"), "HTTP two oh two");
has(sp("636.5 mi"), "six hundred and thirty-six point five miles");
has(sp("about 30-40 seconds"), "thirty to forty seconds");
has(sp("Tip #51 sent"), "number fifty-one");

// live notes (passed as JSON file paths) must not lose protected tokens
import fs from "fs";
const files = process.argv.slice(2);
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  const items = d.bots ? d.bots.map(b => b.note) : (d.requests || []).map(r => r.reply);
  for (const raw of items.filter(Boolean)) {
    const out = T(raw);
    for (const tok of raw.match(/\bv\d+(?:\.\d+)+|\b[0-9a-f]{7}\b|\b0\d{5,}\b|(?:US)?[£$]\d[\d,.]*\d|\b\d+(?:\.\d+)? mi\b|HTTP \d{3}/g) || []) has(out, tok, "live keep " + tok);
    not(out, " GMT", "live zone dropped"); not(out, "~", "live tilde");
    if (process.env.SHOW) console.log("BEFORE: " + raw + "\nAFTER:  " + out + "\n");
  }
}
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
