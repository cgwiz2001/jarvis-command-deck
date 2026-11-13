// Jarvis Command Deck — editable configuration.
// ROSTER: one entry per bot. `match` lists the lowercase names/roles this bot may
// appear under in the Second Brain Bot Status note or an Inbox `routedTo` field
// (first word of the name, or the role string). Shapes: core, octa, icosa, dodeca,
// tetra, box, torus, knot, cone, capsule, gem, ring.
export const ROSTER = [
  { id: "jarvis",    name: "Jarvis",    title: "Chief of Staff",                      color: "#a78bfa", shape: "core",    match: ["jarvis", "chief of staff"] },
  { id: "dashia",    name: "Dashia",    title: "Dashboard CEO",                       color: "#22d3ee", shape: "octa",    match: ["dashia", "petula", "dashboard"] },
  { id: "financia",  name: "Financia",  title: "Finance and Expense CEO",             color: "#34d399", shape: "gem",     match: ["financia", "pixie", "finance"] },
  { id: "markita",   name: "Markita",   title: "Marketing CEO",                       color: "#f472b6", shape: "knot",    match: ["markita", "prunella", "marketing"] },
  { id: "emelia",    name: "Emelia",    title: "Inbox CEO",                           color: "#60a5fa", shape: "icosa",   match: ["emelia", "petra", "inbox"] },
  { id: "filea",     name: "Filea",     title: "Files, Data & Photos",                color: "#fb923c", shape: "box",     match: ["filea", "amanda", "data & photos", "files"] },
  { id: "busineela", name: "Busineela", title: "Head of Business CEO",                color: "#c084fc", shape: "dodeca",  match: ["busineela", "pendula", "business"] },
  { id: "leo",       name: "Leo",       title: "Head of App Development",             color: "#818cf8", shape: "torus",   match: ["leo", "app development"] },
  { id: "leona",     name: "Leona",     title: "Specialist",                          color: "#e879f9", shape: "tetra",   match: ["leona"] },
  { id: "leon",      name: "Leon",      title: "App Development Tester",              color: "#2dd4bf", shape: "capsule", match: ["leon", "app testing"] },
  { id: "amelia",    name: "Amelia",    title: "PC Performance & Health Check Manager", color: "#fb7185", shape: "cone",  match: ["amelia", "pc health"] },
];

// When Jarvis's inbox router runs (wall-clock in ROUTER.tz). Days: 0=Sun … 6=Sat.
export const ROUTER = { tz: "Europe/London", days: [1, 2, 3, 4, 5], hours: [0, 6, 12, 18] };

// Live polling interval (ms) and the label sent as X-Second-Brain-Agent on writes.
export const POLL_MS = 45000;
export const WRITE_AGENT = "Jarvis - Command Deck";
export const VERSION = "1.0.0";
