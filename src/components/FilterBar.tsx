import React, { useState } from 'react';
import { FilterBarProps } from '../types';
import { SecureAPIClient } from '../services/secureAPIClient';
import './FilterBar.css';

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  activeFilter,
  onFilterClick,
  onAddFilter,
  onContextMenu,
  showDaysInStatus,
  onToggleDaysInStatus
}) => {
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [hasToken, setHasToken] = useState(false);

  // Check if we have a token on mount
  React.useEffect(() => {
    SecureAPIClient.hasValidToken().then(setHasToken);
  }, []);

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
    <div id="ytqf-bar">
      {/* Token management - moved to the left */}
      {!hasToken ? (
        <button 
          className="btn ghost" 
          onClick={() => setShowTokenInput(true)}
          title="Setup YouTrack API token"
        >
          🔑 Setup Token
        </button>
      ) : (
        <button 
          className="btn active" 
          onClick={handleClearToken}
          title="Clear API token"
        >
          🔑 Token Set
        </button>
      )}

      <button 
        className={`btn ${showDaysInStatus ? 'active' : 'ghost'}`} 
        onClick={onToggleDaysInStatus}
        title={showDaysInStatus ? 'Hide days in status' : 'Show days in status'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M13.75 8a5.75 5.75 0 1 1-11.5 0 5.75 5.75 0 0 1 11.5 0ZM15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM8.225 5a.625.625 0 1 0-1.25 0v3c0 .22.115.423.303.536l2.5 1.5a.625.625 0 0 0 .644-1.072L8.225 7.646V5Z" clipRule="evenodd"></path>
        </svg>
      </button>
      
      <button className="btn ghost" onClick={onAddFilter}>
        Add filter...
      </button>

      {filters.map((filter, index) => (
        <button
          key={index}
          className={`btn ${activeFilter === filter ? 'active' : ''}`}
          title={filter.query}
          onClick={() => onFilterClick(filter.query)}
          onContextMenu={(e) => onContextMenu(e, filter, index)}
        >
          <span className="lbl">{filter.label}</span>
        </button>
      ))}
      
      {/* Token input modal */}
      {showTokenInput && (
        <div className="token-modal">
          <div className="token-modal-content">
            <h3>Setup YouTrack API Token</h3>
            <p>Enter your YouTrack permanent token:</p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="perm:xxxxx.xxxxx.xxxxx"
              onKeyPress={(e) => e.key === 'Enter' && handleTokenSubmit()}
            />
            <div className="token-modal-buttons">
              <button onClick={handleTokenSubmit} className="btn active">
                Save
              </button>
              <button onClick={() => setShowTokenInput(false)} className="btn ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
