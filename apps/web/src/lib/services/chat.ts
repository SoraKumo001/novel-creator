import { chatClient } from '../grpc-client.js';
import type {
  ChatSession,
  ChatSessionDetail,
  CreateChatSessionInput,
  ExtractedChatEntities,
  UpdateChatSessionInput,
} from '../types.js';

export async function fetchChatSessions(novelId?: string): Promise<ChatSession[]> {
  const res = await chatClient.listChatSessions({ novelId: novelId ?? '' });
  return res.sessions.map((s) => ({
    id: s.id,
    novelId: s.novelId || null,
    title: s.title,
    createdAt: s.createdAt || null,
    updatedAt: s.updatedAt || null,
  }));
}

export async function fetchChatSession(id: string): Promise<ChatSessionDetail> {
  const res = await chatClient.getChatSession({ id });
  const s = res.session!;
  return {
    id: s.id,
    novelId: s.novelId || null,
    title: s.title,
    createdAt: s.createdAt || null,
    updatedAt: s.updatedAt || null,
    messages: res.messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: m.createdAt || null,
    })),
  };
}

export async function createChatSession(input: CreateChatSessionInput): Promise<ChatSession> {
  const res = await chatClient.createChatSession({
    novelId: input.novelId ?? '',
    title: input.title ?? '',
    messages: [],
  });
  return {
    id: res.id,
    novelId: res.novelId || null,
    title: res.title,
    createdAt: res.createdAt || null,
    updatedAt: res.updatedAt || null,
  };
}

export async function updateChatSession(
  id: string,
  input: UpdateChatSessionInput,
): Promise<ChatSession> {
  const res = await chatClient.updateChatSession({
    id,
    title: input.title,
  });
  return {
    id: res.id,
    novelId: res.novelId || null,
    title: res.title,
    createdAt: res.createdAt || null,
    updatedAt: res.updatedAt || null,
  };
}

export async function deleteChatSession(id: string): Promise<void> {
  await chatClient.deleteChatSession({ id });
}

export async function extractChatEntities(text: string): Promise<ExtractedChatEntities> {
  const res = await chatClient.extractEntities({ text });
  return {
    characters: res.characters.map((c) => ({
      name: c.name,
      category: c.category,
      description: c.description,
      traits: c.traits,
    })),
    settings: res.settings.map((s) => ({
      name: s.name,
      category: s.category,
      description: s.description,
    })),
  };
}
