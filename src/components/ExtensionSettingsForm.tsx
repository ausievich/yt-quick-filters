import React, { useState, useEffect } from 'react';
import { StorageService, DEFAULT_THRESHOLD_YELLOW, DEFAULT_THRESHOLD_RED } from '../services/storage';
import { AIService, DEFAULT_AI_MODEL, DEFAULT_CHAT_COMPLETIONS_URL } from '../services/aiService';
import manifest from '../../manifest.json';
import './Popup.css';

const VERSION = manifest.version;
const GITHUB_ISSUES_URL = 'https://github.com/ausievich/yt-quick-filters/issues';
const CHROME_WEB_STORE_REVIEWS_URL =
  'https://chromewebstore.google.com/detail/youtrack-quick-filters/iaddgmcajdiblafjfhloadmphkbplddo/reviews';

export interface ExtensionSettingsFormProps {
  /** Merged with `popup-container` (e.g. embedded side panel). */
  className?: string;
}

export const ExtensionSettingsForm: React.FC<ExtensionSettingsFormProps> = ({ className }) => {
  const [showCreated, setShowCreated] = useState<boolean>(true);
  const [thresholdYellowInput, setThresholdYellowInput] = useState<string>('');
  const [thresholdRedInput, setThresholdRedInput] = useState<string>('');
  const [lastUserYellowValue, setLastUserYellowValue] = useState<number>(DEFAULT_THRESHOLD_YELLOW);
  const [lastUserRedValue, setLastUserRedValue] = useState<number>(DEFAULT_THRESHOLD_RED);
  const [compactFormat, setCompactFormat] = useState<boolean>(false);
  const [createdTagColored, setCreatedTagColored] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [aiApiKey, setAiApiKey] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>(DEFAULT_AI_MODEL);
  const [aiChatUrl, setAiChatUrl] = useState<string>(DEFAULT_CHAT_COMPLETIONS_URL);
  const [aiSettingsSaved, setAiSettingsSaved] = useState<boolean>(false);

  const storageService = StorageService.getInstance();
  const aiService = AIService.getInstance();

  const notifyContentScript = async (message: Record<string, unknown>) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.tabs.sendMessage(tab.id, {
        type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
        ...message
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Receiving end does not exist')) return;
      console.warn('Failed to notify content script:', error);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const hideCreatedValue = await storageService.getHideCreatedTag();
        const thresholdYellowValue = await storageService.getDaysInStatusThresholdYellow();
        const thresholdRedValue = await storageService.getDaysInStatusThresholdRed();
        const compactFormatValue = await storageService.getDaysInStatusCompactFormat();
        const createdTagColoredValue = await storageService.getCreatedTagColored();
        const normalizedYellow = thresholdYellowValue > 0 ? thresholdYellowValue : DEFAULT_THRESHOLD_YELLOW;
        const normalizedRed = thresholdRedValue > 0 ? thresholdRedValue : DEFAULT_THRESHOLD_RED;

        setShowCreated(!hideCreatedValue);
        setThresholdYellowInput(normalizedYellow.toString());
        setThresholdRedInput(normalizedRed.toString());
        setLastUserYellowValue(normalizedYellow);
        setLastUserRedValue(normalizedRed);
        setCompactFormat(compactFormatValue);
        setCreatedTagColored(createdTagColoredValue);

        const ai = await aiService.getSettings();
        setAiApiKey(ai.apiKey || '');
        setAiModel(ai.model || DEFAULT_AI_MODEL);
        setAiChatUrl(ai.chatCompletionsUrl || DEFAULT_CHAT_COMPLETIONS_URL);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [storageService, aiService]);

  const handleShowCreatedChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setShowCreated(value);
    await storageService.setHideCreatedTag(!value);
    await notifyContentScript({ hideCreated: !value });
  };

  const createThresholdChangeHandler = (
    setInput: (value: string) => void,
    saveToStorage: (value: number) => Promise<void>,
    notifyKey: 'thresholdYellow' | 'thresholdRed'
  ) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value;
    const digitsOnly = newInputValue.replace(/\D/g, '');
    if (digitsOnly.length <= 4) {
      setInput(digitsOnly);

      const value = parseInt(digitsOnly, 10);
      if (digitsOnly !== '' && !isNaN(value) && value > 0) {
        await saveToStorage(value);
        await notifyContentScript({ [notifyKey]: value });
      }
    }
  };

  const commitThresholdValue = async (
    inputValue: string,
    lastUserValue: number,
    setInput: (value: string) => void,
    setLastUserValue: (value: number) => void,
    saveToStorage: (value: number) => Promise<void>,
    notifyKey: 'thresholdYellow' | 'thresholdRed'
  ): Promise<void> => {
    const trimmedInput = inputValue.trim();

    if (trimmedInput === '') {
      const valueToRestore = lastUserValue;
      setInput(valueToRestore.toString());
      await saveToStorage(valueToRestore);
      await notifyContentScript({ [notifyKey]: valueToRestore });
    } else {
      const value = parseInt(trimmedInput, 10);
      if (!isNaN(value) && value > 0) {
        setInput(value.toString());
        setLastUserValue(value);
        await saveToStorage(value);
        await notifyContentScript({ [notifyKey]: value });
      } else {
        const valueToRestore = lastUserValue;
        setInput(valueToRestore.toString());
        await saveToStorage(valueToRestore);
        await notifyContentScript({ [notifyKey]: valueToRestore });
      }
    }
  };

  const createThresholdBlurHandler = (
    inputValue: string,
    lastUserValue: number,
    setInput: (value: string) => void,
    setLastUserValue: (value: number) => void,
    saveToStorage: (value: number) => Promise<void>,
    notifyKey: 'thresholdYellow' | 'thresholdRed'
  ) => async () => {
    await commitThresholdValue(
      inputValue,
      lastUserValue,
      setInput,
      setLastUserValue,
      saveToStorage,
      notifyKey
    );
  };

  const handleThresholdYellowChange = createThresholdChangeHandler(
    setThresholdYellowInput,
    storageService.setDaysInStatusThresholdYellow.bind(storageService),
    'thresholdYellow'
  );
  const handleThresholdYellowBlur = createThresholdBlurHandler(
    thresholdYellowInput,
    lastUserYellowValue,
    setThresholdYellowInput,
    setLastUserYellowValue,
    storageService.setDaysInStatusThresholdYellow.bind(storageService),
    'thresholdYellow'
  );

  const handleThresholdRedChange = createThresholdChangeHandler(
    setThresholdRedInput,
    storageService.setDaysInStatusThresholdRed.bind(storageService),
    'thresholdRed'
  );
  const handleThresholdRedBlur = createThresholdBlurHandler(
    thresholdRedInput,
    lastUserRedValue,
    setThresholdRedInput,
    setLastUserRedValue,
    storageService.setDaysInStatusThresholdRed.bind(storageService),
    'thresholdRed'
  );

  useEffect(() => {
    const commitAllThresholds = async () => {
      await Promise.all([
        commitThresholdValue(
          thresholdYellowInput,
          lastUserYellowValue,
          setThresholdYellowInput,
          setLastUserYellowValue,
          storageService.setDaysInStatusThresholdYellow.bind(storageService),
          'thresholdYellow'
        ),
        commitThresholdValue(
          thresholdRedInput,
          lastUserRedValue,
          setThresholdRedInput,
          setLastUserRedValue,
          storageService.setDaysInStatusThresholdRed.bind(storageService),
          'thresholdRed'
        )
      ]);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void commitAllThresholds();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    thresholdYellowInput,
    lastUserYellowValue,
    thresholdRedInput,
    lastUserRedValue,
    storageService
  ]);

  const handleCompactFormatChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setCompactFormat(value);
    await storageService.setDaysInStatusCompactFormat(value);
    await notifyContentScript({ compactFormat: value });
  };

  const handleCreatedTagColoredChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setCreatedTagColored(value);
    await storageService.setCreatedTagColored(value);
    await notifyContentScript({ createdTagColored: value });
  };

  const handleSaveAiSettings = async () => {
    await aiService.setSettings({
      apiKey: aiApiKey.trim(),
      model: aiModel.trim() || DEFAULT_AI_MODEL,
      chatCompletionsUrl: aiChatUrl.trim() || DEFAULT_CHAT_COMPLETIONS_URL
    });
    setAiSettingsSaved(true);
    window.setTimeout(() => setAiSettingsSaved(false), 2000);
  };

  const rootClass = ['popup-container', className].filter(Boolean).join(' ');

  if (isLoading) {
    return (
      <div className={rootClass}>
        <div className="popup-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="popup-section">
        <h3 className="popup-section-title">Settings</h3>

        <div className="popup-setting">
          <label className="popup-toggle-label">
            <input
              type="checkbox"
              checked={showCreated}
              onChange={handleShowCreatedChange}
              className="popup-toggle-input"
            />
            <span className="popup-toggle-switch"></span>
            <span className="popup-toggle-text">Show Created tag</span>
          </label>
        </div>

        <div className="popup-setting">
          <label className="popup-toggle-label">
            <input
              type="checkbox"
              checked={createdTagColored}
              onChange={handleCreatedTagColoredChange}
              className="popup-toggle-input"
            />
            <span className="popup-toggle-switch"></span>
            <span className="popup-toggle-text">Color Created tag</span>
          </label>
        </div>

        <div className="popup-setting">
          <label className="popup-toggle-label">
            <input
              type="checkbox"
              checked={compactFormat}
              onChange={handleCompactFormatChange}
              className="popup-toggle-input"
            />
            <span className="popup-toggle-switch"></span>
            <span className="popup-toggle-text">Use compact format</span>
          </label>
        </div>
      </div>

      <div className="popup-section">
        <h3 className="popup-section-title">AI assistant (OpenRouter)</h3>
        <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.45, color: 'rgb(100, 104, 118)' }}>
          Ключ:{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
            openrouter.ai/keys
          </a>
          . Модели и free tier:{' '}
          <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
            openrouter.ai/models
          </a>
          .
        </p>
        <label className="popup-input-label">
          API key
          <input
            type="password"
            autoComplete="off"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            className="popup-input"
            placeholder="sk-or-v1-…"
          />
        </label>
        <label className="popup-input-label" style={{ marginTop: 10 }}>
          Model id
          <input
            type="text"
            autoComplete="off"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="popup-input"
            placeholder={DEFAULT_AI_MODEL}
          />
        </label>
        <label className="popup-input-label" style={{ marginTop: 10 }}>
          Chat completions URL
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={aiChatUrl}
            onChange={(e) => setAiChatUrl(e.target.value)}
            className="popup-input"
            placeholder={DEFAULT_CHAT_COMPLETIONS_URL}
          />
        </label>
        <button
          type="button"
          className="popup-button popup-button-primary"
          style={{ marginTop: 10 }}
          onClick={() => void handleSaveAiSettings()}
        >
          Save
        </button>
        {aiSettingsSaved && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgb(34, 139, 34)' }}>Saved.</p>
        )}
        <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.4, color: 'rgb(140, 144, 158)' }}>
          Запросы к LLM идут на указанный URL. Действия в YouTrack выполняются через вашу сессию в браузере.
        </p>
      </div>

      <div className="popup-section popup-section-thresholds">
        <h3 className="popup-section-title">thresholds</h3>

        <div className="popup-setting popup-setting-thresholds">
          <div className="popup-threshold-row">
            <span className="popup-threshold-indicator popup-threshold-indicator--yellow"></span>
            <label className="popup-threshold-label">Warning after</label>
            <input
              type="text"
              value={thresholdYellowInput}
              onChange={handleThresholdYellowChange}
              onBlur={handleThresholdYellowBlur}
              placeholder={lastUserYellowValue > 0 ? lastUserYellowValue.toString() : ''}
              className="popup-input popup-input-threshold"
            />
            <span className="popup-threshold-unit">days</span>
          </div>

          <div className="popup-threshold-row">
            <span className="popup-threshold-indicator popup-threshold-indicator--red"></span>
            <label className="popup-threshold-label">Stale after</label>
            <input
              type="text"
              value={thresholdRedInput}
              onChange={handleThresholdRedChange}
              onBlur={handleThresholdRedBlur}
              placeholder={lastUserRedValue > 0 ? lastUserRedValue.toString() : ''}
              className="popup-input popup-input-threshold"
            />
            <span className="popup-threshold-unit">days</span>
          </div>
        </div>
      </div>

      <div className="popup-footer">
        <div className="popup-footer-links">
          <span className="popup-footer-version">v{VERSION}</span>
          <span className="popup-footer-separator">•</span>
          <a
            href={CHROME_WEB_STORE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="popup-footer-link"
          >
            Leave a review
          </a>
          <span className="popup-footer-separator">•</span>
          <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="popup-footer-link">
            Report an issue
          </a>
        </div>
      </div>
    </div>
  );
};
