import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchConversations: vi.fn(),
  fetchMessages: vi.fn(),
  createConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
  deleteConversationById: vi.fn(),
  deleteMessageById: vi.fn(),
  insertMessage: vi.fn(),
  enforceConversationLimit: vi.fn(),
  sendChatMessage: vi.fn(),
}));

vi.mock("@/features/ai-assistant/services/api", () => api);

import { useChatStore } from "@/features/ai-assistant/store/chat-store";
import type { Conversation } from "@/features/ai-assistant/types";

const timestamp = "2026-08-07T10:00:00.000Z";

function conversation(id: string, messages: Conversation["messages"] = []): Conversation {
  return {
    id,
    title: id,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages,
    messagesLoaded: true,
  };
}

describe("AI assistant chat store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.enforceConversationLimit.mockResolvedValue(true);
    api.updateConversationTitle.mockResolvedValue(true);
    api.deleteConversationById.mockResolvedValue(true);
    api.deleteMessageById.mockResolvedValue(true);
    useChatStore.setState({
      conversations: [],
      activeId: "",
      isLoading: false,
      isHydrated: false,
    });
  });

  it("creates a conversation, saves both messages, and retains opportunity cards", async () => {
    api.createConversation.mockResolvedValue({
      id: "chat-1",
      title: "New Chat",
      created_at: timestamp,
      updated_at: timestamp,
    });
    api.insertMessage
      .mockResolvedValueOnce({ id: "user-1", created_at: timestamp })
      .mockResolvedValueOnce({ id: "assistant-1", created_at: timestamp });
    api.sendChatMessage.mockResolvedValue({
      text: "Here is a match.",
      opportunities: [{
        id: "opportunity-1",
        title: "Frontend Intern",
        company: "Acme",
        location: "Remote",
        tags: ["React"],
        deadline: timestamp,
        applyUrl: "https://example.test/apply",
      }],
    });

    await useChatStore.getState().sendMessage("Find frontend internships");

    const state = useChatStore.getState();
    expect(state.activeId).toBe("chat-1");
    expect(state.isLoading).toBe(false);
    expect(state.conversations[0].title).toBe("Find frontend internships");
    expect(state.conversations[0].messages).toMatchObject([
      { id: "user-1", role: "user", content: "Find frontend internships" },
      { id: "assistant-1", role: "ai", content: "Here is a match." },
    ]);
    expect(state.conversations[0].messages[1].opportunities).toHaveLength(1);
    expect(api.insertMessage).toHaveBeenNthCalledWith(2, "chat-1", "ai", "Here is a match.", expect.any(Array));
  });

  it("switches conversations and loads their persisted message history once", async () => {
    api.fetchConversations.mockResolvedValue([
      { id: "chat-1", title: "First", created_at: timestamp, updated_at: timestamp },
      { id: "chat-2", title: "Second", created_at: timestamp, updated_at: timestamp },
    ]);
    api.fetchMessages.mockImplementation(async (id: string) => [
      { id: `${id}-message`, role: "user", content: id, time: "10:00" },
    ]);

    await useChatStore.getState().hydrate();
    await useChatStore.getState().setActiveId("chat-2");
    await useChatStore.getState().setActiveId("chat-2");

    expect(useChatStore.getState().activeId).toBe("chat-2");
    expect(useChatStore.getState().conversations[1].messages[0].content).toBe("chat-2");
    expect(api.fetchMessages).toHaveBeenCalledTimes(2);
  });

  it("deletes the persisted last response before regenerating it", async () => {
    useChatStore.setState({
      activeId: "chat-1",
      conversations: [conversation("chat-1", [
        { id: "user-1", role: "user", content: "Explain DBMS", time: "10:00" },
        { id: "assistant-old", role: "ai", content: "Old answer", time: "10:01" },
      ])],
    });
    api.sendChatMessage.mockResolvedValue({ text: "New answer" });
    api.insertMessage.mockResolvedValue({ id: "assistant-new", created_at: timestamp });

    await useChatStore.getState().regenerateLastResponse();

    expect(api.deleteMessageById).toHaveBeenCalledWith("assistant-old");
    expect(useChatStore.getState().conversations[0].messages).toMatchObject([
      { id: "user-1", role: "user" },
      { id: "assistant-new", role: "ai", content: "New answer" },
    ]);
  });

  it("removes the selected conversation only after its database delete succeeds", async () => {
    useChatStore.setState({
      activeId: "chat-1",
      conversations: [conversation("chat-1"), conversation("chat-2")],
    });

    await useChatStore.getState().deleteChat("chat-1");

    expect(api.deleteConversationById).toHaveBeenCalledWith("chat-1");
    expect(useChatStore.getState().activeId).toBe("chat-2");
    expect(useChatStore.getState().conversations.map((item) => item.id)).toEqual(["chat-2"]);
  });

  it("keeps at most seven conversations in client state while the database trigger enforces it server-side", async () => {
    const existing = Array.from({ length: 7 }, (_, index) => conversation(`chat-${index}`));
    api.createConversation.mockResolvedValue({
      id: "chat-new",
      title: "New Chat",
      created_at: "2026-08-07T11:00:00.000Z",
      updated_at: "2026-08-07T11:00:00.000Z",
    });
    useChatStore.setState({ conversations: existing });

    await useChatStore.getState().startNewChat();

    expect(api.enforceConversationLimit).toHaveBeenCalledOnce();
    expect(useChatStore.getState().conversations).toHaveLength(7);
    expect(useChatStore.getState().conversations.some((item) => item.id === "chat-new")).toBe(true);
  });
});
