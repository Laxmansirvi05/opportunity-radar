import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-gateway";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sanitizeFilterTerm } from "@/features/opportunities/services/opportunity-service";

interface OpportunitySearchRow {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  deadline: string | null;
  apply_url: string | null;
  companies: { name: string; logo_url: string | null } | null;
  opportunity_tags: { tag_name: string }[] | null;
}

export function isOpportunityQuery(message: string): boolean {
  const lower = message.toLowerCase();
  const asksToSearch = /\b(find|search|show|list|look|recommend|available|open)\b/.test(lower);
  const namesAnOpportunity = /\b(internship|internships|job|jobs|hackathon|hackathons|scholarship|scholarships|competition|competitions|workshop|workshops|opportunity|opportunities|opening|openings|position|positions|role|roles)\b/.test(lower);

  // "Internships for frontend" is a natural short-form search, while a
  // question such as "what is an internship?" should remain a learning query.
  return (asksToSearch && namesAnOpportunity) || /^(internships?|jobs?|hackathons?|scholarships?|competitions?|workshops?|opportunities|openings)\b/.test(lower.trim());
}

export function extractSearchTerms(message: string): { query: string; category: string | null } {
  const lower = message.toLowerCase();

  // Detect category
  let category: string | null = null;
  if (lower.includes("internship")) category = "Internship";
  else if (lower.includes("job") || lower.includes("position") || lower.includes("role")) category = "Job";
  else if (lower.includes("hackathon")) category = "Hackathon";
  else if (lower.includes("scholarship")) category = "Scholarship";
  else if (lower.includes("competition")) category = "Competition";
  else if (lower.includes("workshop")) category = "Workshop";

  // Extract meaningful search terms (remove filler words)
  const fillerWords = new Set([
    "find", "search", "show", "get", "list", "look", "recommend", "me",
    "some", "the", "a", "an", "for", "in", "at", "to", "of", "and",
    "or", "my", "i", "want", "need", "help", "please", "can", "you",
    "with", "about", "related", "matching", "best", "top", "good",
    "relevant", "interesting", "available", "open", "current", "latest",
    "internship", "internships", "job", "jobs", "hackathon", "hackathons",
    "scholarship", "scholarships", "competition", "competitions",
    "workshop", "workshops", "opportunity", "opportunities",
    "openings", "positions", "roles",
  ]);

  const terms = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !fillerWords.has(w));

  return { query: terms.join(" "), category };
}

// ── Search opportunities from database ──────────────────────────────
async function searchOpportunitiesFromDB(
  query: string,
  category: string | null,
  limit: number = 5
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const supabase = createAdminClient(url, key);

  let dbQuery = supabase
    .from("opportunities")
    .select(
      `id, title, company_name, location, category, deadline, apply_url,
       companies (id, name, logo_url),
       opportunity_tags (tag_name)`
    )
    // The assistant has no web-search path. Results are constrained to active
    // rows in Opportunity Radar and ordered by their nearest valid deadline.
    .in("status", ["Published", "Closing Soon"])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`);

  if (category) {
    dbQuery = dbQuery.eq("category", category);
  }

  // The assistant passes free text straight from the user's message, so the
  // same PostgREST filter-injection risk applies here.
  const safeQuery = sanitizeFilterTerm(query ?? '');
  if (safeQuery.length > 0) {
    dbQuery = dbQuery.or(
      `title.ilike.%${safeQuery}%,location.ilike.%${safeQuery}%`
    );
  }

  dbQuery = dbQuery
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(limit);

  const { data, error } = await dbQuery;

  if (error) {
    console.error("[API/Assistant] Opportunity search error:", error);
    return [];
  }

  return ((data ?? []) as unknown as OpportunitySearchRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.companies?.name || row.company_name || "Opportunity Radar",
    companyLogo: row.companies?.logo_url || null,
    location: row.location || "Remote",
    tags: (row.opportunity_tags ?? []).map((tag) => tag.tag_name).slice(0, 4),
    deadline: row.deadline,
    applyUrl: row.apply_url || `/opportunities/${row.id}`,
    matchLabel: category ? "Match" : undefined,
  }));
}

// ── Main handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or empty messages array." },
        { status: 400 }
      );
    }

    const safeMessages = messages
      .filter(
        (message): message is { role: "user" | "ai"; content: string } =>
          message &&
          (message.role === "user" || message.role === "ai") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        // Keep the gateway request bounded without mutating the saved chat.
        content: message.content.trim().slice(0, 8_000),
      }));

    if (safeMessages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Messages must contain text." },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const lastUserMessage = [...safeMessages].reverse().find((m) => m.role === "user");
    const userText = lastUserMessage?.content || "";

    // ── Check if this is an opportunity search ──────────────────
    let opportunities: Awaited<ReturnType<typeof searchOpportunitiesFromDB>> = [];
    if (isOpportunityQuery(userText)) {
      const { query, category } = extractSearchTerms(userText);
      opportunities = await searchOpportunitiesFromDB(query, category, 5);
    }

    // ── Call AI Gateway ─────────────────────────────────────────
    const systemPrompt = `You are an expert AI Career Assistant built into Opportunity Radar — a platform that helps students find internships, jobs, hackathons, scholarships, and workshops.

Your personality: Professional, friendly, concise. You speak like a helpful career mentor.

IMPORTANT RULES:
- When the user asks to find opportunities (internships, jobs, hackathons, etc.), acknowledge their request naturally. The system will automatically attach matching opportunities from the database. DO NOT make up fake companies or listings.
- If opportunities are attached to your response, briefly introduce them (e.g., "Here are some opportunities that match your criteria:"). Do NOT list them in markdown — they will be rendered as interactive cards.
- For resume, interview, and career questions, provide helpful, actionable advice.
- Use markdown formatting for structured responses (bold, lists, headings).
- Keep responses concise but thorough.
- Never search the internet. Only reference opportunities from Opportunity Radar's database.
${opportunities.length > 0 ? `\nThe system found ${opportunities.length} matching opportunities from the database. They will be displayed as interactive cards after your message. Briefly introduce them.` : ""}`;

    const formattedMessages = safeMessages
      .map(
        (m: { role: string; content: string }) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
      )
      .join("\n\n");
    const userPrompt = `Conversation:\n${formattedMessages}\n\nAssistant:`;

    const result = await callAI(
      {
        systemPrompt,
        userPrompt,
        outputFormat: "text",
        maxTokens: 1500,
        temperature: 0.7,
      },
      {
        feature: "assistant",
        userId: user.id,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `AI service temporarily unavailable (${result.reason}). Please try again.` },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      text: result.content,
      opportunities: opportunities.length > 0 ? opportunities : undefined,
    });
  } catch (error: unknown) {
    console.error("[API/Assistant] Internal error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
