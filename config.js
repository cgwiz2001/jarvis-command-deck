// Jarvis Command Deck — editable configuration.
// ROSTER: one entry per bot. `match` lists the lowercase names/roles this bot may
// appear under in the Second Brain Bot Status note or an Inbox `routedTo` field
// (first word of the name, or the role string).
// avatar: blob | wedge | chip | pill | sparkle (body shape, from each bot's Grok Bot avatar where set).
// glyph: chart | pound | megaphone | mail | folder | case | code | star | check | pulse (holographic role badge).
export const ROSTER = [
  { id: "jarvis",    name: "Jarvis",    title: "Chief of Staff",                        color: "#a78bfa", shape: "core",    match: ["jarvis", "chief of staff"] },
  { id: "dashia",    name: "Dashia",    title: "Dashboard CEO",                         color: "#38bdf8", avatar: "wedge",   glyph: "chart",     match: ["dashia", "petula", "dashboard"] },
  { id: "financia",  name: "Financia",  title: "Finance and Expense CEO",               color: "#34d399", avatar: "chip",    glyph: "pound",     match: ["financia", "pixie", "finance"] },
  { id: "markita",   name: "Markita",   title: "Marketing CEO",                         color: "#f472b6", avatar: "pill",    glyph: "megaphone", match: ["markita", "prunella", "marketing"] },
  { id: "emelia",    name: "Emelia",    title: "Inbox CEO",                             color: "#60a5fa", avatar: "wedge",   glyph: "mail",      match: ["emelia", "petra", "inbox"] },
  { id: "filea",     name: "Filea",     title: "Files, Data & Photos",                  color: "#8b5cf6", avatar: "sparkle", glyph: "folder",    match: ["filea", "amanda", "data & photos", "files"] },
  { id: "busineela", name: "Busineela", title: "Head of Business CEO",                  color: "#c084fc", avatar: "chip",    glyph: "case",      match: ["busineela", "pendula", "business"] },
  { id: "leo",       name: "Leo",       title: "Head of App Development",               color: "#818cf8", avatar: "pill",    glyph: "code",      match: ["leo", "app development"] },
  { id: "leona",     name: "Leona",     title: "Specialist",                            color: "#fdba74", avatar: "blob",    glyph: "star",      match: ["leona"] },
  { id: "leon",      name: "Leon",      title: "App Development Tester",                color: "#4ade80", avatar: "blob",    glyph: "check",     match: ["leon", "app testing"] },
  { id: "amelia",    name: "Amelia",    title: "PC Performance & Health Check Manager", color: "#fb923c", avatar: "blob",    glyph: "pulse",     match: ["amelia", "pc health"] },
];

// Display timezone for times shown in the deck. (days/hours unused by the UI; routing is instant via the Settings webhook.)
export const ROUTER = { tz: "Europe/London", days: [1, 2, 3, 4, 5], hours: [0, 6, 12, 18] };

// Live polling interval (ms) and the label sent as X-Second-Brain-Agent on writes.
export const POLL_MS = 45000;
export const WRITE_AGENT = "Jarvis - Command Deck";
export const VERSION = "2.5.1";
