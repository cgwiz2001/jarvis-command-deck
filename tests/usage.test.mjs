// node tests/usage.test.mjs  — checks usage gauge copy, tone and money formatting
import { parseUsage, usageTone, usagePercentLabel, usageRingOffset, formatMoneyUSD, usageHeadline, usageDetailText, isUsageStale, sameLondonDay } from "../usage.js";

let fail = 0, pass = 0;
const eq = (got, want, label) => { if (got === want) pass++; else { fail++; console.log("FAIL", label || "", "\n  got:  " + JSON.stringify(got) + "\n  want: " + JSON.stringify(want)); } };

const sample = parseUsage({
  weeklyPercentUsed: 22.2,
  weeklyResetsAt: "2026-11-21T09:54:00Z",
  onDemandUsed: 10.06,
  onDemandLimit: 10,
  onDemandResetsAt: "2026-11-29T09:52:00Z",
  checkedAt: "2026-11-14T21:43:00Z"
});

eq(!!sample, true, "parses the HUD usage note");
eq(usagePercentLabel(sample.weeklyPercentUsed), "22", "22.2 rounds to 22 for the gauge");
eq(usageHeadline(sample), "Usage 22%", "headline matches the HUD label");
eq(usageTone(22.2), "ok", "under 60 is indigo / ok");
eq(usageTone(59.9), "ok", "just under 60 stays ok");
eq(usageTone(60), "warn", "60 is amber");
eq(usageTone(85), "warn", "85 is still amber");
eq(usageTone(85.1), "high", "above 85 is red");
eq(usageTone(100), "high", "100 is red");
eq(Math.round(usageRingOffset(22.2)), 78, "ring offset is 100 minus the raw percent");
eq(usageRingOffset(0), 100, "empty ring");
eq(usageRingOffset(100), 0, "full ring");
eq(usageRingOffset(140), 0, "over 100 is clamped on the ring");

eq(formatMoneyUSD(10.06), "$10.06", "cents stay on used amount");
eq(formatMoneyUSD(10), "$10", "whole dollars drop trailing zeros");
eq(formatMoneyUSD(10.00), "$10", "10.00 is written as $10");
eq(formatMoneyUSD(10.1), "$10.10", "one-decimal amounts keep two places");

const now = new Date("2026-11-14T21:43:00Z");
eq(
  usageDetailText(sample, now),
  "22 percent of this week's usage used. Resets Saturday 21 November at 9:54 am. $10.06 of $10 on-demand used this month. Checked 9:43 pm.",
  "detail matches the natural-language example when checked just now"
);

const later = new Date("2026-11-14T22:01:00Z");
eq(
  usageDetailText(sample, later),
  "22 percent of this week's usage used. Resets Saturday 21 November at 9:54 am. $10.06 of $10 on-demand used this month. Checked 9:43 pm, 18 minutes ago.",
  "staleness is appended to the checked line"
);

eq(isUsageStale(sample.checkedAt, now), false, "fresh reading is not stale");
eq(isUsageStale(sample.checkedAt, new Date("2026-11-15T00:00:00Z")), true, "more than two hours is stale");
eq(sameLondonDay("2026-11-14T21:43:00Z", now), true, "checked time is the same London day");
eq(parseUsage({ onDemandUsed: 1 }), null, "missing weekly percent is rejected");
eq(parseUsage(null), null, "empty payload is rejected");
eq(usageDetailText(parseUsage({ weeklyPercentUsed: 40, onDemandUsed: 3.5 })), "40 percent of this week's usage used. $3.50 on-demand used this month.", "on-demand without a limit still reads naturally");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
