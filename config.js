// Jarvis Command Deck — editable configuration.
// ROSTER: one entry per bot. `match` lists the lowercase names/roles this bot may
// appear under in the Second Brain Bot Status note or an Inbox `routedTo` field
// (first word of the name, or the role string). `old` lists retired names: a status line still
// using one shows the current roster name instead.
// avatar: blob | wedge | chip | pill | sparkle (body shape, from each bot's Grok Bot avatar where set).
// glyph: chart | pound | megaphone | mail | folder | case | code | star | check | pulse (holographic role badge).
export const ROSTER = [
  { id: "jarvis",    name: "Jarvis",    title: "Chief of Staff",                        color: "#a78bfa", shape: "core",    match: ["jarvis", "chief of staff"] },
  { id: "dashia",    name: "Dashboard Bot", old: ["dashia"], title: "Dashboard CEO",                         color: "#38bdf8", avatar: "wedge",   glyph: "chart",     match: ["dashia", "petula", "dashboard"] },
  { id: "financia",  name: "Finance Bot", old: ["financia"], title: "Finance and Expense CEO",               color: "#34d399", avatar: "chip",    glyph: "pound",     match: ["financia", "pixie", "finance"] },
  { id: "markita",   name: "Marketing Bot", old: ["markita"], title: "Marketing CEO",                         color: "#f472b6", avatar: "pill",    glyph: "megaphone", match: ["markita", "prunella", "marketing"] },
  { id: "emelia",    name: "Email Bot", old: ["emelia"], title: "Inbox CEO",                             color: "#60a5fa", avatar: "wedge",   glyph: "mail",      match: ["emelia", "petra", "inbox", "email", "email bot"] },
  { id: "filea",     name: "Data and Files Bot", old: ["filea"], title: "Files, Data & Photos",                  color: "#8b5cf6", avatar: "sparkle", glyph: "folder",    match: ["filea", "amanda", "data & photos", "files", "data", "data and files bot"] },
  { id: "busineela", name: "Business Bot", old: ["busineela"], title: "Head of Business CEO",                  color: "#c084fc", avatar: "chip",    glyph: "case",      match: ["busineela", "pendula", "business"] },
  { id: "leo",       name: "Leo",       title: "Head of App Development",               color: "#818cf8", avatar: "pill",    glyph: "code",      match: ["leo", "app development"] },
  { id: "leona",     name: "Leona",     title: "App Tester",                            color: "#fdba74", avatar: "blob",    glyph: "star",      match: ["leona", "app tester"] },
  { id: "leon",      name: "Leon",      title: "App Development Tester",                color: "#4ade80", avatar: "blob",    glyph: "check",     match: ["leon", "app testing"] },
  { id: "amelia",    name: "PC Health Bot", old: ["amelia", "heather"], title: "PC Performance & Health Check Manager", color: "#fb923c", avatar: "blob",    glyph: "pulse",     match: ["amelia", "heather", "pc", "pc health", "pc health bot"] },
];

// Display timezone for times shown in the deck.
export const ROUTER = { tz: "Europe/London", days: [1, 2, 3, 4, 5], hours: [0, 6, 12, 18] };

// Live polling interval (ms) and the label sent as X-Second-Brain-Agent on writes.
export const POLL_MS = 45000;
export const WRITE_AGENT = "Jarvis - Command Deck";
export const VERSION = "2.6.19";
export const USAGE_NOTE_ID = "d014e9e8-8201-4593-b903-3b8f322cd93b";
