import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, OpportunityCard } from "../types";

// ── Database types ──────────────────────────────────────────────────

export type ChatSource = "assistant" | "quick";

/** Quick chats are capped so the robot's history stays a short list, not an archive. */
export const MAX_QUICK_CONVERSATIONS = 6;

interface DBConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DBMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "ai";
  content: string;
  metadata?: {
    opportunities?: OpportunityCard[];
  } | null;
  created_at: string;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

// ── Error logger ────────────────────────────────────────────────────

function logSupabaseError(operation: string, table: string, error: SupabaseErrorLike | null, context?: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'unknown';
  
  console.error(`\n========================================================`);
  console.error(`[AI Assistant] DATABASE ERROR DETECTED`);
  console.error(`========================================================`);
  console.error(`• SQL/table name:            ${table}`);
  console.error(`• operation:                 ${operation}`);
  console.error(`• error.code:                ${error?.code ?? 'unknown'}`);
  console.error(`• error.message:             ${error?.message ?? 'unknown'}`);
  console.error(`• error.details:             ${error?.details ?? 'none'}`);
  console.error(`• error.hint:                ${error?.hint ?? 'none'}`);
  console.error(`• HTTP status:               ${error?.status ?? 'unknown'}`);
  console.error(`• request payload (context): ${context ? JSON.stringify(context) : 'none'}`);
  console.error(`• authenticated user id:     ${context?.userId ?? 'unknown'}`);
  console.error(`• current Supabase URL:      ${url}`);
  console.error(`• current schema:            public`);
  console.error(`========================================================\n`);

  // Detect table-not-found so we can give actionable guidance
  if (error?.code === 'PGRST205' || error?.message?.includes('schema cache')) {
    console.error(`⚠️  TABLE '${table}' DOES NOT EXIST.`);
    console.error(`Run the migration SQL in your Supabase Dashboard → SQL Editor.`);
    console.error(`File: supabase/migrations/20260807000000_ai_assistant_tables.sql\n`);
  }
}

// ── Tables-exist check (cached) ─────────────────────────────────────

let tablesExist: boolean | null = null;

async function checkTablesExist(): Promise<boolean> {
  if (tablesExist !== null) return tablesExist;

  const supabase = createClient();
  const { error } = await supabase
    .from("chat_conversations")
    .select("id")
    .limit(0);

  tablesExist = !error;
  if (error) {
    logSupabaseError("checkTablesExist", "chat_conversations", error);
  }
  return tablesExist;
}

// ── Conversation CRUD ───────────────────────────────────────────────

export async function fetchConversations(source: ChatSource = "assistant"): Promise<DBConversation[]> {
  if (!(await checkTablesExist())) return [];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[AI Assistant] fetchConversations: No authenticated user");
    return [];
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("user_id", user.id)
    .eq("source", source)
    .order("updated_at", { ascending: false })
    .limit(source === "quick" ? MAX_QUICK_CONVERSATIONS : 7);

  if (error) {
    logSupabaseError("SELECT", "chat_conversations", error, { userId: user.id });
    return [];
  }
  return (data ?? []) as DBConversation[];
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!(await checkTablesExist())) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    logSupabaseError("SELECT", "chat_messages", error, { conversationId });
    return [];
  }

  return ((data ?? []) as DBMessage[]).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    opportunities: m.metadata?.opportunities,
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}

export async function createConversation(
  title: string,
  source: ChatSource = "assistant"
): Promise<DBConversation | null> {
  if (!(await checkTablesExist())) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[AI Assistant] createConversation: No authenticated user");
    return null;
  }

  // Quick chats are capped at MAX_QUICK_CONVERSATIONS: before inserting a new
  // one, the oldest beyond the cap is removed, so the robot's history stays a
  // short recent list rather than growing without bound.
  if (source === "quick") {
    const { data: existing } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("source", "quick")
      .order("updated_at", { ascending: false });

    const stale = (existing ?? []).slice(MAX_QUICK_CONVERSATIONS - 1).map((row) => row.id as string);
    if (stale.length > 0) {
      const { error: pruneError } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("user_id", user.id)
        .in("id", stale);
      if (pruneError) {
        // Not fatal — an over-cap list is better than refusing a new chat.
        logSupabaseError("DELETE", "chat_conversations", pruneError, { userId: user.id });
      }
    }
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert([{ title, user_id: user.id, source }])
    .select()
    .single();

  if (error) {
    logSupabaseError("INSERT", "chat_conversations", error, {
      userId: user.id,
      title,
    });
    return null;
  }
  return data as DBConversation;
}

export async function updateConversationTitle(id: string, title: string): Promise<boolean> {
  if (!(await checkTablesExist())) return false;

  const supabase = createClient();
  const { error } = await supabase
    .from("chat_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logSupabaseError("UPDATE", "chat_conversations", error, { id, title });
    return false;
  }
  return true;
}

export async function deleteConversationById(id: string): Promise<boolean> {
  if (!(await checkTablesExist())) return false;

  const supabase = createClient();
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", id);

  if (error) {
    logSupabaseError("DELETE", "chat_conversations", error, { id });
    return false;
  }
  return true;
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "ai",
  content: string,
  opportunities?: OpportunityCard[]
): Promise<DBMessage | null> {
  if (!(await checkTablesExist())) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[AI Assistant] insertMessage: No authenticated user");
    return null;
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert([
      {
        conversation_id: conversationId,
        role,
        content,
        user_id: user.id,
        metadata: opportunities?.length ? { opportunities } : null,
      },
    ])
    .select()
    .single();

  if (error) {
    logSupabaseError("INSERT", "chat_messages", error, {
      conversationId,
      role,
      userId: user.id,
      contentLength: content.length,
    });
    return null;
  }

  // Touch the conversation's updated_at
  await supabase
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data as DBMessage;
}

export async function deleteMessageById(id: string): Promise<boolean> {
  if (!(await checkTablesExist())) return false;

  const supabase = createClient();
  const { error } = await supabase.from("chat_messages").delete().eq("id", id);

  if (error) {
    logSupabaseError("DELETE", "chat_messages", error, { id });
    return false;
  }
  return true;
}

// ── Enforce 7-conversation limit ────────────────────────────────────

export async function enforceConversationLimit(): Promise<boolean> {
  if (!(await checkTablesExist())) return false;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: convos } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (convos && convos.length > 7) {
    const toDelete = convos.slice(7).map((c: { id: string }) => c.id);
    const { error } = await supabase.from("chat_conversations").delete().in("id", toDelete);
    if (error) {
      logSupabaseError("DELETE limit overflow", "chat_conversations", error, { userId: user.id });
      return false;
    }
  }
  return true;
}

// ── AI Chat API call ────────────────────────────────────────────────

export async function sendChatMessage(
  messages: { role: string; content: string }[],
  source: ChatSource = "assistant"
): Promise<{ text?: string; opportunities?: OpportunityCard[]; error?: string }> {
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The quick popup asks the same assistant for a short answer; the route
      // is what enforces brevity, not the caller.
      body: JSON.stringify({ messages, mode: source === "quick" ? "quick" : undefined }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[AI Assistant] API error:", data);
      return { error: data.error || "Failed to get AI response" };
    }
    return {
      text: data.text,
      opportunities: data.opportunities,
    };
  } catch (err) {
    console.error("[AI Assistant] Network error:", err);
    return { error: "Network error. Please try again." };
  }
}
