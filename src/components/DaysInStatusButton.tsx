import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { DaysInStatusManager } from '../services/daysInStatusManager';
import { LocalStorageAPIClient } from '../services/localStorageAPIClient';
import './DaysInStatusButton.css';

export const DaysInStatusButton: React.FC = () => {
  const [showDaysInStatus, setShowDaysInStatus] = useState<boolean>(false);
  const [hasToken, setHasToken] = useState(false);

  const storageService = StorageService.getInstance();
  const daysInStatusManager = DaysInStatusManager.getInstance();

  // Check if we have a token on mount
  useEffect(() => {
    const checkToken = async () => {
      try {
        const localStorageClient = LocalStorageAPIClient.getInstance();
        await localStorageClient.initialize();
        
        const hasValidToken = localStorageClient.hasValidToken();
        setHasToken(hasValidToken);
        
        if (hasValidToken) {
          console.log('🔑 LocalStorage token detected and ready');
        } else {
          console.log('⚠️ No localStorage token found');
        }
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
    setShowDaysInStatus(newState);
    daysInStatusManager.setEnabled(newState);
    
    try {
      await storageService.setDaysInStatusEnabled(newState);
    } catch (error) {
      console.error('Failed to save days in status state:', error);
    }
  };

  // No manual token management needed - everything is automatic

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
