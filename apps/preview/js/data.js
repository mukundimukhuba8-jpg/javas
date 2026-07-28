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

export const AI_STATES = [
  "Idle",
  "Thinking",
  "Researching",
  "Planning",
  "Coding",
  "Searching",
  "Learning",
  "Executing",
  "Finished",
];

export const SUGGESTIONS = [
  "Build me a CRM",
  "Create a trading SaaS",
  "Design an onboarding automation",
  "Plan a mobile app architecture",
];

export const MEMORY_SEED = [
  { title: "Working Memory", body: "Awaiting first request" },
  { title: "Recent Context", body: "Workspace initialized" },
  { title: "Project Memory", body: "No active project yet" },
  { title: "Goals", body: "Set during onboarding" },
  { title: "Long-Term Memory", body: "Preferences · calm · premium" },
  { title: "Knowledge Graph", body: "Ready to expand" },
];

/** Claude-like reasoning plans keyed by intent */
export function planFor(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("crm")) {
    return {
      task: "Design and scaffold a CRM",
      stateSequence: ["Thinking", "Planning", "Researching", "Coding", "Finished"],
      steps: [
        "Understanding request…",
        "Identifying requirements…",
        "Choosing architecture…",
        "Designing database…",
        "Selecting technologies…",
        "Planning authentication…",
        "Building response…",
      ],
      answer: `Here’s a clean CRM foundation.

## Product shape
- **Contacts & companies** with ownership
- **Deals pipeline** with stages
- **Tasks & follow-ups**
- **Activity timeline**
- **Simple reporting**

## Architecture
| Layer | Choice |
| --- | --- |
| App | Next.js |
| API | Node / tRPC |
| Database | Postgres (Supabase) |
| Auth | Email + Google |
| Hosting | Vercel |

## Database (starter)
\`\`\`sql
contacts(id, name, email, company_id, owner_id)
companies(id, name, domain)
deals(id, title, stage, value, contact_id)
activities(id, type, body, deal_id, created_at)
\`\`\`

## First build slice
1. Auth + workspace
2. Contacts CRUD
3. Deal board
4. Activity log
5. Basic dashboard

I can generate the schema, API routes, and UI next—say which slice to start with.`,
    };
  }

  if (p.includes("trading")) {
    return {
      task: "Build a trading SaaS plan",
      stateSequence: ["Thinking", "Researching", "Planning", "Coding", "Finished"],
      steps: [
        "Understanding request…",
        "Mapping trader workflows…",
        "Choosing market data approach…",
        "Designing risk controls…",
        "Planning agent responsibilities…",
        "Drafting architecture…",
        "Building response…",
      ],
      answer: `I’ll treat this as an AI-native trading SaaS.

## Core modules
- Strategy lab
- Signal engine
- Risk limits
- Trade journal with explanations
- Alerts & billing

## Suggested stack
Next.js · Supabase · Worker for signals · Stripe · Claude for explanations

## Delivery order
1. Paper-trading journal
2. Signal rules engine
3. Broker read-only sync
4. Agent explanations
5. Billing + teams

I can scaffold the project brain and agent team next.`,
    };
  }

  if (p.includes("automation") || p.includes("onboarding")) {
    return {
      task: "Design onboarding automation",
      stateSequence: ["Thinking", "Planning", "Executing", "Finished"],
      steps: [
        "Understanding request…",
        "Extracting trigger and outcomes…",
        "Selecting integrations…",
        "Ordering workflow steps…",
        "Checking failure paths…",
        "Building response…",
      ],
      answer: `Automation drafted:

**When** someone signs up  
**Then**
1. Create project workspace  
2. Send welcome email  
3. Notify Slack  
4. Generate onboarding tasks  
5. Schedule a reminder for tomorrow  

Each step is auditable and can require approval before side effects.`,
    };
  }

  return {
    task: "Plan response",
    stateSequence: ["Thinking", "Planning", "Finished"],
    steps: [
      "Understanding request…",
      "Identifying requirements…",
      "Choosing approach…",
      "Structuring answer…",
      "Building response…",
    ],
    answer: `Understood.

I’ll treat this as an operating-system task—not a one-off chat answer.

**Approach**
1. Clarify outcome  
2. Capture it in project memory  
3. Choose architecture and agents  
4. Execute in thin vertical slices  
5. Keep knowledge updated as we go  

Tell me the product outcome you want shipped first, and I’ll begin with a concrete plan and artifacts.`,
  };
}
