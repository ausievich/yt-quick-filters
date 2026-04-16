import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AIService, YouTrackAssistantContext } from '../services/aiService';
import { resolveYouTrackPageUrlForAssistant } from '../services/browserContext';
import { YouTrackAPIClient } from '../services/youTrackAPIClient';
import { TokenManager } from '../services/tokenManager';
import { ExtensionSettingsForm } from './ExtensionSettingsForm';
import { clearChatMessages, loadChatMessages, saveChatMessages, SerializedChatMessage } from '../services/aiChatHistory';
import './AIAssistantPanel.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  error?: boolean;
}

const SESSION_ORIGIN = 'ytqf_youtrack_origin';
const SESSION_ISSUE = 'ytqf_sidepanel_issue';
const SESSION_PAGE_URL = 'ytqf_sidepanel_page_url';

function deserializeMessages(stored: SerializedChatMessage[]): Message[] {
  return stored.map((s) => ({
    id: s.id,
    role: s.role,
    content: s.content,
    timestamp: new Date(s.timestamp),
    error: s.error
  }));
}

function serializeMessages(messages: Message[]): SerializedChatMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    error: m.error
  }));
}

export const AIAssistantPanel: React.FC = () => {
  const [panelView, setPanelView] = useState<'chat' | 'settings'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [issueContext, setIssueContext] = useState<{ summary?: string; description?: string } | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const aiService = AIService.getInstance();
  const apiClient = YouTrackAPIClient.getInstance();
  const tokenManager = TokenManager.getInstance();

  const buildWelcomeMessage = useCallback(async (): Promise<Message> => {
    const hasKey = await aiService.hasApiKey();
    const hasYt = await tokenManager.hasValidToken();
    return {
      id: 'welcome',
      role: 'assistant',
      content: hasKey
        ? hasYt
          ? 'Боковая панель Chrome: чат с YouTrack через вашу сессию. В промпт попадает URL активной вкладки YouTrack (если она открыта), чтобы понимать текущую страницу/задачу. На доске кнопка AI дополнительно синхронизирует контекст; панель открывается кликом по иконке расширения.'
          : 'Ключ LLM есть, но токен YouTrack не найден. Откройте любую страницу YouTrack (доска или карточка задачи) в этой же вкладке и обновите её, чтобы расширение прочитало сессию.'
        : 'Укажите ключ OpenRouter: переключитесь на «Параметры» в этой панели.',
      timestamp: new Date()
    };
  }, [aiService, tokenManager]);

  const loadIssueContextForId = useCallback(
    async (id: string) => {
      try {
        const details = await apiClient.getIssueDetails(id);
        if (details) {
          setIssueId(id);
          setIssueContext({
            summary: details.summary,
            description: typeof details.description === 'string' ? details.description : undefined
          });
        }
      } catch (error) {
        console.error('Failed to load issue context:', error);
      }
    },
    [apiClient]
  );

  const applySessionContext = useCallback(async () => {
    const s = await chrome.storage.session.get([SESSION_ORIGIN, SESSION_ISSUE, SESSION_PAGE_URL]);
    const originFromSession = (s[SESSION_ORIGIN] as string | undefined)?.trim() || null;
    const issue = (s[SESSION_ISSUE] as string | null | undefined) ?? null;
    const syncedUrl = (s[SESSION_PAGE_URL] as string | null | undefined) ?? null;

    setPageUrl(syncedUrl);

    /** Prefer the active tab when it is YouTrack (issue page without board "AI" sync still works). */
    const effectivePageUrl = await resolveYouTrackPageUrlForAssistant(syncedUrl);
    let resolvedOrigin: string | null = null;
    if (effectivePageUrl) {
      try {
        resolvedOrigin = new URL(effectivePageUrl).origin;
      } catch {
        resolvedOrigin = null;
      }
    }
    if (!resolvedOrigin && originFromSession) {
      resolvedOrigin = originFromSession;
    }
    tokenManager.setYouTrackContextOrigin(resolvedOrigin);

    if (issue) {
      setIssueId(issue);
      await loadIssueContextForId(issue);
    } else {
      setIssueId(null);
      setIssueContext(null);
    }
    setContextReady(!!resolvedOrigin);
  }, [tokenManager, loadIssueContextForId]);

  useEffect(() => {
    void (async () => {
      await applySessionContext();
      await apiClient.initialize();

      const stored = await loadChatMessages();
      if (stored && stored.length > 0) {
        setMessages(deserializeMessages(stored));
      } else {
        setMessages([await buildWelcomeMessage()]);
      }
      setHistoryReady(true);

      setTimeout(() => inputRef.current?.focus(), 100);
    })();

    const onSessionChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== 'session') return;
      if (!changes[SESSION_ORIGIN] && !changes[SESSION_ISSUE] && !changes[SESSION_PAGE_URL]) return;
      void applySessionContext();
    };
    chrome.storage.onChanged.addListener(onSessionChanged);
    return () => {
      chrome.storage.onChanged.removeListener(onSessionChanged);
      tokenManager.setYouTrackContextOrigin(null);
    };
  }, [aiService, apiClient, tokenManager, applySessionContext, buildWelcomeMessage]);

  useEffect(() => {
    if (!historyReady) return;
    const handle = window.setTimeout(() => {
      void saveChatMessages(serializeMessages(messages));
    }, 450);
    return () => window.clearTimeout(handle);
  }, [messages, historyReady]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const extractIssueIdFromText = (text: string, fallbackId: string | null): string | null => {
    const extracted = apiClient.parseIssueId(text);
    if (extracted) return extracted;
    return fallbackId;
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const hasKey = await aiService.hasApiKey();
    if (!hasKey) {
      addMessage('assistant', 'Сначала укажите ключ OpenRouter (вкладка «Параметры»).', true);
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    const priorForApi = messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.id !== 'welcome')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      .slice(-24);

    addMessage('user', userMessage);

    let ctxIssueId = issueId;
    let ctxSummary = issueContext?.summary;
    let ctxDescription = issueContext?.description;

    const effectivePageUrl = await resolveYouTrackPageUrlForAssistant(pageUrl);

    if (effectivePageUrl) {
      try {
        tokenManager.setYouTrackContextOrigin(new URL(effectivePageUrl).origin);
      } catch {
        /* ignore */
      }
    }

    const idFromUrl = effectivePageUrl ? apiClient.parseIssueId(effectivePageUrl) : null;
    if (idFromUrl && idFromUrl !== ctxIssueId) {
      const details = await apiClient.getIssueDetails(idFromUrl);
      if (details) {
        ctxIssueId = idFromUrl;
        ctxSummary = details.summary;
        ctxDescription = typeof details.description === 'string' ? details.description : undefined;
        setIssueId(idFromUrl);
        setIssueContext({ summary: ctxSummary, description: ctxDescription });
      }
    }

    const extractedIssueId = extractIssueIdFromText(userMessage, ctxIssueId);
    if (extractedIssueId && extractedIssueId !== ctxIssueId) {
      const details = await apiClient.getIssueDetails(extractedIssueId);
      if (details) {
        ctxIssueId = extractedIssueId;
        ctxSummary = details.summary;
        ctxDescription = typeof details.description === 'string' ? details.description : undefined;
        setIssueId(extractedIssueId);
        setIssueContext({ summary: ctxSummary, description: ctxDescription });
      }
    }

    try {
      const assistantContext: YouTrackAssistantContext | undefined =
        effectivePageUrl || ctxIssueId
          ? {
              pageUrl: effectivePageUrl ?? null,
              issueId: ctxIssueId ?? undefined,
              summary: ctxSummary,
              description: ctxDescription
            }
          : undefined;

      const aiResponse = await aiService.processMessage(userMessage, assistantContext, priorForApi);

      if (!aiResponse.success) {
        addMessage('assistant', aiResponse.error || 'Ошибка', true);
        return;
      }

      if (aiResponse.toolTrace?.length) {
        for (const line of aiResponse.toolTrace) {
          addMessage('system', line);
        }
      }

      addMessage('assistant', aiResponse.message || 'Готово.');

      if (ctxIssueId && aiResponse.toolTrace?.length) {
        await loadIssueContextForId(ctxIssueId);
      }
    } catch (error) {
      addMessage(
        'assistant',
        `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        true
      );
    } finally {
      setIsLoading(false);
    }
  };

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string, isError = false) => {
    const message: Message = {
      id: `${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: new Date(),
      error: isError
    };
    setMessages((prev) => [...prev, message]);
  };

  const handleClearHistory = async () => {
    await clearChatMessages();
    setMessages([await buildWelcomeMessage()]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="ytqf-sp-root">
      <header className="ytqf-sp-chrome">
        <span className="ytqf-sp-title">YouTrack AI</span>
        <div className="ytqf-sp-header-actions">
          {panelView === 'chat' && (
            <button
              type="button"
              className="ytqf-sp-clear-history"
              onClick={() => void handleClearHistory()}
              title="Удалить сохранённую переписку на этом устройстве"
            >
              Очистить историю
            </button>
          )}
          <div className="ytqf-sp-segment" role="tablist" aria-label="Режим панели">
            <button
              type="button"
              role="tab"
              aria-selected={panelView === 'chat'}
              className={`ytqf-sp-segment-btn ${panelView === 'chat' ? 'ytqf-sp-segment-btn--active' : ''}`}
              onClick={() => setPanelView('chat')}
            >
              Чат
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelView === 'settings'}
              className={`ytqf-sp-segment-btn ${panelView === 'settings' ? 'ytqf-sp-segment-btn--active' : ''}`}
              onClick={() => setPanelView('settings')}
            >
              Параметры
            </button>
          </div>
        </div>
      </header>

      {!contextReady && panelView === 'chat' && (
        <p className="ytqf-sp-hint">
          Контекст YouTrack не передан: откройте панель с вкладки YouTrack или нажмите AI на доске, затем снова откройте панель по иконке.
        </p>
      )}

      {panelView === 'settings' ? (
        <div className="ytqf-sp-settings-wrap">
          <ExtensionSettingsForm className="ytqf-sp-settings-form" />
        </div>
      ) : (
        <>
          <div className="ytqf-sp-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`ytqf-sp-msg ytqf-sp-msg--${message.role} ${message.error ? 'ytqf-sp-msg--error' : ''}`}
              >
                <div className="ytqf-sp-msg-content">{message.content}</div>
                <div className="ytqf-sp-msg-time">
                  {message.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ytqf-sp-msg ytqf-sp-msg--assistant">
                <div className="ytqf-sp-msg-content">Думаю...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ytqf-sp-input-wrap">
            <textarea
              ref={inputRef}
              className="ytqf-sp-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Сообщение… Enter — отправить, Shift+Enter — новая строка"
              rows={3}
              disabled={isLoading}
            />
            <button
              type="button"
              className="ytqf-sp-send"
              onClick={() => void handleSend()}
              disabled={!inputValue.trim() || isLoading}
            >
              Отправить
            </button>
          </div>
        </>
      )}
    </div>
  );
};
