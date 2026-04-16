/**
 * Persisted chat transcript for the side panel (chrome.storage.local).
 */

const STORAGE_KEY = 'ytqf_ai_chat_messages_v1';
const MAX_STORED_MESSAGES = 200;

export interface SerializedChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  error?: boolean;
}

export async function loadChatMessages(): Promise<SerializedChatMessage[] | null> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const raw = data[STORAGE_KEY];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.slice(-MAX_STORED_MESSAGES) as SerializedChatMessage[];
  } catch {
    return null;
  }
}

export async function saveChatMessages(messages: SerializedChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-MAX_STORED_MESSAGES);
  await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
}

export async function clearChatMessages(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
