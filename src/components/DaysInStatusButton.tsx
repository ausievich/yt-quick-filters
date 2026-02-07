import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { DaysInStatusManager } from '../services/daysInStatusManager';
import { LocalStorageAPIClient } from '../services/localStorageAPIClient';
import { LocalStorageTokenManager } from '../services/localStorageTokenManager';
import './DaysInStatusButton.css';

export const DaysInStatusButton: React.FC = () => {
  const [showDaysInStatus, setShowDaysInStatus] = useState<boolean>(false);
  const [hasToken, setHasToken] = useState(false);

  const storageService = StorageService.getInstance();
  const daysInStatusManager = DaysInStatusManager.getInstance();
  const tokenManager = LocalStorageTokenManager.getInstance();

  // Check if we have a token on mount
  useEffect(() => {
    const checkToken = async () => {
      try {
        const localStorageClient = LocalStorageAPIClient.getInstance();
        await localStorageClient.initialize();
        
        const hasValidToken = localStorageClient.hasValidToken();
        setHasToken(hasValidToken);
      } catch (error) {
        console.warn('Failed to check localStorage token:', error);
        setHasToken(false);
      }
    };
    
    checkToken();
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
    
    // If enabling days in status, check and sync token before making requests
    if (newState) {
      try {
        // First check if token in JetBrains localStorage matches token in extension storage
        const isInSync = await tokenManager.isTokenInSync();
        
        if (!isInSync) {
          // Tokens don't match - refresh token from localStorage
          console.log('🔄 Tokens out of sync, refreshing from localStorage...');
          const refreshed = await tokenManager.forceRefreshTokenForCurrentDomain();
          
          if (refreshed) {
            setHasToken(true);
            console.log('✅ Token refreshed successfully');
          } else {
            console.warn('⚠️ Failed to refresh token');
            setHasToken(false);
          }
        } else {
          // Tokens match - we can proceed with requests
          console.log('✅ Token is in sync, ready to make requests');
          setHasToken(true);
        }
      } catch (error) {
        console.warn('⚠️ Error checking/refreshing token:', error);
        setHasToken(false);
        // Continue anyway - the API client will handle retries
      }
    }
    
    setShowDaysInStatus(newState);
    daysInStatusManager.setEnabled(newState);
    
    try {
      await storageService.setDaysInStatusEnabled(newState);
    } catch (error) {
      console.error('Failed to save days in status state:', error);
    }
  };

  return (
    <>
      <button 
        className={`ytqf-days-button ${showDaysInStatus ? 'active' : 'ghost'}`} 
        onClick={handleToggleDaysInStatus}
        title={'Days in status'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M13.75 8a5.75 5.75 0 1 1-11.5 0 5.75 5.75 0 0 1 11.5 0ZM15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM8.225 5a.625.625 0 1 0-1.25 0v3c0 .22.115.423.303.536l2.5 1.5a.625.625 0 0 0 .644-1.072L8.225 7.646V5Z" clipRule="evenodd"></path>
        </svg>
      </button>
    </>
  );
};
