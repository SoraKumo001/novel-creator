import { parseResponseError } from '../errors.js';
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
  if (!res.ok) throw await parseResponseError(res, 'チャットセッション一覧の取得');
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
  if (!res.ok) throw await parseResponseError(res, 'チャットセッション詳細の取得');
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
      // parts は並行レーン実装の DB jsonb 列。型クライアントが未反映でも許容する
      parts: (m as { parts?: unknown[] | null }).parts ?? null,
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
  if (!res.ok) throw await parseResponseError(res, 'チャットセッションの作成');
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
  if (!res.ok) throw await parseResponseError(res, 'チャットセッションの更新');
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
  if (!res.ok) throw await parseResponseError(res, 'チャットセッションの削除');
}

export async function extractChatEntities(text: string): Promise<ExtractedChatEntities> {
  const res = await apiClient.chat['extract-entities'].$post({
    json: { text },
  });
  if (!res.ok) throw await parseResponseError(res, '設定・人物の抽出');
  const data = (await res.json()) as {
    characters?: { name: string; category: string; description: string; traits: string[] }[];
    settings?: { name: string; category: string; description: string }[];
    foreshadowings?: {
      title: string;
      description: string;
      status: 'unresolved' | 'resolved' | 'abandoned';
    }[];
    timelines?: { event: string; timestamp: string }[];
    plots?: { title: string; summary: string }[];
  };
  return {
    characters: (data.characters || []).map((c) => ({
      name: c.name,
      category: c.category,
      description: c.description,
      traits: c.traits,
    })),
    settings: (data.settings || []).map((s) => ({
      name: s.name,
      category: s.category,
      description: s.description,
    })),
    foreshadowings: (data.foreshadowings || []).map((f) => ({
      title: f.title,
      description: f.description,
      status: f.status,
    })),
    timelines: (data.timelines || []).map((t) => ({
      event: t.event,
      timestamp: t.timestamp,
    })),
    plots: (data.plots || []).map((p) => ({
      title: p.title,
      summary: p.summary,
    })),
  };
}
