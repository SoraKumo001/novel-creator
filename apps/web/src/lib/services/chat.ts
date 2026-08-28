import { apiClient } from '../api-client.js';
import type {
  ChatSession,
  ChatSessionDetail,
  CreateChatSessionInput,
  ExtractedChatEntities,
  UpdateChatSessionInput,
} from '../types.js';

export async function fetchChatSessions(novelId?: string): Promise<ChatSession[]> {
  const res = await apiClient.chat.sessions.$get({
    query: { novelId: novelId || undefined },
  });
  if (!res.ok) throw new Error('Failed to fetch chat sessions');
  const rows = await res.json();
  return rows.map((s) => ({
    id: s.id,
    novelId: s.novelId || null,
    title: s.title,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
  }));
}

export async function fetchChatSession(id: string): Promise<ChatSessionDetail> {
  const res = await apiClient.chat.sessions[':id'].$get({ param: { id } });
  if (!res.ok) throw new Error('Failed to fetch chat session');
  const s = await res.json();
  return {
    id: s.id,
    novelId: s.novelId || null,
    title: s.title,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
    messages: s.messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    })),
  };
}

export async function createChatSession(input: CreateChatSessionInput): Promise<ChatSession> {
  const res = await apiClient.chat.sessions.$post({
    json: {
      novelId: input.novelId,
      title: input.title,
    },
  });
  if (!res.ok) throw new Error('Failed to create chat session');
  const s = await res.json();
  return {
    id: s.id,
    novelId: s.novelId || null,
    title: s.title,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
  };
}

export async function updateChatSession(
  id: string,
  input: UpdateChatSessionInput,
): Promise<ChatSession> {
  const res = await apiClient.chat.sessions[':id'].$put({
    param: { id },
    json: {
      title: input.title,
    },
  });
  if (!res.ok) throw new Error('Failed to update chat session');
  const s = await res.json();
  return {
    id: s.id,
    novelId: s.novelId || null,
    title: s.title,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
  };
}

export async function deleteChatSession(id: string): Promise<void> {
  const res = await apiClient.chat.sessions[':id'].$delete({ param: { id } });
  if (!res.ok) throw new Error('Failed to delete chat session');
}

export async function extractChatEntities(text: string): Promise<ExtractedChatEntities> {
  const res = await apiClient.chat['extract-entities'].$post({
    json: { text },
  });
  if (!res.ok) throw new Error('Failed to extract chat entities');
  const data = await res.json();
  return {
    characters: data.characters.map((c) => ({
      name: c.name,
      category: c.category,
      description: c.description,
      traits: c.traits,
    })),
    settings: data.settings.map((s) => ({
      name: s.name,
      category: s.category,
      description: s.description,
    })),
  };
}
