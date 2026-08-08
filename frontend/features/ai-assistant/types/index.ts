export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  time: string;
  opportunities?: OpportunityCard[];
}

export interface OpportunityCard {
  id: string;
  title: string;
  company: string;
  companyLogo?: string | null;
  location: string;
  tags: string[];
  deadline: string | null;
  applyUrl: string;
  matchLabel?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  /** Prevents an empty conversation from being fetched on every switch. */
  messagesLoaded?: boolean;
}

export const MAX_CONVERSATIONS = 7;

export const SUGGESTION_CHIPS = [
  "Create a roadmap to become an AI/ML engineer.",
  "Explain HTML from beginner to advanced.",
  "Teach me Java step by step.",
  "How should I prepare for technical interviews?",
];

export const QUICK_PROMPTS = [
  { icon: "route", label: "Create a roadmap to become an AI/ML engineer.", category: "learning" },
  { icon: "code", label: "Explain HTML from beginner to advanced.", category: "learning" },
  { icon: "menu_book", label: "Teach me Java step by step.", category: "learning" },
  { icon: "school", label: "How should I prepare for technical interviews?", category: "interview" },
  { icon: "storage", label: "Explain DBMS with interview questions.", category: "learning" },
  { icon: "web", label: "Suggest a learning roadmap for web development.", category: "learning" },
] as const;

export const OPPORTUNITY_SEARCH_KEYWORDS = [
  "find", "search", "show", "get", "list", "look",
  "internship", "job", "hackathon", "scholarship", "competition", "workshop",
  "opportunity", "opportunities", "openings", "positions", "roles",
];
