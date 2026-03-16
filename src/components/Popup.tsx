import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { StorageService, DEFAULT_THRESHOLD_YELLOW, DEFAULT_THRESHOLD_RED } from '../services/storage';
import manifest from '../../manifest.json';
import './Popup.css';

const VERSION = manifest.version;
const GITHUB_ISSUES_URL = 'https://github.com/ausievich/yt-quick-filters/issues';
const CHROME_WEB_STORE_REVIEWS_URL = 'https://chromewebstore.google.com/detail/youtrack-quick-filters/iaddgmcajdiblafjfhloadmphkbplddo/reviews';

const Popup: React.FC = () => {
  const [showCreated, setShowCreated] = useState<boolean>(true);
  const [thresholdYellowInput, setThresholdYellowInput] = useState<string>('');
  const [thresholdRedInput, setThresholdRedInput] = useState<string>('');
  const [lastUserYellowValue, setLastUserYellowValue] = useState<number>(DEFAULT_THRESHOLD_YELLOW);
  const [lastUserRedValue, setLastUserRedValue] = useState<number>(DEFAULT_THRESHOLD_RED);
  const [compactFormat, setCompactFormat] = useState<boolean>(false);
  const [createdTagColored, setCreatedTagColored] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const storageService = StorageService.getInstance();

  // Helper function to notify content script about settings changes
  const notifyContentScript = async (message: any) => {
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
        // Load Days In Status settings
        const hideCreatedValue = await storageService.getHideCreatedTag();
        const thresholdYellowValue = await storageService.getDaysInStatusThresholdYellow();
        const thresholdRedValue = await storageService.getDaysInStatusThresholdRed();
        const compactFormatValue = await storageService.getDaysInStatusCompactFormat();
        const createdTagColoredValue = await storageService.getCreatedTagColored();
        const normalizedYellow = thresholdYellowValue > 0 ? thresholdYellowValue : DEFAULT_THRESHOLD_YELLOW;
        const normalizedRed = thresholdRedValue > 0 ? thresholdRedValue : DEFAULT_THRESHOLD_RED;
        
        // Invert logic: hideCreated = false means showCreated = true
        setShowCreated(!hideCreatedValue);
        setThresholdYellowInput(normalizedYellow.toString());
        setThresholdRedInput(normalizedRed.toString());
        // Initialize last user values with loaded values
        setLastUserYellowValue(normalizedYellow);
        setLastUserRedValue(normalizedRed);
        setCompactFormat(compactFormatValue);
        setCreatedTagColored(createdTagColoredValue);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [storageService]);

  const handleShowCreatedChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setShowCreated(value);
    // Invert: showCreated = true means hideCreated = false
    await storageService.setHideCreatedTag(!value);
    await notifyContentScript({ hideCreated: !value });
  };

  // Generic handler for threshold input changes
  const createThresholdChangeHandler = (
    setInput: (value: string) => void,
    saveToStorage: (value: number) => Promise<void>,
    notifyKey: 'thresholdYellow' | 'thresholdRed'
  ) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value;
    // Only allow digits, limit to 4 characters maximum
    const digitsOnly = newInputValue.replace(/\D/g, '');
    if (digitsOnly.length <= 4) {
      // Update string input value to preserve cursor position
      setInput(digitsOnly);
      
      // Save immediately so value is not lost on popup close.
      // Do not update lastUserValue here; it represents committed value (blur/close).
      const value = parseInt(digitsOnly, 10);
      if (digitsOnly !== '' && !isNaN(value) && value > 0) {
        await saveToStorage(value);
        await notifyContentScript({ [notifyKey]: value });
      }
    }
  };

  // Generic handler for threshold input blur
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
      // Restore the last committed value when user leaves input empty.
      const valueToRestore = lastUserValue;
      setInput(valueToRestore.toString());
      await saveToStorage(valueToRestore);
      await notifyContentScript({ [notifyKey]: valueToRestore });
    } else {
      const value = parseInt(trimmedInput, 10);
      if (!isNaN(value) && value > 0) {
        // Save and update committed value.
        setInput(value.toString());
        setLastUserValue(value);
        await saveToStorage(value);
        await notifyContentScript({ [notifyKey]: value });
      } else {
        // Invalid value (not a number or <= 0), restore last committed value.
        const valueToRestore = lastUserValue;
        setInput(valueToRestore.toString());
        await saveToStorage(valueToRestore);
        await notifyContentScript({ [notifyKey]: valueToRestore });
      }
    }
  };

  // Generic handler for threshold input blur
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

  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="popup-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
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
          <a 
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="popup-footer-link"
          >
            Report an issue
          </a>
        </div>
      </div>
    </div>
  );
};

// Initialize popup
const container = document.getElementById('popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
