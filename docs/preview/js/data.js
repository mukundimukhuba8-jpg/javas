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

export const SUGGESTIONS = [
  "Build me a CRM",
  "What's the weather?",
  "Tell me about Tesla",
  "I need help",
];

export const CRM_STAGES = [
  {
    id: "planning",
    name: "Planning",
    detail: [
      "Scope: contacts, companies, deals, activities",
      "Fast MVP path with a modular monolith",
      "Clear boundaries for CRM, auth, and billing",
    ],
  },
  {
    id: "design",
    name: "Design",
    detail: [
      "Pipeline board as the main surface",
      "Contact profile and activity timeline",
      "Command palette for quick actions",
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
    detail: ["App shell", "Deal board", "Lightweight realtime cues"],
  },
  {
    id: "backend",
    name: "Backend",
    detail: ["CRUD APIs", "Permissions", "Audit log", "Webhooks"],
  },
  {
    id: "ai",
    name: "AI",
    detail: ["Lead scoring", "Email draft help", "Meeting summaries"],
  },
  {
    id: "deployment",
    name: "Deployment",
    detail: ["Web hosting", "Managed database", "Preview environments"],
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
  const p = prompt.toLowerCase().trim();
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|howdy)\b/.test(p) || p === "yo")
    return "greeting";
  if (
    /\b(i need help|help me|can you help|stuck|not sure)\b/.test(p) ||
    p === "help" ||
    p === "i need help"
  )
    return "help";
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

/**
 * Natural conversational replies — never system-telemetry narration.
 */
export function answerFor(prompt, history = []) {
  const kind = detectExperience(prompt);
  const trimmed = prompt.trim();

  if (kind === "greeting") {
    return {
      kind,
      opener: null,
      text: "Hi! How can I help you today?",
      speak: "Hi! How can I help you today?",
      status: [],
    };
  }

  if (kind === "help") {
    return {
      kind,
      opener: null,
      text: "Of course. Tell me what's going on, and we'll work through it together.",
      speak: "Of course. Tell me what's going on, and we'll work through it together.",
      status: [],
    };
  }

  if (kind === "weather") {
    return {
      kind,
      opener: "Let me check the weather for your current location.",
      text:
        "It's currently 18°C with partly cloudy skies. There's a light breeze and only a small chance of rain today. Perfect for being outside if you'd like.",
      speak:
        "It's currently 18 degrees with partly cloudy skies. There's a light breeze and only a small chance of rain today.",
      status: ["Checking your location", "Reading current conditions"],
    };
  }

  if (kind === "crm") {
    return {
      kind,
      opener:
        "Absolutely. I'll plan the project first, then break it into manageable stages so you can review each part before we build.",
      text:
        "I've laid out Planning, Design, Database, Frontend, Backend, AI, and Deployment. Open any stage when you want the detail — or tell me which part you'd like to start with.",
      speak:
        "I've laid out the project in clear stages. Open any one when you want more detail, or tell me which part you'd like to start with.",
      status: ["Mapping the project", "Preparing stages"],
    };
  }

  if (kind === "search") {
    const tesla = trimmed.toLowerCase().includes("tesla");
    if (tesla) {
      return {
        kind,
        opener: "Let me pull together a clear overview.",
        text:
          "Tesla builds electric vehicles and energy products, and software is a big part of what makes them stand out — things like over-the-air updates and autonomy work.\n\nIf it helps, I can go deeper on the cars, the energy business, or how they compare with competitors. What would be most useful?",
        speak:
          "Tesla builds electric vehicles and energy products, and software is a big part of what makes them stand out. I can go deeper on the cars, energy, or competitors — what would help most?",
        status: ["Gathering the latest context"],
      };
    }
    return {
      kind,
      opener: "I've found what you're looking for.",
      text:
        "From your project knowledge, a solid CRM MVP path is magic-link auth, workspace-level permissions, and audit events kept next to deals and contacts.\n\nWant me to draft the auth flow, or sketch the database next?",
      speak:
        "From your project knowledge, a solid CRM MVP path is magic-link auth, workspace-level permissions, and audit events next to deals and contacts. Want me to draft auth, or sketch the database next?",
      status: ["Checking your notes"],
    };
  }

  // Context-aware general replies
  const recent = history.filter((m) => m.role === "user").slice(-2).map((m) => m.content.toLowerCase());
  const afterCrm = recent.some((t) => t.includes("crm"));
  const afterWeather = recent.some((t) => t.includes("weather"));

  if (/\b(thanks|thank you|thx)\b/i.test(trimmed)) {
    return {
      kind: "general",
      opener: null,
      text: "You're welcome. Anything else I can help with?",
      speak: "You're welcome. Anything else I can help with?",
      status: [],
    };
  }

  if (afterCrm && /\b(schema|database|sql|api|frontend|backend|start|next)\b/i.test(trimmed)) {
    return {
      kind: "general",
      opener: "Happy to keep going on the CRM.",
      text: `For “${trimmed}”, I'd start with the thinnest useful slice, show it clearly, then iterate with you.\n\nShould I draft the database schema first, or the deal board UI?`,
      speak:
        "Happy to keep going on the CRM. Should I draft the database schema first, or the deal board UI?",
      status: [],
    };
  }

  if (afterWeather && /\b(tomorrow|weekend|umbrella|rain|jacket)\b/i.test(trimmed)) {
    return {
      kind: "general",
      opener: null,
      text: "Looking at the next few days, it stays mild — around 17 to 22°C — with Thursday looking like the wetter day. A light jacket is enough; an umbrella is only really useful if you're out Thursday.",
      speak:
        "It stays mild over the next few days, with Thursday looking wetter. A light jacket is enough, and an umbrella mainly if you're out Thursday.",
      status: [],
    };
  }

  return {
    kind: "general",
    opener: "I can help with that.",
    text: `Here's how I'd approach it: clarify the outcome you want, take the smallest useful step, and keep you in the loop as we go.\n\nYou said: “${trimmed}”\n\nWhat would a good result look like for you?`,
    speak: `I can help with that. What would a good result look like for you?`,
    status: [],
  };
}
