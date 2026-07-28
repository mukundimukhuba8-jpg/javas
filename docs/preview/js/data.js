export const GOALS = [
  { id: "startup", emoji: "🚀", label: "Startup or SaaS" },
  { id: "mobile", emoji: "📱", label: "Mobile App" },
  { id: "website", emoji: "🌐", label: "Website" },
  { id: "agent", emoji: "🤖", label: "AI Agent" },
  { id: "business", emoji: "💼", label: "Business" },
  { id: "marketing", emoji: "📈", label: "Marketing System" },
  { id: "trading", emoji: "💰", label: "Trading System" },
  { id: "ecommerce", emoji: "🛒", label: "Ecommerce Store" },
  { id: "learning", emoji: "🎓", label: "Learning Project" },
  { id: "assistant", emoji: "🧠", label: "Personal Assistant" },
  { id: "automation", emoji: "📊", label: "Automation" },
  { id: "custom", emoji: "⚙️", label: "Custom Project" },
];

export const SIDE_LINKS = [
  "Home",
  "Chat",
  "Projects",
  "Knowledge",
  "Tasks",
  "Agents",
  "Automation",
  "Documents",
  "Code",
  "Voice",
  "Analytics",
  "Marketplace",
  "Settings",
];

export const PIPELINE = [
  "Listening",
  "Voice Recognition",
  "Understanding Intent",
  "Searching Memory",
  "Searching Knowledge",
  "Running AI Tools",
  "Validating Results",
  "Generating Response",
  "Speaking",
];

export const SUGGESTIONS = [
  "Build me a CRM",
  "What's the weather?",
  "Tell me about Tesla",
  "Search my knowledge for auth patterns",
];

export const MEMORY_SEED = [
  { title: "Working Memory", body: "Awaiting first request" },
  { title: "Recent Context", body: "Workspace initialized" },
  { title: "Project Memory", body: "No active project yet" },
  { title: "Goals", body: "Set during onboarding" },
  { title: "Long-Term Memory", body: "Calm · premium · decisive" },
  { title: "Knowledge Graph", body: "Ready to expand" },
];

export const THINKING_LINES = [
  "Analyzing Request...",
  "Searching Memory...",
  "Building Plan...",
  "Connecting Knowledge...",
  "Preparing Response...",
];

export const CRM_STAGES = [
  {
    id: "architecture",
    name: "Planning System Architecture",
    detail: [
      "Modular monolith for MVP speed",
      "Next.js app router + Postgres",
      "Bounded contexts: CRM, Auth, Billing",
    ],
  },
  {
    id: "database",
    name: "Designing Database",
    detail: ["contacts", "companies", "deals", "activities", "users / workspaces"],
  },
  {
    id: "frontend",
    name: "Building Frontend",
    detail: ["Pipeline board", "Contact profile", "Activity timeline", "Command palette"],
  },
  {
    id: "auth",
    name: "Preparing Authentication",
    detail: ["Email magic link", "Google OAuth", "Workspace invites"],
  },
  {
    id: "backend",
    name: "Backend Services",
    detail: ["CRUD APIs", "Permissions", "Audit log", "Webhooks"],
  },
  {
    id: "deploy",
    name: "Deployment",
    detail: ["Vercel web", "Supabase db", "Preview environments"],
  },
];

export function detectExperience(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("crm") || (p.includes("build") && p.includes("crm"))) return "crm";
  if (p.includes("weather")) return "weather";
  if (p.includes("tesla") || p.includes("search") || p.includes("tell me about") || p.includes("knowledge"))
    return "search";
  if (p.includes("trading")) return "trading";
  return "general";
}
