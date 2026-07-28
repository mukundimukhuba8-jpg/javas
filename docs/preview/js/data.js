export const GOALS = [
  { id: "startup", label: "Startup or SaaS" },
  { id: "mobile", label: "Mobile App" },
  { id: "website", label: "Website" },
  { id: "agent", label: "AI Agent" },
  { id: "business", label: "Business" },
  { id: "marketing", label: "Marketing System" },
  { id: "trading", label: "Trading System" },
  { id: "ecommerce", label: "Ecommerce" },
  { id: "learning", label: "Learning" },
  { id: "assistant", label: "Personal Assistant" },
  { id: "automation", label: "Automation" },
  { id: "custom", label: "Custom Project" },
];

export const SIDE_LINKS = [
  "Home",
  "Files",
  "Tools",
  "Projects",
  "Agents",
  "Voice",
  "Knowledge",
  "Settings",
];

export const MODE_ACTIONS = [
  { id: "scan", icon: "⌕", title: "Scan" },
  { id: "launch", icon: "▲", title: "Launch" },
  { id: "shield", icon: "◈", title: "Secure" },
  { id: "link", icon: "⚭", title: "Link" },
  { id: "pulse", icon: "◎", title: "Pulse" },
];

export const PIPELINE = [
  "Listening",
  "Voice Recognition",
  "Intent Recognised",
  "Memory Search",
  "Knowledge Retrieval",
  "Tool Execution",
  "Response Generation",
  "Speaking",
];

export const SUGGESTIONS = [
  "Build me a CRM",
  "What's the weather?",
  "Tell me about Tesla",
  "Search my knowledge for auth patterns",
];

export const THINKING_STAGES = [
  { id: "intent", label: "Intent recognised", icon: "◎" },
  { id: "memory", label: "Memory search", icon: "⬡" },
  { id: "knowledge", label: "Knowledge retrieval", icon: "◈" },
  { id: "tools", label: "Tool execution", icon: "⚙" },
  { id: "response", label: "Response generation", icon: "✧" },
];

export const WEATHER_STEPS = [
  { id: "loc", label: "Detect Location", detail: "Searching GPS lock...", icon: "📍" },
  { id: "gps", label: "Finding GPS", detail: "Triangulating Pretoria node...", icon: "🛰️" },
  { id: "wx", label: "Checking Weather", detail: "Reading satellite layers...", icon: "☁" },
  { id: "data", label: "Gathering Data", detail: "Wind · humidity · pressure...", icon: "📊" },
  { id: "forecast", label: "Generating Forecast", detail: "Composing briefing...", icon: "✦" },
];

export const CRM_STAGES = [
  {
    id: "planning",
    name: "Planning",
    detail: [
      "Mission scope: contacts, companies, deals, activities",
      "Modular monolith for MVP velocity",
      "Bounded contexts: CRM · Auth · Billing",
    ],
  },
  {
    id: "design",
    name: "Design",
    detail: [
      "Pipeline board as primary surface",
      "Contact profile + activity timeline",
      "Command palette for power users",
    ],
  },
  {
    id: "database",
    name: "Database",
    detail: ["contacts", "companies", "deals", "activities", "users / workspaces"],
  },
  {
    id: "frontend",
    name: "Frontend",
    detail: ["Next.js app router", "Deal board DnD", "Realtime presence chips"],
  },
  {
    id: "backend",
    name: "Backend",
    detail: ["CRUD APIs", "RBAC", "Audit log", "Webhooks"],
  },
  {
    id: "ai",
    name: "AI",
    detail: ["Lead scoring", "Email draft assist", "Meeting summary hooks"],
  },
  {
    id: "deployment",
    name: "Deployment",
    detail: ["Vercel web", "Supabase db", "Preview environments"],
  },
];

export const FORECAST = [
  { d: "TUE", t: "18°", icon: "⛅" },
  { d: "WED", t: "20°", icon: "☀" },
  { d: "THU", t: "17°", icon: "🌧" },
  { d: "FRI", t: "19°", icon: "⛅" },
  { d: "SAT", t: "22°", icon: "☀" },
];

export function detectExperience(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("crm") || (p.includes("build") && (p.includes("crm") || p.includes("customer"))))
    return "crm";
  if (p.includes("weather") || p.includes("forecast") || p.includes("temperature"))
    return "weather";
  if (
    p.includes("tesla") ||
    p.includes("search") ||
    p.includes("tell me about") ||
    p.includes("knowledge")
  )
    return "search";
  return "general";
}

export function answerFor(prompt) {
  const kind = detectExperience(prompt);
  if (kind === "weather") {
    return {
      kind,
      text:
        "It’s currently 18°C in Pretoria with partly cloudy skies. Comfortable outside, light wind at 12 km/h, and only a small chance of rain. You won’t need an umbrella.",
      speak:
        "Good day. It’s currently 18 degrees in Pretoria with partly cloudy skies. Comfortable outside, and only a small chance of rain.",
    };
  }
  if (kind === "crm") {
    return {
      kind,
      text: `CRM mission accepted. I’ve spun up a live execution board across Planning, Design, Database, Frontend, Backend, AI, and Deployment.

Each stage is interactive — open any card for the workspace detail. Next I can generate schema SQL, API routes, or the deal board UI.`,
      speak:
        "CRM mission accepted. I’ve opened a live execution board. Click any stage to inspect the workspace, and tell me which slice to generate next.",
    };
  }
  if (kind === "search") {
    const tesla = prompt.toLowerCase().includes("tesla");
    return {
      kind,
      text: tesla
        ? `**Tesla — concise briefing**

Tesla designs electric vehicles, energy storage, and solar. Software (OTA updates, autonomy ambitions) is as central as hardware.

**Signals**
- Products: Model 3 / Y / S / X, Cybertruck, Powerwall, Megapack
- Moat: charging network, manufacturing scale, brand demand
- Watch: margins, competition, autonomy timelines

I can go deeper on vehicles, energy, or competitors.`
        : `I searched memory and project knowledge.

**Findings**
- Prefer magic-link auth for CRM MVP
- Keep RBAC at workspace + role level
- Store audit events beside deals and contacts

I can draft the auth flow or generate schema next.`,
      speak: tesla
        ? "Tesla builds electric vehicles and energy products, with software as a core advantage. I can go deeper on any slice you want."
        : "I found relevant patterns in your knowledge. Prefer magic link auth and workspace-level RBAC for the CRM MVP.",
    };
  }
  return {
    kind: "general",
    text: `Understood — treating this as an OS-level task.

1. Capture the outcome in memory
2. Plan the thinnest useful slice
3. Execute with visible status
4. Keep knowledge updated

You asked: “${prompt.trim()}”

I’ll proceed with that framing. Tell me the concrete result you want next and I’ll execute.`,
    speak: `Understood. I’ve captured your request and I’m ready to execute the next concrete step.`,
  };
}
