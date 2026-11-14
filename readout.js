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

function zoneLabel(z) {
  const t = String(z || "").trim();
  if (!t) return "";
  if (/BST|British Summer/i.test(t)) return "BST";
  if (/GMT|UTC|Universal|Greenwich/i.test(t)) return "GMT";
  return t.replace(/^GMT[+-].*/i, "GMT").toUpperCase();
}

function clockFromHm(h, min, zone) {
  const hh = ((Number(h) % 24) + 24) % 24;
  const mm = Math.max(0, Math.min(59, Number(min) || 0));
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh < 12 ? "am" : "pm";
  const clock = h12 + ":" + String(mm).padStart(2, "0") + " " + ampm;
  const z = zoneLabel(zone);
  return z ? clock + " " + z : clock;
}

export function formatClock(isoOrDate, { withZone = false } = {}) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d)) return "";
  const parts = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(d).forEach(x => { parts[x.type] = x.value; });
  return clockFromHm(parts.hour, parts.minute, withZone ? (parts.timeZoneName || "") : "");
}

export function formatDate(isoOrDate, { withYear = true } = {}) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d)) return "";
  const parts = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).formatToParts(d).forEach(x => { parts[x.type] = x.value; });
  const day = String(Number(parts.day));
  return day + " " + parts.month + (withYear !== false && parts.year ? " " + parts.year : "");
}

export function formatWhen(isoOrDate, { withYear = true, withTime = true, withZone = false } = {}) {
  const date = formatDate(isoOrDate, { withYear });
  if (!date) return "";
  const clock = withTime ? formatClock(isoOrDate, { withZone }) : "";
  return clock ? date + " at " + clock : date;
}

function digitsUnit(n, singular, plural) {
  const v = Math.round(Math.abs(Number(n)));
  if (!isFinite(v)) return "";
  const unit = v === 1 ? singular : (plural || singular + "s");
  return v + " " + unit;
}

export function ago(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (!isFinite(s)) return "";
  if (Math.abs(s) < 45) return "just now";
  if (Math.abs(s) < 3600) return digitsUnit(Math.max(1, Math.round(Math.abs(s) / 60)), "minute") + " ago";
  if (Math.abs(s) < 86400) return digitsUnit(Math.max(1, Math.round(Math.abs(s) / 3600)), "hour") + " ago";
  return digitsUnit(Math.max(1, Math.round(Math.abs(s) / 86400)), "day") + " ago";
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
    .replace(/([,;])(?=\S)/g, "$1 ")
    .replace(/:(?=\S)/g, (all, off, str) => (/\d/.test(str[off - 1] || "") && /\d/.test(str[off + 1] || "") ? ":" : ": "))
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

// ----- bot-authored text: natural dates, times and safe numbers (v2.6.10) -----
const MON_FULL = { jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11 };
// Month and weekday tokens must be capitalised ("2 May", not "2 may be"), so ordinary words never read as dates.
const CAP_MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)";
const CAP_WEEK = "(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Tues|Thurs|Thur|Sun|Mon|Tue|Wed|Thu|Fri|Sat)";
const APPROX = "(~|≈|c\\.\\s*|ca\\.\\s*|approx\\.?\\s+|about\\s+|around\\s+)?";
const ZONE = "(?:\\s*(GMT|UTC|BST|Z\\b|London(?:\\s+time)?))?";
const NUM_WORD_MAX = 10;

function londonParts(d) {
  const parts = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).forEach(x => { parts[x.type] = x.value; });
  return { weekday: parts.weekday, day: Number(parts.day), month: parts.month, year: Number(parts.year), hour: Number(parts.hour), minute: Number(parts.minute) };
}
function clockText(h, m, showMinutes = true) {
  const hh = ((Number(h) % 24) + 24) % 24;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ap = hh < 12 ? "am" : "pm";
  return showMinutes ? h12 + ":" + String(Number(m) || 0).padStart(2, "0") + " " + ap : h12 + " " + ap;
}
function approxWord(a) { return a ? "around " : ""; }
function isUtcZone(z) { return /^(GMT|UTC|Z)$/i.test(String(z || "").trim()); }
// Hour in 24h from a written clock; returns null when the clock is impossible.
function hour24(hh, ap) {
  let h = Number(hh);
  if (!isFinite(h)) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    const pm = /^p/i.test(ap);
    return h === 12 ? (pm ? 12 : 0) : h + (pm ? 12 : 0);
  }
  return h <= 23 ? h : null;
}

/**
 * Rewrite dates and times in bot-written text into Peter's natural forms
 * ("Saturday 14 November at around 6:25 am"), converting GMT/UTC/Z to Europe/London
 * and dropping the zone label. Version numbers, IDs, hashes, reference numbers,
 * money, mileage and HTTP codes are left exactly as written on screen.
 * opts.speech: give protected tokens a spoken form (used by naturalize()).
 * opts.park: a parking function from naturalize(), so results are not re-read as numbers.
 */
export function naturalizeText(text, opts = {}) {
  if (text == null) return "";
  let s = String(text);
  if (!s) return s;
  const now = opts.now instanceof Date ? opts.now : new Date(opts.now || Date.now());
  const speech = !!opts.speech;
  const own = [];
  const park = typeof opts.park === "function" ? opts.park : (val => { own.push(val); return "\uE002" + "o".repeat(own.length) + "\uE003"; });
  const nowLondon = londonParts(now);
  const curYear = nowLondon.year;

  // 1. links stay untouched on screen
  if (!speech) s = s.replace(/\bhttps?:\/\/[^\s)>\]]+/gi, all => park(all));

  // 2. ISO timestamps / ISO dates -> "14 November 2026 at 10:34 am" (same as the deck's own dates)
  s = s.replace(/\b(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?\b/g, (all, d, t, z) => {
    const w = formatWhen(d + "T" + t + (z || "Z"));
    return w ? park(w) : all;
  });
  s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b(?![-\w])/g, (all, y, mo, d) => {
    const m = Number(mo) - 1, day = Number(d);
    if (m < 0 || m > 11 || day < 1 || day > 31) return all;
    return park(day + " " + MONTHS[m] + (Number(y) === curYear && opts.dropYear ? "" : " " + y));
  });

  // 3. protected tokens: left exactly as written on screen, given a spoken form for the voice
  const digitWords = d => String(d).split("").map(c => ONES[Number(c)]).join(" ");
  // version numbers and version ranges (v1.8.141–v1.8.159, v4.0.106)
  s = s.replace(/\bv\d+(?:\.\d+)*(?:\s*[–-]\s*v?\d+(?:\.\d+)*)?\b/gi, all => park(speech
    ? all.split(/\s*[–-]\s*/).map(v => versionToWords(/^v/i.test(v) ? v : "v" + v)).join(" to ")
    : all));
  // money with a country prefix or code (US$236.35, A$10, 25 GBP); plain £/$/€ amounts are kept on screen too
  s = s.replace(/(^|[^\w$£€])((?:US|AU|A|C|CA|NZ|HK|S)?[£$€])\s?(\d[\d,]*(?:\.\d+)?)(\s?(?:k|m|bn|b)\b)?/g, (all, pre, sym, num, scale) => {
    if (!speech) return pre + park(sym + num + (scale || ""));
    const words = currencyToWords(sym.replace(/^[A-Z]+/, "") + num + (scale ? scale.trim() : ""));
    return pre + park(words || (sym + num));
  });
  s = s.replace(/\b(\d[\d,]*(?:\.\d+)?)\s?(GBP|USD|EUR)\b/g, (all, num, code) => park(speech ? (currencyToWords(code + num) || all) : all));
  // mileage / distance
  s = s.replace(/\b(\d[\d,]*(?:\.\d+)?)\s?(mi|miles?|km|kilomet(?:re|er)s?)\b/g, (all, num, u) => park(speech
    ? decimalToWords(num) + " " + (/^k/i.test(u) ? "kilometres" : (num === "1" ? "mile" : "miles"))
    : all));
  // HTTP status codes
  s = s.replace(/\bHTTP\s?(\d{3})\b/gi, (all, code) => park(speech ? "HTTP " + digitWords(code).replace(/zero/g, "oh") : all));
  // phone / reference numbers: leading zero, or six or more bare digits
  s = s.replace(/(^|[^\w.,£$€:-])(0\d{3,}|\d{6,})(?![\w.,:]*\d)(?![\w])/g, (all, pre, num) => pre + park(speech ? digitWords(num) : num));
  // IDs, hashes and product codes: any word mixing letters and digits (5e77322, MT5, rmwgdst97, UtilityPC-2, Covid-19)
  s = s.replace(/\b[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*\b/g, all => {
    const segs = all.split(/[-_]/);
    const mixed = segs.some(g => /[A-Za-z]/.test(g) && /\d/.test(g) && !/^\d+(?:st|nd|rd|th|am|pm|[ap]|k|m|bn|b|t|s|ms|px|h|hrs?|mins?|d|x|gb|mb|tb|kb|mi|km)$/i.test(g));
    const letterThenDigit = segs.length > 1 && segs.some((g, k) => k > 0 && /^\d+$/.test(g) && /[A-Za-z]$/.test(segs[k - 1]));
    if (!mixed && !letterThenDigit) return all;
    if (/^\d{1,2}(?:am|pm)$/i.test(all)) return all;
    return park(speech ? all.replace(/[-_]/g, " ") : all);
  });

  // 4. dates, optionally with weekday, day range, year and a time
  const timePart = "(?:[, ]+(?:at\\s+)?" + APPROX + "(\\d{1,2})(?=:[0-5]\\d|\\s*[ap]\\.?m\\b)(?::([0-5]\\d))?(?::[0-5]\\d)?\\s*([ap]\\.?m\\.?)?" + ZONE + ")?";
  const dayFirst = new RegExp("\\b(?:(" + CAP_WEEK + ")[, ]+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[–-]\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s+(?:of\\s+)?(" + CAP_MONTH + ")(?![a-z])(?:,?\\s+(\\d{4}))?(?!\\d)" + timePart, "g");
  const renderDate = (week, day, day2, mon, year, approx, hh, mm, ap, zone, all) => {
    const m = MON_FULL[String(mon).replace(/\.$/, "").toLowerCase()];
    const d = Number(day);
    if (m == null || d < 1 || d > 31 || (day2 && (Number(day2) < 1 || Number(day2) > 31))) return null;
    let timeOk = hh != null && (mm != null || ap);
    let h = timeOk ? hour24(hh, ap) : null;
    if (timeOk && h == null) timeOk = false;
    let weekOut = week ? weekName(String(week).replace(/\.$/, "")) : "";
    let dayOut = d, monOut = MONTHS[m], yearOut = year || "", clock = "";
    if (timeOk) {
      if (isUtcZone(zone)) {
        const y = year ? Number(year) : curYear;
        const lp = londonParts(new Date(Date.UTC(y, m, d, h, Number(mm || 0))));
        if (!day2) { dayOut = lp.day; monOut = lp.month; if (week) weekOut = lp.weekday; if (year) yearOut = String(lp.year); }
        h = lp.hour; mm = String(lp.minute);
      }
      clock = approxWord(approx) + clockText(h, mm || 0, mm != null);
    }
    let out = (weekOut ? weekOut + " " : "") + dayOut + (day2 ? " to " + Number(day2) : "") + " " + monOut + (yearOut ? " " + yearOut : "");
    if (clock) out += " at " + clock;
    return { out, timeOk };
  };
  s = s.replace(dayFirst, (all, week, day, day2, mon, year, approx, hh, mm, ap, zone) => {
    const r = renderDate(week, day, day2, mon, year, approx, hh, mm, ap, zone, all);
    if (!r) return all;
    return park(r.out);
  });
  const monthFirst = new RegExp("\\b(?:(" + CAP_WEEK + ")[, ]+)?(" + CAP_MONTH + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?![.:]\\d)(?:,?\\s+(\\d{4}))?\\b", "g");
  s = s.replace(monthFirst, (all, week, mon, day, year) => {
    const r = renderDate(week, day, null, mon, year, null, null, null, null, null, all);
    return r ? park(r.out) : all;
  });
  s = s.replace(new RegExp("\\b(" + CAP_MONTH + ")\\s+(\\d{4})\\b", "g"), (all, mon, year) => {
    const m = MON_FULL[String(mon).replace(/\.$/, "").toLowerCase()];
    return m == null ? all : park(MONTHS[m] + " " + year);
  });

  // 5. clocks on their own
  const toLondonClock = (h, mm, zone) => {
    if (!isUtcZone(zone)) return { h, mm };
    const lp = londonParts(new Date(Date.UTC(nowLondon.year, now.getUTCMonth(), now.getUTCDate(), h, Number(mm || 0))));
    return { h: lp.hour, mm: String(lp.minute) };
  };
  s = s.replace(new RegExp("(^|[^\\w.:])" + APPROX + "(\\d{1,2})(?::([0-5]\\d))?(?::[0-5]\\d)?\\s*([ap])\\.?m\\b\\.?" + ZONE, "gi"), (all, pre, approx, hh, mm, ap, zone) => {
    const h = hour24(hh, ap + "m");
    if (h == null) return all;
    const c = toLondonClock(h, mm, zone);
    return pre + park(approxWord(approx) + clockText(c.h, c.mm || 0, mm != null));
  });
  s = s.replace(new RegExp("(^|[^\\w.:])" + APPROX + "([01]?\\d|2[0-3]):([0-5]\\d)(?::[0-5]\\d)?(?![\\d:.])" + ZONE, "g"), (all, pre, approx, hh, mm, zone) => {
    const c = toLondonClock(Number(hh), mm, zone);
    return pre + park(approxWord(approx) + clockText(c.h, c.mm, true));
  });

  // 6. weekday abbreviations on their own ("Sat morning" -> "Saturday morning")
  s = s.replace(/\b(Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)\b(?![-'’\w])/g, (all, w) => park(weekName(w)));

  // 7. approximate marker before a number ("~8 GB" -> "around 8 GB")
  s = s.replace(/~\s*(?=\d)/g, "around ");

  // 8. on screen, small counts read as words ("7 messages" -> "seven messages"), as elsewhere on the deck
  if (!speech) {
    s = s.replace(/(^|[\s(])(\d{1,2})(?=\s+[a-z][a-z'-]*\b)/g, (all, pre, n) => {
      const v = Number(n);
      if (v > NUM_WORD_MAX || (n.length > 1 && n[0] === "0")) return all;
      return pre + numberToWords(v);
    });
  }
  // number ranges read as "to" in speech ("30–40 seconds" -> "30 to 40 seconds")
  if (speech) s = s.replace(/(^|[\s(])(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)(?![\w.])/g, "$1$2 to $3");
  // "#51" -> "number 51" in speech
  if (speech) s = s.replace(/(^|[\s(])#(\d+)\b/g, "$1number $2");

  if (own.length) s = s.replace(/\uE002(o+)\uE003/g, (_, o) => own[o.length - 1] ?? "");
  return s;
}

export function naturalize(text) {
  if (text == null) return "";
  let s = String(text);
  if (!s) return s;
  const slots = [];
  const park = val => { slots.push(val); return "\uE000" + "o".repeat(slots.length) + "\uE001"; };

  s = s.replace(/\bhttps?:\/\/[^\s)>\]]+/gi, () => park("a web link"));
  s = naturalizeText(s, { speech: true, park });

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
    let out = dayN + " " + monthName(mon);
    if (year) out += " " + year;
    if (hh != null) out += " at " + clockFromHm(hh, mm, zone);
    return park(out);
  });

  s = s.replace(/\b([1-9]|1[0-2]):([0-5]\d)(?::[0-5]\d)?\s*([ap]\.?m\.?)(?:\s*(GMT|BST|UTC))?\b/gi, (all, hh, mm, ap, zone) => {
    const h = Number(hh);
    const isPm = /^p/i.test(ap);
    const h24 = h === 12 ? (isPm ? 12 : 0) : h + (isPm ? 12 : 0);
    return park(clockFromHm(h24, mm, zone));
  });

  s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?:\s*(GMT|BST|UTC))?\b/g, (all, hh, mm, zone) => park(clockFromHm(hh, mm, zone)));

  s = s.replace(/\b(\d+(?:,\d{3})*)\s*(ms|milliseconds?|px|pixels?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?)\s+ago\b/g, (all, n, u) => {
    const pair = UNIT_WORDS[u.toLowerCase()];
    if (!pair) return all;
    const v = Number(String(n).replace(/,/g, ""));
    if (!isFinite(v)) return all;
    const unit = Math.abs(v) === 1 ? pair[0] : pair[1];
    return park(v + " " + unit + " ago");
  });

  s = s.replace(/\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(ms|milliseconds?|px|pixels?|secs?|seconds?|mins?|minutes?|hrs?|hours?|days?)\b/g, (all, n, u) => {
    const pair = UNIT_WORDS[u.toLowerCase()];
    if (!pair) return all;
    const parsed = splitNumberString(n);
    if (!parsed) return all;
    if (parsed.frac && !/^0+$/.test(parsed.frac)) return park(decimalToWords(n) + " " + pair[1]);
    return park(unitCount(Number(parsed.intPart), pair[0], pair[1]));
  });

  s = s.replace(/\b(\d+)(ms|px|s)\b/g, (all, n, u) => {
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
  const clock = r && r.repliedAt ? formatClock(r.repliedAt) : "";
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
    if (when && r.repliedAt) return "Answered " + when + ", at " + formatClock(r.repliedAt) + ".";
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

export function messageTiming(r, name) {
  const when = ago(r && r.createdAt);
  const clock = r && r.repliedAt ? formatClock(r.repliedAt) : "";
  const who = name || "";
  const status = r && r.status;
  if (status === "answered") {
    if (when && clock) return { when, clock, text: "Asked " + when + ", answered at " + clock + "." };
    if (when) return { when, clock, text: "Asked " + when + ", and this has been answered." };
    if (clock) return { when, clock, text: "This has been answered, at " + clock + "." };
    return { when, clock, text: "This has been answered." };
  }
  if (status === "routed") {
    if (when && who) return { when, clock, text: "Asked " + when + ", and currently with " + who + "." };
    if (when) return { when, clock, text: "Asked " + when + ", still waiting for an answer." };
    if (who) return { when, clock, text: "This is currently with " + who + ", still waiting for an answer." };
    return { when, clock, text: "This one is with the crew, still waiting for an answer." };
  }
  if (when) return { when, clock, text: "Asked " + when + ", and not yet routed." };
  return { when, clock, text: "Asked, and not yet routed." };
}

export function messageTimingHtml(r, name, esc) {
  const info = messageTiming(r, name);
  const when = info.when || "";
  const iso = (r && r.createdAt) || "";
  if (when && iso && info.text.includes(when)) {
    const span = `<span data-ago="${esc(iso)}">${esc(when)}</span>`;
    return esc(info.text).replace(esc(when), span);
  }
  return esc(info.text);
}
