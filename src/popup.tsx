import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { StorageService } from './services/storage';
import './popup.css';

const Popup: React.FC = () => {
  const [showCreated, setShowCreated] = useState<boolean>(true);
  const [thresholdYellow, setThresholdYellow] = useState<number>(14);
  const [thresholdRed, setThresholdRed] = useState<number>(60);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const storageService = StorageService.getInstance();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load Days In Status settings
        const hideCreatedValue = await storageService.getHideCreatedTag();
        const thresholdYellowValue = await storageService.getDaysInStatusThresholdYellow();
        const thresholdRedValue = await storageService.getDaysInStatusThresholdRed();
        
        // Invert logic: hideCreated = false means showCreated = true
        setShowCreated(!hideCreatedValue);
        setThresholdYellow(thresholdYellowValue);
        setThresholdRed(thresholdRedValue);
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

  const handleThresholdYellowChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow empty value for editing
    if (inputValue === '') {
      setThresholdYellow(0);
      return;
    }
    
    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value > 0) {
      setThresholdYellow(value);
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
    }
  };

  const handleThresholdYellowBlur = () => {
    if (thresholdYellow === 0) {
      setThresholdYellow(14);
      storageService.setDaysInStatusThresholdYellow(14);
    }
  };

  const handleThresholdRedChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow empty value for editing
    if (inputValue === '') {
      setThresholdRed(0);
      return;
    }
    
    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value > 0) {
      setThresholdRed(value);
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
    }
  };

  const handleThresholdRedBlur = () => {
    if (thresholdRed === 0) {
      setThresholdRed(60);
      storageService.setDaysInStatusThresholdRed(60);
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
      <div className="popup-header">
        <h2 className="popup-title">YouTrack Quick Filters</h2>
      </div>

      <div className="popup-section">
        <h3 className="popup-section-title">Days In Status</h3>
        
        <div className="popup-setting">
          <label className="popup-checkbox-label">
            <input
              type="checkbox"
              checked={showCreated}
              onChange={handleShowCreatedChange}
              className="popup-checkbox"
            />
            <span>Show Created tag</span>
          </label>
        </div>

        <div className="popup-setting">
          <label className="popup-input-label">
            Yellow threshold (days):
            <input
              type="number"
              min="1"
              value={thresholdYellow || ''}
              onChange={handleThresholdYellowChange}
              onBlur={handleThresholdYellowBlur}
              className="popup-input"
            />
          </label>
        </div>

        <div className="popup-setting">
          <label className="popup-input-label">
            Red threshold (days):
            <input
              type="number"
              min="1"
              value={thresholdRed || ''}
              onChange={handleThresholdRedChange}
              onBlur={handleThresholdRedBlur}
              className="popup-input"
            />
          </label>
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
