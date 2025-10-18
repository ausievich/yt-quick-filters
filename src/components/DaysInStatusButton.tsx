import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { DaysInStatusManager } from '../services/daysInStatusManager';
import { SecureAPIClient } from '../services/secureAPIClient';
import './DaysInStatusButton.css';

export const DaysInStatusButton: React.FC = () => {
  const [showDaysInStatus, setShowDaysInStatus] = useState<boolean>(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [hasToken, setHasToken] = useState(false);

  const storageService = StorageService.getInstance();
  const daysInStatusManager = DaysInStatusManager.getInstance();

  // Check if we have a token on mount
  useEffect(() => {
    SecureAPIClient.hasValidToken().then(setHasToken);
  }, []);

  // Load days in status state
  useEffect(() => {
    const loadDaysInStatusState = async () => {
      try {
        const enabled = await storageService.getDaysInStatusEnabled();
        setShowDaysInStatus(enabled);
        daysInStatusManager.setEnabled(enabled);
      } catch (error) {
        console.error('Failed to load days in status state:', error);
      }
    };
    loadDaysInStatusState();
  }, [storageService, daysInStatusManager]);

  const handleToggleDaysInStatus = async () => {
    const newState = !showDaysInStatus;
    setShowDaysInStatus(newState);
    daysInStatusManager.setEnabled(newState);
    
    try {
      await storageService.setDaysInStatusEnabled(newState);
    } catch (error) {
      console.error('Failed to save days in status state:', error);
    }
  };

  const handleTokenSubmit = async () => {
    if (tokenInput.trim()) {
      const success = await SecureAPIClient.saveToken(tokenInput.trim());
      if (success) {
        setHasToken(true);
        setShowTokenInput(false);
        setTokenInput('');
      }
    }
  };

  const handleClearToken = async () => {
    const success = await SecureAPIClient.clearToken();
    if (success) {
      setHasToken(false);
    }
  };

  return (
    <>
      <button 
        className={`ytqf-days-button ${showDaysInStatus ? 'active' : 'ghost'}`} 
        onClick={() => {
          if (!hasToken) {
            setShowTokenInput(true);
          } else {
            handleToggleDaysInStatus();
          }
        }}
        title={hasToken ? 'Days in status' : 'Setup YouTrack API token to enable days in status'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M13.75 8a5.75 5.75 0 1 1-11.5 0 5.75 5.75 0 0 1 11.5 0ZM15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM8.225 5a.625.625 0 1 0-1.25 0v3c0 .22.115.423.303.536l2.5 1.5a.625.625 0 0 0 .644-1.072L8.225 7.646V5Z" clipRule="evenodd"></path>
        </svg>
      </button>
      
      {/* Token input modal */}
      {showTokenInput && (
        <div className="ytqf-token-modal">
          <div className="ytqf-token-modal-content">
            <h3>🔑 Setup YouTrack API Token</h3>
            <div className="ytqf-token-disclaimer">
              <p><strong>Days in Status</strong> feature requires a YouTrack permanent token to access issue data.</p>
              <p>This token is stored securely in your browser and never shared.</p>
            </div>
            <div className="ytqf-token-links">
              <p>📖 <strong>Documentation:</strong></p>
              <ul>
                <li><a href="https://www.jetbrains.com/help/youtrack/devportal/authentication-with-permanent-token.html" target="_blank" rel="noopener noreferrer">YouTrack Permanent Token Guide</a></li>
                <li><a href="https://www.jetbrains.com/help/youtrack/devportal/youtrack-rest-api.html" target="_blank" rel="noopener noreferrer">YouTrack REST API Documentation</a></li>
              </ul>
            </div>
            <div className="ytqf-token-input-section">
              <label htmlFor="ytqf-token-input">Enter your YouTrack permanent token:</label>
              <input
                id="ytqf-token-input"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="perm:xxxxx.xxxxx.xxxxx"
                onKeyPress={(e) => e.key === 'Enter' && handleTokenSubmit()}
              />
            </div>
            <div className="ytqf-token-modal-buttons">
              <button onClick={handleTokenSubmit} className="ytqf-btn ytqf-btn-active">
                Save Token
              </button>
              <button onClick={() => setShowTokenInput(false)} className="ytqf-btn ytqf-btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
