// Jarvis Command Deck — natural readout helpers.
// Presentation only: never used when writing Second Brain JSON.
export const TZ = "Europe/London";

const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
  "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
const ORDINALS = {
  1:"first",2:"second",3:"third",4:"fourth",5:"fifth",6:"sixth",7:"seventh",8:"eighth",9:"ninth",
  10:"tenth",11:"eleventh",12:"twelfth",13:"thirteenth",14:"fourteenth",15:"fifteenth",16:"sixteenth",
  17:"seventeenth",18:"eighteenth",19:"nineteenth",20:"twentieth",21:"twenty-first",22:"twenty-second",
  23:"twenty-third",24:"twenty-fourth",25:"twenty-fifth",26:"twenty-sixth",27:"twenty-seventh",
  28:"twenty-eighth",29:"twenty-ninth",30:"thirtieth",31:"thirty-first"
};
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_RE = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const WEEK_RE = "Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat";
const SCALES = [[1e12,"trillion"],[1e9,"billion"],[1e6,"million"],[1e3,"thousand"]];

const CURRENCIES = {
  "£": { major:["pound","pounds"], minor:["penny","pence"] },
  gbp: { major:["pound","pounds"], minor:["penny","pence"] },
  $: { major:["dollar","dollars"], minor:["cent","cents"] },
  usd: { major:["dollar","dollars"], minor:["cent","cents"] },
  "€": { major:["euro","euros"], minor:["cent","cents"] },
  eur: { major:["euro","euros"], minor:["cent","cents"] }
};
const CUR_WORD = {
  pound: "£", pounds: "£",
  dollar: "$", dollars: "$",
  euro: "€", euros: "€",
  penny: "pence", pence: "pence",
  "pennies": "pence",
  cent: "cents", cents: "cents"
};

function underThousand(n) {
  n = Math.trunc(Math.abs(n));
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    return o ? TENS[t] + "-" + ONES[o] : TENS[t];
  }
  const h = Math.floor(n / 100), rest = n % 100;
  return ONES[h] + " hundred" + (rest ? " and " + underThousand(rest) : "");
}

export function numberToWords(input) {
  let n = input;
  if (typeof n === "string") {
    const t = n.trim().replace(/,/g, "");
    if (!/^-?\d+$/.test(t)) return decimalToWords(n);
    n = Number(t);
  }
  if (typeof n !== "number" || !isFinite(n)) return "";
  if (n < 0) return "minus " + numberToWords(-n);
  n = Math.trunc(n);
  if (n < 1000) return underThousand(n);
  const parts = [];
  let rest = n;
  for (const [val, name] of SCALES) {
    if (rest >= val) {
      const chunk = Math.floor(rest / val);
      parts.push(numberToWords(chunk) + " " + name);
      rest = rest % val;
    }
  }
  if (rest === 0) return parts.join(" ");
  if (rest < 100) return parts.join(" ") + " and " + underThousand(rest);
  return parts.join(" ") + " " + underThousand(rest);
}

export function countToWords(n, { none = "no" } = {}) {
  const v = Math.trunc(Number(n));
  if (!isFinite(v)) return "";
  if (v === 0 && none) return none;
  return numberToWords(v);
}

function splitNumberString(raw) {
  const s = String(raw ?? "").trim().replace(/,/g, "");
  const m = s.match(/^([+-])?(\d+)?(?:\.(\d+))?$/);
  if (!m || (m[2] == null && m[3] == null)) return null;
  return { negative: m[1] === "-", intPart: m[2] || "0", frac: m[3] || "" };
}

export function decimalToWords(input) {
  const parsed = splitNumberString(input);
  if (!parsed) return "";
  const signed = parsed.negative ? "minus " : "";
  const intWords = numberToWords(Number(parsed.intPart));
  if (!parsed.frac) return signed + intWords;
  const fracWords = parsed.frac.split("").map(d => ONES[Number(d)] || "zero").join(" ");
  return signed + intWords + " point " + fracWords;
}

export function percentToWords(input) {
  const raw = String(input ?? "").trim().replace(/%/g, "").trim();
  const parsed = splitNumberString(raw);
  if (!parsed) return "";
  if (!parsed.frac || /^0+$/.test(parsed.frac)) return (parsed.negative ? "minus " : "") + numberToWords(Number(parsed.intPart)) + " percent";
  return decimalToWords(raw) + " percent";
}

function scaleName(letter) {
  const k = String(letter || "").toLowerCase();
  if (k === "k") return "thousand";
  if (k === "m") return "million";
  if (k === "b" || k === "bn") return "billion";
  if (k === "t") return "trillion";
  return "";
}

function scaleWords(numStr, scale) {
  const parsed = splitNumberString(numStr);
  const name = scaleName(scale);
  if (!parsed || !name) return "";
  const signed = parsed.negative ? "minus " : "";
  if (name === "thousand") {
    const frac = parsed.frac ? Number("0." + parsed.frac) : 0;
    const value = (Number(parsed.intPart) + frac) * 1000;
    if (Math.abs(value - Math.round(value)) < 1e-9) return signed + numberToWords(Math.round(value));
    return signed + decimalToWords(Math.abs(Number(parsed.intPart) + frac)) + " thousand";
  }
  const frac = (parsed.frac || "").replace(/0+$/, "");
  if (!frac) return signed + numberToWords(Number(parsed.intPart)) + " " + name;
  const fracWords = frac.split("").map(d => ONES[Number(d)] || "zero").join(" ");
  return signed + numberToWords(Number(parsed.intPart)) + " point " + fracWords + " " + name;
}

function moneyPhrase(major, minor, unit, negative) {
  const majUnit = major === 1 ? unit.major[0] : unit.major[1];
  const minUnit = minor === 1 ? unit.minor[0] : unit.minor[1];
  let body;
  if (major === 0 && minor === 0) body = "zero " + unit.major[1];
  else if (minor === 0) body = numberToWords(major) + " " + majUnit;
  else if (major === 0) body = numberToWords(minor) + " " + minUnit;
  else if (minor === 1) body = numberToWords(major) + " " + majUnit + " and one " + unit.minor[0];
  else if (minor < 10) body = numberToWords(major) + " " + majUnit + " and " + numberToWords(minor) + " " + unit.minor[1];
  else body = numberToWords(major) + " " + majUnit + " " + numberToWords(minor);
  return (negative ? "minus " : "") + body;
}

function amountValue(numStr, scale) {
  const parsed = splitNumberString(numStr);
  if (!parsed) return null;
  const frac = parsed.frac ? Number("0." + parsed.frac) : 0;
  let value = Number(parsed.intPart) + frac;
  const name = scaleName(scale);
  if (name === "thousand") value *= 1e3;
  else if (name === "million") value *= 1e6;
  else if (name === "billion") value *= 1e9;
  else if (name === "trillion") value *= 1e12;
  if (parsed.negative) value = -value;
  return { value, name, parsed };
}

function currencyFromParts(numStr, scale, unit, negative) {
  const info = amountValue(numStr, scale);
  if (!info || !unit) return "";
  if (info.name && info.name !== "thousand") {
    const words = scaleWords(numStr, scale).replace(/^minus /, "");
    const plural = /^one(\s|$)/.test(words) ? unit.major[0] : unit.major[1];
    return (negative || info.value < 0 ? "minus " : "") + words + " " + plural;
  }
  const abs = Math.abs(info.value);
  const major = Math.floor(abs + 1e-9);
  let minor = Math.round((abs - major) * 100);
  if (minor === 100) return moneyPhrase(major + 1, 0, unit, negative || info.value < 0);
  return moneyPhrase(major, minor, unit, negative || info.value < 0);
}

export function currencyToWords(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  let m = raw.match(/^(-)?\s*(£|\$|€|GBP|USD|EUR)\s*(-)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m|bn|b|t)?\s*$/i);
  if (m) {
    const unit = CURRENCIES[m[2].toLowerCase()] || CURRENCIES[m[2]];
    return currencyFromParts(m[4], m[5] || "", unit, !!(m[1] || m[3]));
  }
  m = raw.match(/^(-)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m|bn|b|t)?\s*(pounds?|pence|penn(?:y|ies)|dollars?|cents?|euros?)\s*$/i);
  if (m) {
    const word = m[4].toLowerCase();
    if (CUR_WORD[word] === "pence") {
      const n = Math.round(Number(String(m[2]).replace(/,/g, "")));
      return (m[1] ? "minus " : "") + numberToWords(n) + (n === 1 ? " penny" : " pence");
    }
    if (CUR_WORD[word] === "cents") {
      const n = Math.round(Number(String(m[2]).replace(/,/g, "")));
      return (m[1] ? "minus " : "") + numberToWords(n) + (n === 1 ? " cent" : " cents");
    }
    const unit = CURRENCIES[CUR_WORD[word]] || CURRENCIES["£"];
    return currencyFromParts(m[2], m[3] || "", unit, !!m[1]);
  }
  return "";
}

export function unitCount(n, singular, plural = singular + "s") {
  const v = Math.round(Number(n));
  if (!isFinite(v)) return "";
  const unit = Math.abs(v) === 1 ? singular : plural;
  return (v < 0 ? "minus " : "") + numberToWords(Math.abs(v)) + " " + unit;
}

export function versionToWords(ver) {
  const s = String(ver || "").trim().replace(/^v/i, "");
  if (!/^\d+(?:\.\d+)*$/.test(s)) return String(ver || "");
  return "version " + s.split(".").map(p => numberToWords(Number(p))).join(" point ");
}

function clockFromHm(h, min, zone) {
  const hh = Number(h), mm = Number(min);
  let clock;
  if (hh === 0 && mm === 0) clock = "midnight";
  else if (hh === 12 && mm === 0) clock = "midday";
  else {
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    const hourW = numberToWords(h12);
    if (mm === 0) clock = hourW + " o'clock";
    else if (mm < 10) clock = hourW + " oh " + numberToWords(mm);
    else clock = hourW + " " + numberToWords(mm);
  }
  const z = zone ? " " + String(zone).toUpperCase() : "";
  return clock + z;
}

export function formatClock(isoOrDate, { withZone = true } = {}) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d)) return "";
  const parts = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(d).forEach(x => { parts[x.type] = x.value; });
  return clockFromHm(parts.hour, parts.minute, withZone ? (parts.timeZoneName || "") : "");
}

export function formatWhen(isoOrDate, { withYear } = {}) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d)) return "";
  const parts = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).formatToParts(d).forEach(x => { parts[x.type] = x.value; });
  const dayN = Number(parts.day);
  const ordinal = ORDINALS[dayN] || numberToWords(dayN);
  const nowYear = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric" }).format(new Date());
  const includeYear = withYear === true || (withYear !== false && parts.year !== nowYear);
  const date = (parts.weekday ? parts.weekday + " the " : "the ") + ordinal + " of " + parts.month + (includeYear ? ", " + numberToWords(Number(parts.year)) : "");
  const clock = formatClock(d, { withZone: true });
  return clock ? date + " at " + clock : date;
}

export function ago(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (!isFinite(s)) return "";
  if (Math.abs(s) < 45) return "just now";
  if (Math.abs(s) < 3600) return unitCount(Math.max(1, Math.round(Math.abs(s) / 60)), "minute") + " ago";
  if (Math.abs(s) < 86400) return unitCount(Math.max(1, Math.round(Math.abs(s) / 3600)), "hour") + " ago";
  return unitCount(Math.max(1, Math.round(Math.abs(s) / 86400)), "day") + " ago";
}

export function compactStatus(state) {
  return ({ working: "Working now", waiting: "Waiting", idle: "Idle just now", unknown: "No signal" })[state] || "No signal";
}

export function crewStatePhrase(state) {
  return ({ working: "Currently working", waiting: "Waiting just now", idle: "Idle at the moment", unknown: "No status signal yet" })[state] || "No status signal yet";
}

const UNIT_WORDS = {
  ms: ["millisecond","milliseconds"], millisecond: ["millisecond","milliseconds"], milliseconds: ["millisecond","milliseconds"],
  px: ["pixel","pixels"], pixel: ["pixel","pixels"], pixels: ["pixel","pixels"],
  s: ["second","seconds"], sec: ["second","seconds"], secs: ["second","seconds"], second: ["second","seconds"], seconds: ["second","seconds"],
  m: ["minute","minutes"], min: ["minute","minutes"], mins: ["minute","minutes"], minute: ["minute","minutes"], minutes: ["minute","minutes"],
  h: ["hour","hours"], hr: ["hour","hours"], hrs: ["hour","hours"], hour: ["hour","hours"], hours: ["hour","hours"],
  d: ["day","days"], day: ["day","days"], days: ["day","days"]
};

function tidy(s) {
  return String(s || "")
    .replace(/[·•]/g, ", ")
    .replace(/\s*[—–]{1,2}\s*/g, ", ")
    .replace(/\s*(?:->|→)\s*/g, " to ")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_`]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;.\s]+/, "")
    .trim();
}

function monthName(tok) {
  const t = String(tok || "").toLowerCase();
  const map = { jan:"January",feb:"February",mar:"March",apr:"April",may:"May",jun:"June",jul:"July",aug:"August",sep:"September",sept:"September",oct:"October",nov:"November",dec:"December" };
  if (map[t]) return map[t];
  const i = MONTHS.findIndex(m => m.toLowerCase() === t);
  return i >= 0 ? MONTHS[i] : tok;
}
function weekName(tok) {
  const t = String(tok || "").toLowerCase();
  const map = { sun:"Sunday",mon:"Monday",tue:"Tuesday",tues:"Tuesday",wed:"Wednesday",thu:"Thursday",thur:"Thursday",thurs:"Thursday",fri:"Friday",sat:"Saturday" };
  if (map[t]) return map[t];
  const i = WEEKDAYS.findIndex(d => d.toLowerCase() === t);
  return i >= 0 ? WEEKDAYS[i] : tok;
}

export function naturalize(text) {
  if (text == null) return "";
  let s = String(text);
  if (!s) return s;
  const slots = [];
  const park = val => { slots.push(val); return "\uE000" + "o".repeat(slots.length) + "\uE001"; };

  s = s.replace(/\bhttps?:\/\/[^\s)>\]]+/gi, () => park("a web link"));

  s = s.replace(/\(?\b(\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?)\b\)?/g, (all, iso) => {
    const w = formatWhen(iso);
    return w ? park(w) : all;
  });

  s = s.replace(/(^|[\s(])(-)?\s*(£|\$|€|GBP|USD|EUR)\s*(-)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(k|m|bn|b|t))?\b/gi,
    (all, pre, n1, sym, n2, num, scale) => {
      const words = currencyToWords((n1 || n2 || "") + sym + num + (scale || ""));
      return words ? pre + park(words) : all;
    });

  s = s.replace(/\b(-)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m|bn|b|t)?\s*(pounds?|pence|penn(?:y|ies)|dollars?|cents?|euros?)\b/gi,
    (all, sign, num, scale, word) => {
      const words = currencyToWords((sign || "") + num + (scale || "") + " " + word);
      return words ? park(words) : all;
    });

  s = s.replace(/\b(-?\d+(?:,\d{3})*(?:\.\d+)?)\s*%/g, (all, n) => {
    const w = percentToWords(n);
    return w ? park(w) : all;
  });

  s = s.replace(/\bv(\d+(?:\.\d+)*)\b/gi, (all, ver) => park(versionToWords(ver)));

  const dateRe = new RegExp("\\b(?:(" + WEEK_RE + ")[, ]+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + MONTH_RE + ")(?:[, ]+(\\d{4}))?(?:[, ]+([01]?\\d|2[0-3]):([0-5]\\d)(?:[:.][0-5]\\d)?(?:\\s*(GMT|BST|UTC))?)?\\b", "gi");
  s = s.replace(dateRe, (all, week, day, mon, year, hh, mm, zone) => {
    const dayN = Number(day);
    const ordinal = ORDINALS[dayN] || numberToWords(dayN);
    let out = (week ? weekName(week) + " the " : "the ") + ordinal + " of " + monthName(mon);
    if (year) out += ", " + numberToWords(Number(year));
    if (hh != null) out += " at " + clockFromHm(hh, mm, zone);
    return park(out);
  });

  s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?:\s*(GMT|BST|UTC))?\b/g, (all, hh, mm, zone) => park(clockFromHm(hh, mm, zone)));

  s = s.replace(/\b(\d+(?:,\d{3})*)\s*(ms|milliseconds?|px|pixels?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?)\s+ago\b/gi, (all, n, u) => {
    const pair = UNIT_WORDS[u.toLowerCase()];
    if (!pair) return all;
    return park(unitCount(Number(String(n).replace(/,/g, "")), pair[0], pair[1]) + " ago");
  });

  s = s.replace(/\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(ms|milliseconds?|px|pixels?|secs?|seconds?|mins?|minutes?|hrs?|hours?|days?)\b/gi, (all, n, u) => {
    const pair = UNIT_WORDS[u.toLowerCase()];
    if (!pair) return all;
    const parsed = splitNumberString(n);
    if (!parsed) return all;
    if (parsed.frac && !/^0+$/.test(parsed.frac)) return park(decimalToWords(n) + " " + pair[1]);
    return park(unitCount(Number(parsed.intPart), pair[0], pair[1]));
  });

  s = s.replace(/\b(\d+)(ms|px|s)\b/gi, (all, n, u) => {
    const pair = UNIT_WORDS[u.toLowerCase()];
    return pair ? park(unitCount(n, pair[0], pair[1])) : all;
  });

  s = s.replace(/\b(-?\d+(?:,\d{3})*(?:\.\d+)?)(k|bn|b|t)\b/gi, (all, n, sc) => {
    const words = scaleWords(n, sc);
    return words ? park(words) : all;
  });
  s = s.replace(/\b(-?\d+(?:,\d{3})*(?:\.\d+)?)m\b/g, (all, n) => {
    const parsed = splitNumberString(n);
    if (!parsed) return all;
    if (parsed.frac && !/^0+$/.test(parsed.frac)) return park(scaleWords(n, "m"));
    const v = Number(parsed.intPart);
    if (v <= 180) return park(unitCount(parsed.negative ? -v : v, "minute"));
    return park(scaleWords(n, "m"));
  });

  s = s.replace(/\b(-?\d+(?:,\d{3})*(?:\.\d+)?)\s+([A-Za-z][A-Za-z'-]*)\b/g, (all, n, word) => {
    const lower = word.toLowerCase();
    if (/^(am|pm|gmt|bst|utc|http|https|st|nd|rd|th)$/.test(lower)) return all;
    const parsed = splitNumberString(n);
    if (!parsed) return all;
    const num = parsed.frac && !/^0+$/.test(parsed.frac) ? decimalToWords(n) : numberToWords(parsed.negative ? -Number(parsed.intPart) : Number(parsed.intPart));
    return park(num + " " + word);
  });

  s = s.replace(/\b-?\d+(?:,\d{3})*(?:\.\d+)?\b/g, all => {
    const parsed = splitNumberString(all);
    if (!parsed) return all;
    const w = parsed.frac && !/^0+$/.test(parsed.frac) ? decimalToWords(all) : numberToWords(parsed.negative ? -Number(parsed.intPart) : Number(parsed.intPart));
    return w ? park(w) : all;
  });

  s = tidy(s);
  s = s.replace(/\uE000(o+)\uE001/g, (_, o) => slots[o.length - 1] || "");
  s = tidy(s);
  return s;
}

export function requestNarration(r, name) {
  const when = ago(r && r.createdAt);
  const clock = r && r.repliedAt ? formatClock(r.repliedAt, { withZone: true }) : "";
  const who = name || "";
  const status = r && r.status;
  if (status === "answered") {
    if (when && who && clock) return { when, clock, text: "Sent " + when + " and answered by " + who + " at " + clock + "." };
    if (when && who) return { when, clock, text: "Sent " + when + " and answered by " + who + "." };
    if (who && clock) return { when, clock, text: "Answered by " + who + " at " + clock + "." };
    if (when) return { when, clock, text: "Sent " + when + " and already answered." };
    return { when, clock, text: "This request has been answered." };
  }
  if (status === "routed") {
    if (when && who) return { when, clock, text: "Sent " + when + " and currently with " + who + "." };
    if (when) return { when, clock, text: "Sent " + when + " and routed onward." };
    if (who) return { when, clock, text: "This is currently with " + who + "." };
    return { when, clock, text: "This request has been routed." };
  }
  if (when && who) return { when, clock, text: "Queued " + when + ", waiting for " + who + "." };
  if (when) return { when, clock, text: "Queued " + when + ", waiting to be routed." };
  return { when, clock, text: "This request is queued, waiting to be routed." };
}

export function dossierRequestLine(r, name) {
  const when = ago(r && r.createdAt);
  const status = r && r.status;
  const who = name || "";
  if (status === "answered") {
    if (when && r.repliedAt) return "Answered " + when + ", at " + formatClock(r.repliedAt, { withZone: true }) + ".";
    if (when) return "Answered " + when + ".";
    return "This one has been answered.";
  }
  if (status === "routed") {
    if (when && who) return "Sent " + when + ", and currently with " + who + ".";
    if (when) return "Sent " + when + ", still waiting for an answer.";
    return "This one is with the crew, still waiting for an answer.";
  }
  if (when) return "Queued " + when + ", and not yet routed.";
  return "Queued, and not yet routed.";
}

export function narrationHtml(r, name, esc) {
  const info = requestNarration(r, name);
  const when = info.when || "";
  const iso = (r && r.createdAt) || "";
  if (when && iso) {
    const span = `<span data-ago="${esc(iso)}">${esc(when)}</span>`;
    return esc(info.text).replace(esc(when), span);
  }
  return esc(info.text);
}

export function dossierLineHtml(r, name, esc) {
  const text = dossierRequestLine(r, name);
  const when = ago(r && r.createdAt);
  const iso = (r && r.createdAt) || "";
  if (when && iso && text.includes(when)) {
    const span = `<span data-ago="${esc(iso)}">${esc(when)}</span>`;
    return esc(text).replace(esc(when), span);
  }
  return esc(text);
}
