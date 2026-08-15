import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import type { Conversation } from "../types";
import { MAX_CONVERSATIONS } from "../types";
import {
  fetchConversations,
  fetchMessages,
  createConversation,
  updateConversationTitle,
  deleteConversationById,
  deleteMessageById,
  insertMessage,
  enforceConversationLimit,
  sendChatMessage,
} from "../services/api";

interface ChatState {
  conversations: Conversation[];
  activeId: string;
  isLoading: boolean;
  isHydrated: boolean;
}

interface ChatActions {
  hydrate: () => Promise<void>;
  setActiveId: (id: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
}

const formatTime = (dateStr?: string) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const generateTitle = (msg: string) =>
  msg.length > 35 ? msg.substring(0, 35) + "…" : msg;

const EMPTY_CONVERSATION: Conversation = {
  id: "__empty__",
  title: "New Chat",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [],
  messagesLoaded: true,
};

export const useChatStore = create<ChatState & ChatActions>()(
  immer((set, get) => ({
    conversations: [],
    activeId: "",
    isLoading: false,
    isHydrated: false,

    hydrate: async () => {
      try {
        const dbConvos = await fetchConversations();
        const convos: Conversation[] = dbConvos.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          messages: [],
          messagesLoaded: false,
        }));

        set((s) => {
          s.conversations = convos;
          s.isHydrated = true;
        });

        // Load messages for the first conversation
        if (convos.length > 0) {
          await get().setActiveId(convos[0].id);
        }
      } catch (err) {
        console.error("[AI Assistant] hydrate error:", err);
        set({ isHydrated: true });
      }
    },

    setActiveId: async (id) => {
      set({ activeId: id });
      if (!id || id === "__empty__") return;

      const convo = get().conversations.find((c) => c.id === id);
      if (convo && !convo.messagesLoaded) {
        try {
          const msgs = await fetchMessages(id);
          set((s) => {
            const c = s.conversations.find((c) => c.id === id);
            if (c) {
              c.messages = msgs;
              c.messagesLoaded = true;
            }
          });
        } catch (err) {
          console.error("[AI Assistant] setActiveId error:", err);
        }
      }
    },

    startNewChat: async () => {
      const dbConvo = await createConversation("New Chat");
      if (!dbConvo) return;

      const newConvo: Conversation = {
        id: dbConvo.id,
        title: dbConvo.title,
        createdAt: dbConvo.created_at,
        updatedAt: dbConvo.updated_at,
        messages: [],
        messagesLoaded: true,
      };

      set((s) => {
        s.conversations.unshift(newConvo);
        s.activeId = newConvo.id;
        s.isLoading = false;
      });

      // The database trigger is authoritative. This is a backwards-compatible
      // cleanup for installations that have not yet run the hardening migration.
      await enforceConversationLimit();
      const conversations = [...get().conversations]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, MAX_CONVERSATIONS);
      set({ conversations });
    },

    deleteChat: async (id) => {
      const deleted = await deleteConversationById(id);
      if (!deleted) return;
      set((s) => {
        s.conversations = s.conversations.filter((c) => c.id !== id);
        if (s.activeId === id) {
          s.activeId = s.conversations[0]?.id || "";
        }
      });
      const newActiveId = get().activeId;
      if (newActiveId) {
        await get().setActiveId(newActiveId);
      }
    },

    sendMessage: async (content: string) => {
      let { activeId } = get();

      // Auto-create conversation if none
      if (
        !activeId ||
        activeId === "__empty__" ||
        !get().conversations.find((c) => c.id === activeId)
      ) {
        await get().startNewChat();
        activeId = get().activeId;
      }
      if (!activeId) return;

      const currentConvo = get().conversations.find((c) => c.id === activeId);
      if (!currentConvo) return;

      const isFirstUserMsg =
        currentConvo.messages.filter((m) => m.role === "user").length === 0;
      const newTitle = isFirstUserMsg
        ? generateTitle(content)
        : currentConvo.title;

      // Optimistic user message
      const tempId = `temp-${Date.now()}`;
      set((s) => {
        const c = s.conversations.find((c) => c.id === activeId);
        if (c) {
          c.messages.push({
            id: tempId,
            role: "user",
            content,
            time: formatTime(),
          });
          c.title = newTitle;
          c.updatedAt = new Date().toISOString();
        }
        s.isLoading = true;
      });

      try {
        // Persist user message & update title
        const [dbMsg, titleUpdated] = await Promise.all([
          insertMessage(activeId, "user", content),
          isFirstUserMsg
            ? updateConversationTitle(activeId, newTitle)
            : Promise.resolve(true),
        ]);

        if (!dbMsg || !titleUpdated) {
          throw new Error("Unable to save this message.");
        }

        // Fix temp ID
        if (dbMsg) {
          set((s) => {
            const c = s.conversations.find((c) => c.id === activeId);
            const m = c?.messages.find((m) => m.id === tempId);
            if (m) m.id = dbMsg.id;
          });
        }

        // Call AI
        const apiMessages = get()
          .conversations.find((c) => c.id === activeId)
          ?.messages.map((m) => ({ role: m.role, content: m.content })) || [];

        const result = await sendChatMessage(apiMessages);

        const aiContent =
          result.text || result.error || "I couldn't generate a response. Please try again.";
        const aiDbMsg = await insertMessage(
          activeId,
          "ai",
          aiContent,
          result.opportunities
        );

        if (!aiDbMsg) {
          throw new Error("Unable to save the AI response.");
        }

        set((s) => {
          const c = s.conversations.find((c) => c.id === activeId);
          if (c) {
            c.messages.push({
              id: aiDbMsg.id,
              role: "ai",
              content: aiContent,
              time: formatTime(aiDbMsg.created_at),
              opportunities: result.opportunities,
            });
            c.updatedAt = new Date().toISOString();
          }
        });
      } catch (err) {
        console.error("[AI Assistant] sendMessage error:", err);
        set((s) => {
          const c = s.conversations.find((c) => c.id === activeId);
          if (c) {
            c.messages.push({
              id: `err-${Date.now()}`,
              role: "ai",
              content:
                "Unable to connect to AI service. Please try again later.",
              time: formatTime(),
            });
          }
        });
      } finally {
        set({ isLoading: false });
      }
    },

    regenerateLastResponse: async () => {
      const { activeId, conversations, isLoading } = get();
      if (isLoading) return;

      const convo = conversations.find((c) => c.id === activeId);
      if (!convo || convo.messages.length < 2) return;

      // Find the last user message
      const lastUserIdx = [...convo.messages]
        .reverse()
        .findIndex((m) => m.role === "user");
      if (lastUserIdx === -1) return;

      const actualIdx = convo.messages.length - 1 - lastUserIdx;
      const lastResponse = convo.messages[convo.messages.length - 1];
      if (lastResponse.role !== "ai") return;

      // Generate the replacement BEFORE touching the existing response.
      // Previously this deleted the old (working) answer from the database
      // first, then generated a replacement — so a failure anywhere in
      // generation permanently lost the old answer, with the fallback
      // "Failed to regenerate" text existing only in local state (never
      // persisted), gone on the next reload too. Flagged 12 Aug, fixed
      // 16 Aug: the old message now stays untouched, in the UI and the
      // database, unless and until a replacement is confirmed saved.
      set((s) => {
        s.isLoading = true;
      });

      try {
        const apiMessages = convo.messages
          .slice(0, actualIdx + 1)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await sendChatMessage(apiMessages);
        const aiContent =
          result.text || result.error || "I couldn't generate a response. Please try again.";
        const aiDbMsg = await insertMessage(
          activeId,
          "ai",
          aiContent,
          result.opportunities
        );

        if (!aiDbMsg) {
          throw new Error("Unable to save the regenerated response.");
        }

        // Only now, with the replacement confirmed saved, remove the old one.
        const deleted = await deleteMessageById(lastResponse.id);
        if (!deleted) {
          // The new answer is safely saved even if cleanup of the old row
          // failed — worst case the conversation shows both, never neither.
          console.error("[AI Assistant] regenerate: failed to delete the superseded response", lastResponse.id);
        }

        set((s) => {
          const c = s.conversations.find((c) => c.id === activeId);
          if (c) {
            c.messages = c.messages.slice(0, actualIdx + 1);
            c.messages.push({
              id: aiDbMsg.id,
              role: "ai",
              content: aiContent,
              time: formatTime(aiDbMsg.created_at),
              opportunities: result.opportunities,
            });
          }
        });
      } catch {
        // The old response was never touched — nothing to restore. Surface
        // a transient toast instead of mutating the conversation: pushing a
        // second "Failed to regenerate" AI message here would stack a fake
        // error bubble underneath the still-present, still-correct original
        // answer, which reads as if the assistant replied twice.
        toast.error("Couldn't regenerate that response. Please try again.");
      } finally {
        set({ isLoading: false });
      }
    },
  }))
);

export const useActiveConversation = () =>
  useChatStore(
    (s) => s.conversations.find((c) => c.id === s.activeId) || EMPTY_CONVERSATION
  );
