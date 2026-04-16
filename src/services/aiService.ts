/**
 * AI layer: OpenAI-compatible Chat Completions (default: OpenRouter) + YouTrack tools.
 */

import { YouTrackAPIClient } from './youTrackAPIClient';
import { executeYouTrackTool, getYouTrackOpenAITools } from './youTrackMcpTools';

/** Default: OpenRouter unified API */
export const DEFAULT_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Free-tier default on OpenRouter: smaller model tends to hit rate limits less often than 20B OSS.
 * Override in settings if you need another model.
 * @see https://openrouter.ai/models
 */
export const DEFAULT_AI_MODEL = 'google/gemma-3-4b-it:free';

const DEPRECATED_MODEL_IDS = ['google/gemma-2-9b-it:free'];

const STORAGE_KEY_API_KEY = 'ai_api_key';
const STORAGE_KEY_LEGACY_OPENAI = 'openai_api_key';
const STORAGE_KEY_CHAT_URL = 'ai_chat_completions_url';
const STORAGE_KEY_MODEL = 'ai_model';

export interface AiProviderSettings {
  apiKey: string | null;
  chatCompletionsUrl: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  toolTrace?: string[];
}

/** Context for a single assistant turn (browser page + optional loaded issue). */
export interface YouTrackAssistantContext {
  pageUrl?: string | null;
  issueId?: string | null;
  summary?: string;
  description?: string;
}

export class AIService {
  private static instance: AIService;
  private settingsCache: AiProviderSettings | null = null;

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private constructor() {}

  private async loadSettings(): Promise<AiProviderSettings> {
    if (this.settingsCache) {
      if (DEPRECATED_MODEL_IDS.includes(this.settingsCache.model)) {
        const model = DEFAULT_AI_MODEL;
        this.settingsCache = { ...this.settingsCache, model };
        await chrome.storage.local.set({ [STORAGE_KEY_MODEL]: model });
      }
      return this.settingsCache;
    }

    try {
      const data = await chrome.storage.local.get([
        STORAGE_KEY_API_KEY,
        STORAGE_KEY_LEGACY_OPENAI,
        STORAGE_KEY_CHAT_URL,
        STORAGE_KEY_MODEL
      ]);
      let key = (data[STORAGE_KEY_API_KEY] as string) || (data[STORAGE_KEY_LEGACY_OPENAI] as string) || null;
      if (!data[STORAGE_KEY_API_KEY] && data[STORAGE_KEY_LEGACY_OPENAI]) {
        await chrome.storage.local.set({ [STORAGE_KEY_API_KEY]: data[STORAGE_KEY_LEGACY_OPENAI] });
      }
      const chatCompletionsUrl =
        (data[STORAGE_KEY_CHAT_URL] as string) || DEFAULT_CHAT_COMPLETIONS_URL;
      let model = (data[STORAGE_KEY_MODEL] as string) || DEFAULT_AI_MODEL;
      if (DEPRECATED_MODEL_IDS.includes(model)) {
        model = DEFAULT_AI_MODEL;
        await chrome.storage.local.set({ [STORAGE_KEY_MODEL]: model });
      }
      this.settingsCache = { apiKey: key, chatCompletionsUrl, model };
      return this.settingsCache;
    } catch (error) {
      console.error('Failed to load AI settings:', error);
      this.settingsCache = {
        apiKey: null,
        chatCompletionsUrl: DEFAULT_CHAT_COMPLETIONS_URL,
        model: DEFAULT_AI_MODEL
      };
      return this.settingsCache;
    }
  }

  /** Invalidate cache after popup saves */
  public invalidateCache(): void {
    this.settingsCache = null;
  }

  public async getSettings(): Promise<AiProviderSettings> {
    return this.loadSettings();
  }

  public async setSettings(partial: {
    apiKey?: string;
    chatCompletionsUrl?: string;
    model?: string;
  }): Promise<void> {
    const payload: Record<string, string> = {};
    if (partial.apiKey !== undefined) {
      payload[STORAGE_KEY_API_KEY] = partial.apiKey;
    }
    if (partial.chatCompletionsUrl !== undefined) {
      payload[STORAGE_KEY_CHAT_URL] = partial.chatCompletionsUrl;
    }
    if (partial.model !== undefined) {
      payload[STORAGE_KEY_MODEL] = partial.model;
    }
    if (Object.keys(payload).length) {
      await chrome.storage.local.set(payload);
    }
    this.invalidateCache();
  }

  /** @deprecated use setSettings */
  public async setApiKey(key: string): Promise<void> {
    await this.setSettings({ apiKey: key });
  }

  public async getApiKey(): Promise<string | null> {
    const s = await this.loadSettings();
    return s.apiKey;
  }

  public async hasApiKey(): Promise<boolean> {
    const s = await this.loadSettings();
    return !!s.apiKey?.trim();
  }

  /**
   * Retries on HTTP 429 using Retry-After or exponential backoff (free tier is often rate-limited).
   */
  private async fetchWithRetry(
    url: string,
    apiKey: string,
    body: Record<string, unknown>,
    maxAttempts = 5
  ): Promise<Response> {
    let last: Response | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      last = await fetch(url, {
        method: 'POST',
        headers: this.buildFetchHeaders(apiKey),
        body: JSON.stringify(body)
      });

      if (last.status !== 429) {
        return last;
      }
      if (attempt === maxAttempts) {
        return last;
      }

      const retryAfter = last.headers.get('Retry-After');
      let waitMs = 0;
      if (retryAfter) {
        const sec = parseInt(retryAfter, 10);
        if (!isNaN(sec)) waitMs = sec * 1000;
      }
      if (waitMs <= 0) {
        waitMs = Math.min(32000, 1500 * Math.pow(2, attempt - 1));
      }
      await new Promise((r) => setTimeout(r, waitMs));
    }
    return last as Response;
  }

  private buildFetchHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
    // OpenRouter: recommended for rankings / attribution (optional)
    if (this.settingsCache?.chatCompletionsUrl?.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://github.com/ausievich/yt-quick-filters';
      headers['X-Title'] = 'YouTrack Quick Filters';
    }
    return headers;
  }

  /**
   * Run a chat with tool use against YouTrack (via REST).
   */
  public async processMessage(
    userMessage: string,
    issueContext?: YouTrackAssistantContext,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    const { apiKey, chatCompletionsUrl, model } = await this.loadSettings();
    if (!apiKey?.trim()) {
      return {
        success: false,
        error: 'API ключ не задан. Укажите ключ OpenRouter в настройках расширения.'
      };
    }

    const client = YouTrackAPIClient.getInstance();
    await client.initialize();

    const tools = getYouTrackOpenAITools();
    const systemPrompt = this.buildSystemPrompt(issueContext ?? undefined);
    const prior = (conversationHistory ?? [])
      .filter((m) => m.content?.trim())
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content })) as ChatMessage[];

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...prior,
      { role: 'user', content: userMessage }
    ];

    const toolTrace: string[] = [];
    const maxSteps = 8;

    for (let step = 0; step < maxSteps; step++) {
      const response = await this.fetchWithRetry(chatCompletionsUrl, apiKey, {
        model,
        messages: messages as unknown[],
        tools,
        tool_choice: 'auto',
        temperature: 0.2
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = errorData as { error?: { message?: string }; message?: string };
        const msg = err.error?.message || err.message || response.statusText;
        return {
          success: false,
          error: `Ошибка API: ${response.status} ${msg}`
        };
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message as ChatMessage | undefined;

      if (!choice) {
        return { success: false, error: 'Пустой ответ от модели' };
      }

      const toolCalls = choice.tool_calls as OpenAIToolCall[] | undefined;

      if (toolCalls?.length) {
        messages.push({
          role: 'assistant',
          content: choice.content ?? null,
          tool_calls: toolCalls
        });

        for (const tc of toolCalls) {
          if (tc.type !== 'function' || !tc.function?.name) continue;
          const { ok, result, summary } = await executeYouTrackTool(
            client,
            tc.function.name,
            tc.function.arguments || '{}'
          );
          toolTrace.push(summary);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(ok ? result : { ok: false, detail: result, summary })
          });
        }
        continue;
      }

      const text = choice.content?.trim() || '';
      return {
        success: true,
        message: text || 'Готово.',
        toolTrace: toolTrace.length ? toolTrace : undefined
      };
    }

    return {
      success: false,
      error: 'Слишком много шагов с инструментами — упростите запрос.',
      toolTrace
    };
  }

  private buildSystemPrompt(ctx?: YouTrackAssistantContext): string {
    let prompt = `You are a YouTrack assistant inside a browser extension. You can call tools to read and modify issues on the user's current YouTrack instance (same origin; auth uses the active session).

Auth — critical (follow when the user asks about tokens or "why you don't see localStorage"):
- You are a remote LLM: you never receive the user's browser localStorage, cookies, or raw YouTrack tokens in your context. Do not claim you "run inside a sandbox that blocks localStorage" as the reason REST fails — that is misleading.
- YouTrack REST calls happen only when you invoke the provided tools. Tool execution runs in the user's Chrome extension; it uses a YouTrack session token that was synced from the YouTrack tab into extension storage (not passed into your prompt). So you personally do not "see" the token, but tools can still perform authenticated API requests when the session is valid.
- If the user says the token is in localStorage: acknowledge that on the YouTrack page it exists there, the extension copies it for API calls, but your model input does not include it — use tools to fetch data instead of saying you cannot call the API for lack of token without trying tools first.
- If tools return auth or permission errors, explain that the extension could not use the YouTrack session (open YouTrack in a tab, refresh, use AI sync on the board) — not that you need them to paste a YouTrack token for you.

Use tools when the user asks about specific issues, searches, updates, commands, or subtasks. Prefer tools over guessing.

After tools complete, reply briefly in the same language as the user, summarizing what was done or what you found.

If the user does not name an issue id and context provides one (including from the current page URL), use that id for tools.`;

    const url = ctx?.pageUrl?.trim();
    if (url) {
      prompt += `\n\nThe user's current browser tab URL (they are on this YouTrack page). Infer project/issue from the path when applicable:
${url}`;
    }

    if (ctx?.issueId) {
      prompt += `\n\nLoaded issue context (from API when available):
- Issue ID: ${ctx.issueId}
${ctx.summary ? `- Summary: ${ctx.summary}` : ''}
${ctx.description ? `- Description (truncated): ${ctx.description.substring(0, 800)}` : ''}`;
    }

    return prompt;
  }
}
