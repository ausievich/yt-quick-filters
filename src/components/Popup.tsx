import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { StorageService, DEFAULT_THRESHOLD_YELLOW, DEFAULT_THRESHOLD_RED } from '../services/storage';
import manifest from '../../manifest.json';
import './Popup.css';

const MAX_THRESHOLD_VALUE = 9999;

const VERSION = manifest.version;
const GITHUB_ISSUES_URL = 'https://github.com/ausievich/yt-quick-filters/issues';
const CHROME_WEB_STORE_REVIEWS_URL = 'https://chromewebstore.google.com/detail/youtrack-quick-filters/iaddgmcajdiblafjfhloadmphkbplddo/reviews';

const Popup: React.FC = () => {
  const [showCreated, setShowCreated] = useState<boolean>(true);
  const [thresholdYellow, setThresholdYellow] = useState<number>(DEFAULT_THRESHOLD_YELLOW);
  const [thresholdRed, setThresholdRed] = useState<number>(DEFAULT_THRESHOLD_RED);
  const [thresholdYellowInput, setThresholdYellowInput] = useState<string>('');
  const [thresholdRedInput, setThresholdRedInput] = useState<string>('');
  const [lastUserYellowValue, setLastUserYellowValue] = useState<number>(DEFAULT_THRESHOLD_YELLOW);
  const [lastUserRedValue, setLastUserRedValue] = useState<number>(DEFAULT_THRESHOLD_RED);
  const [compactFormat, setCompactFormat] = useState<boolean>(false);
  const [createdTagColored, setCreatedTagColored] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const storageService = StorageService.getInstance();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load Days In Status settings
        const hideCreatedValue = await storageService.getHideCreatedTag();
        const thresholdYellowValue = await storageService.getDaysInStatusThresholdYellow();
        const thresholdRedValue = await storageService.getDaysInStatusThresholdRed();
        const compactFormatValue = await storageService.getDaysInStatusCompactFormat();
        const createdTagColoredValue = await storageService.getCreatedTagColored();
        
        // Invert logic: hideCreated = false means showCreated = true
        setShowCreated(!hideCreatedValue);
        setThresholdYellow(thresholdYellowValue);
        setThresholdRed(thresholdRedValue);
        setThresholdYellowInput(thresholdYellowValue.toString());
        setThresholdRedInput(thresholdRedValue.toString());
        // Initialize last user values with loaded values
        setLastUserYellowValue(thresholdYellowValue);
        setLastUserRedValue(thresholdRedValue);
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
    
    // Notify content script to update
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
          hideCreated: !value
        });
      }
    } catch (error) {
      console.warn('Failed to notify content script:', error);
    }
  };

  const handleThresholdYellowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Only allow digits, limit to 4 characters maximum
    const digitsOnly = inputValue.replace(/\D/g, '');
    if (digitsOnly.length <= 4) {
      // Update string input value to preserve cursor position
      setThresholdYellowInput(digitsOnly);
    }
  };

  const handleThresholdYellowBlur = async () => {
    const inputValue = thresholdYellowInput.trim();
    
    if (inputValue === '') {
      // Restore last user-selected value instead of default
      const valueToRestore = lastUserYellowValue;
      setThresholdYellow(valueToRestore);
      setThresholdYellowInput(valueToRestore.toString());
      await storageService.setDaysInStatusThresholdYellow(valueToRestore);
      
      // Notify content script to update
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
            thresholdYellow: valueToRestore
          });
        }
      } catch (error) {
        console.warn('Failed to notify content script:', error);
      }
    } else {
      const value = parseInt(inputValue, 10);
      if (!isNaN(value) && value > 0) {
        // Save and update last user-selected value only when blur with valid value
        // Max value is already limited by input length (4 chars = max 9999)
        setThresholdYellow(value);
        setThresholdYellowInput(value.toString());
        setLastUserYellowValue(value);
        await storageService.setDaysInStatusThresholdYellow(value);
        
        // Notify content script to update
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
              thresholdYellow: value
            });
          }
        } catch (error) {
          console.warn('Failed to notify content script:', error);
        }
      } else {
        // Invalid value (not a number or <= 0), restore last valid value
        const valueToRestore = lastUserYellowValue;
        setThresholdYellow(valueToRestore);
        setThresholdYellowInput(valueToRestore.toString());
        await storageService.setDaysInStatusThresholdYellow(valueToRestore);
      }
    }
  };

  const handleThresholdRedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Only allow digits, limit to 4 characters maximum
    const digitsOnly = inputValue.replace(/\D/g, '');
    if (digitsOnly.length <= 4) {
      // Update string input value to preserve cursor position
      setThresholdRedInput(digitsOnly);
    }
  };

  const handleThresholdRedBlur = async () => {
    const inputValue = thresholdRedInput.trim();
    
    if (inputValue === '') {
      // Restore last user-selected value instead of default
      const valueToRestore = lastUserRedValue;
      setThresholdRed(valueToRestore);
      setThresholdRedInput(valueToRestore.toString());
      await storageService.setDaysInStatusThresholdRed(valueToRestore);
      
      // Notify content script to update
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
            thresholdRed: valueToRestore
          });
        }
      } catch (error) {
        console.warn('Failed to notify content script:', error);
      }
    } else {
      const value = parseInt(inputValue, 10);
      if (!isNaN(value) && value > 0) {
        // Save and update last user-selected value only when blur with valid value
        // Max value is already limited by input length (4 chars = max 9999)
        setThresholdRed(value);
        setThresholdRedInput(value.toString());
        setLastUserRedValue(value);
        await storageService.setDaysInStatusThresholdRed(value);
        
        // Notify content script to update
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
              thresholdRed: value
            });
          }
        } catch (error) {
          console.warn('Failed to notify content script:', error);
        }
      } else {
        // Invalid value (not a number or <= 0), restore last valid value
        const valueToRestore = lastUserRedValue;
        setThresholdRed(valueToRestore);
        setThresholdRedInput(valueToRestore.toString());
        await storageService.setDaysInStatusThresholdRed(valueToRestore);
      }
    }
  };

  const handleCompactFormatChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setCompactFormat(value);
    await storageService.setDaysInStatusCompactFormat(value);
    
    // Notify content script to update
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
          compactFormat: value
        });
      }
    } catch (error) {
      console.warn('Failed to notify content script:', error);
    }
  };

  const handleCreatedTagColoredChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setCreatedTagColored(value);
    await storageService.setCreatedTagColored(value);
    
    // Notify content script to update
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
          createdTagColored: value
        });
      }
    } catch (error) {
      console.warn('Failed to notify content script:', error);
    }
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
              min="1"
              max={MAX_THRESHOLD_VALUE}
              value={thresholdYellowInput}
              onChange={handleThresholdYellowChange}
              onBlur={handleThresholdYellowBlur}
              placeholder={lastUserYellowValue.toString()}
              className="popup-input popup-input-threshold"
            />
            <span className="popup-threshold-unit">days</span>
          </div>

          <div className="popup-threshold-row">
            <span className="popup-threshold-indicator popup-threshold-indicator--red"></span>
            <label className="popup-threshold-label">Stale after</label>
            <input
              type="text"
              min="1"
              max={MAX_THRESHOLD_VALUE}
              value={thresholdRedInput}
              onChange={handleThresholdRedChange}
              onBlur={handleThresholdRedBlur}
              placeholder={lastUserRedValue.toString()}
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
