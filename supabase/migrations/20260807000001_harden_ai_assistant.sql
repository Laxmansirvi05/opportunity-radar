-- AI assistant persistence hardening
-- Keeps chat data private, preserves rich opportunity results, and makes the
-- seven-conversation product limit authoritative at the database boundary.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON public.chat_messages(user_id);

-- The initial migration allowed a user to attach a message to another user's
-- conversation. Replace those broad policies with ownership checks on both
-- the message and its parent conversation.
DROP POLICY IF EXISTS "Users can view their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.chat_messages;

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

CREATE POLICY "Users can insert messages in their own conversations"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations conversation
      WHERE conversation.id = conversation_id
        AND conversation.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.chat_messages FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations conversation
      WHERE conversation.id = conversation_id
        AND conversation.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations conversation
      WHERE conversation.id = conversation_id
        AND conversation.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON public.chat_messages FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations conversation
      WHERE conversation.id = conversation_id
        AND conversation.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_chat_conversation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.chat_conversations
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id,
             row_number() OVER (ORDER BY updated_at DESC, created_at DESC) AS position
      FROM public.chat_conversations
      WHERE user_id = NEW.user_id
    ) ranked_conversations
    WHERE position > 7
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_chat_conversation_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS limit_chat_conversations_per_user ON public.chat_conversations;
CREATE TRIGGER limit_chat_conversations_per_user
  AFTER INSERT ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_chat_conversation_limit();
