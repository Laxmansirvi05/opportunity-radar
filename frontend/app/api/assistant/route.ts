import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-gateway";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sanitizeFilterTerm } from "@/features/opportunities/services/opportunity-service";
import { isOpportunityQuery, extractSearchTerms } from "@/features/ai-assistant/lib/opportunity-query";

// Re-exported so the routing logic stays importable from the route it governs
// (and so existing tests keep their import path).
export { isOpportunityQuery, extractSearchTerms };

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

// ── Search opportunities from database ──────────────────────────────
async function searchOpportunitiesFromDB(
  terms: string[],
  category: string | null,
  limit: number = 5
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { opportunities: [], broadened: false };

  const supabase = createAdminClient(url, key);

  // The assistant passes free text straight from the user's message, so the
  // same PostgREST filter-injection risk applies here.
  const safeTerms = terms
    .map((term) => sanitizeFilterTerm(term))
    .filter((term) => term.length > 0);

  /**
   * Built fresh per attempt rather than shared. PostgREST query builders
   * mutate and return themselves, so reusing one across both attempts below
   * ANDs the loose filter onto the strict one that just failed — the fallback
   * silently could not widen anything.
   *
   * Each term must appear in the title or the location. That is a different
   * query from the one this used to build: it joined every term into a single
   * phrase and matched it as one substring, so "remote machine learning" asked
   * for a title literally containing that phrase and found nothing while five
   * machine-learning listings sat in the table. One `.or()` per term gives OR
   * across the columns and AND across the terms.
   */
  const buildQuery = (mode: "all" | "any") => {
    let query = supabase
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
      query = query.eq("category", category);
    }

    if (safeTerms.length > 0) {
      if (mode === "all") {
        for (const term of safeTerms) {
          query = query.or(`title.ilike.%${term}%,location.ilike.%${term}%`);
        }
      } else {
        query = query.or(
          safeTerms
            .flatMap((term) => [`title.ilike.%${term}%`, `location.ilike.%${term}%`])
            .join(",")
        );
      }
    }

    return query
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(limit);
  };

  const run = async (mode: "all" | "any") => {
    const { data, error } = await buildQuery(mode);
    if (error) {
      console.error("[API/Assistant] Opportunity search error:", error);
      return null;
    }
    return (data ?? []) as unknown as OpportunitySearchRow[];
  };

  // Narrow first. If every term together matches nothing, fall back to any of
  // them rather than reporting an empty database — a long question should
  // degrade to fewer, looser results, never to none.
  let broadened = false;
  let rows = await run("all");
  if (rows !== null && rows.length === 0 && safeTerms.length > 1) {
    rows = await run("any");
    broadened = rows !== null && rows.length > 0;
  }
  if (rows === null) return { opportunities: [], broadened: false };

  const opportunities = rows.map((row) => ({
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

  return { opportunities, broadened };
}

// ── Main handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth checked first, before any request-body validation — matches
    // every other route in this app (SEC-05, found in the 16 Aug audit:
    // this was the one route validating shape before session, so an
    // unauthenticated malformed request got 400 instead of 401).
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

    const body = await req.json();
    const { messages } = body;
    // The robot's Quick Assistant is this same assistant, asked to answer in a
    // popup rather than a full page. Only the shape of the reply differs —
    // same route, same gateway, same tables.
    const isQuick = body.mode === "quick";

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

    const lastUserMessage = [...safeMessages].reverse().find((m) => m.role === "user");
    const userText = lastUserMessage?.content || "";

    // ── Check if this is an opportunity search ──────────────────
    let opportunities: Awaited<ReturnType<typeof searchOpportunitiesFromDB>>["opportunities"] = [];
    let wasBroadened = false;
    const wasSearchAttempted = isOpportunityQuery(userText);
    if (wasSearchAttempted) {
      const { terms, category } = extractSearchTerms(userText);
      const found = await searchOpportunitiesFromDB(terms, category, 5);
      opportunities = found.opportunities;
      wasBroadened = found.broadened;
    }

    // ── Call AI Gateway ─────────────────────────────────────────
    const systemPrompt = `You are an expert AI Career Assistant built into Opportunity Radar — a platform that helps students find internships, jobs, hackathons, scholarships, and workshops.

Your personality: Professional, friendly, concise. You speak like a helpful career mentor.

IMPORTANT RULES:
- When the user asks to find opportunities (internships, jobs, hackathons, etc.), acknowledge their request naturally. The system will automatically attach matching opportunities from the database. DO NOT make up fake companies or listings.
- Only say something like "Here are some opportunities that match your criteria" if this prompt explicitly tells you below that opportunities were found and attached. If none were attached, do NOT claim to be showing, listing, or having found any — say plainly that nothing matched, or suggest the Search page instead.
- If opportunities are attached to your response, briefly introduce them (e.g., "Here are some opportunities that match your criteria:"). Do NOT list them in markdown — they will be rendered as interactive cards.
- For resume, interview, and career questions, provide helpful, actionable advice.
- Use markdown formatting for structured responses (bold, lists, headings).
- Keep responses concise but thorough.
- Never search the internet. Only reference opportunities from Opportunity Radar's database.
${
  isQuick
    ? `
THIS IS A QUICK CHAT, shown in a small popup beside the user's work. Answer in
at most 3 short sentences, or at most 4 brief bullet points — whichever fits the
question better. No headings. No preamble, no sign-off, no "great question".
Answer the thing asked and stop.
If a full answer genuinely needs more room, give the short version and add one
final line: "Ask in the AI Assistant for the full version."`
    : ""
}${
  opportunities.length > 0
    ? wasBroadened
      ? `\nThe system found NO opportunity matching all of the user's criteria, so it broadened the search and is attaching ${opportunities.length} related ones instead. They will be displayed as interactive cards after your message. Say clearly that nothing matched their exact request — naming the part that did not match, such as the location — and introduce these as broader or related results. Do NOT describe them as matching their criteria.`
      : `\nThe system found ${opportunities.length} matching opportunities from the database. They will be displayed as interactive cards after your message. Briefly introduce them.`
    : wasSearchAttempted
      ? `\nThe system searched the database for this request and found NO matching opportunities. Do not say you found or are showing any. If the user was asking for listings, tell them plainly that nothing matched right now and suggest the Search page or broader criteria. If they were really asking for advice rather than listings, just answer the question — do not announce an empty search they did not ask for.`
      : ""
}`;

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
        // Deliberately NOT lowered for quick mode. Lowering it to 400 was
        // tried and produced replies cut off mid-word: gemini-flash-latest is
        // a thinking model, so maxOutputTokens is spent on internal reasoning
        // before any visible text, and a small ceiling starves the answer
        // rather than shortening it. Brevity is enforced by the instruction in
        // the system prompt, which shortens what the model decides to say
        // instead of truncating what it already said.
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
