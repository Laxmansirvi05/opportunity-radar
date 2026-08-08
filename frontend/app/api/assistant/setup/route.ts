import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/assistant/setup
 * 
 * One-time endpoint to create the chat tables.
 * Uses the service role key to bypass RLS.
 * Protected: only works if tables don't exist yet.
 */
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey);

  // Check if tables already exist
  const { error: checkErr } = await admin
    .from("chat_conversations")
    .select("id")
    .limit(0);

  if (!checkErr) {
    return NextResponse.json({
      success: true,
      message: "Tables already exist. No action needed.",
    });
  }

  // Tables don't exist. We need to create them.
  // Since Supabase REST API doesn't support DDL, we'll provide the SQL
  // and instructions.
  const migrationSQL = `-- Run this SQL in your Supabase Dashboard → SQL Editor

-- Create chat_conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('user', 'ai')) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_conversations
CREATE POLICY "Users can insert their own conversations"
    ON public.chat_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own conversations"
    ON public.chat_conversations FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations"
    ON public.chat_conversations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations"
    ON public.chat_conversations FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can insert their own messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.chat_conversations conversation
        WHERE conversation.id = conversation_id
          AND conversation.user_id = auth.uid()
      )
    );
CREATE POLICY "Users can view their own messages"
    ON public.chat_messages FOR SELECT
    USING (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.chat_conversations conversation
        WHERE conversation.id = conversation_id
          AND conversation.user_id = auth.uid()
      )
    );
CREATE POLICY "Users can update their own messages"
    ON public.chat_messages FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages"
    ON public.chat_messages FOR DELETE
    USING (auth.uid() = user_id);
`;

  return NextResponse.json({
    success: false,
    error: "Tables do not exist",
    code: checkErr.code,
    message: checkErr.message,
    action: "Run the following SQL in your Supabase Dashboard → SQL Editor",
    sql: migrationSQL,
    dashboardUrl: `https://supabase.com/dashboard/project/pkfghzeeyqngpquaspuz/sql/new`,
  });
}
