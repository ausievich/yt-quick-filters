import React, { useState, useEffect } from 'react';
import { DaysInStatusInfo } from '../types';
import { DaysInStatusAPI } from '../services/daysInStatusAPI';
import { StorageService } from '../services/storage';
import './DaysInStatusTags.css';

interface DaysInStatusProps {
  issueId: string;
  onDataLoaded?: (data: DaysInStatusInfo) => void;
}

export const DaysInStatusTags: React.FC<DaysInStatusProps> = ({ issueId, onDataLoaded }) => {
  const [data, setData] = useState<DaysInStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideCreated, setHideCreated] = useState<boolean>(false);
  const [thresholdYellow, setThresholdYellow] = useState<number>(14);
  const [thresholdRed, setThresholdRed] = useState<number>(60);

  const storageService = StorageService.getInstance();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const hideCreatedValue = await storageService.getHideCreatedTag();
        const thresholdYellowValue = await storageService.getDaysInStatusThresholdYellow();
        const thresholdRedValue = await storageService.getDaysInStatusThresholdRed();
        setHideCreated(hideCreatedValue);
        setThresholdYellow(thresholdYellowValue);
        setThresholdRed(thresholdRedValue);
      } catch (error) {
        console.error('Failed to load Days In Status settings:', error);
      }
    };

    loadSettings();
  }, [storageService]);

  useEffect(() => {
    const loadDaysInStatus = async () => {
      try {
        const apiService = DaysInStatusAPI.getInstance();
        const result = await apiService.getDaysInStatus(issueId);
        setData(result);
        if (result) {
          onDataLoaded?.(result);
        }
      } catch (error) {
        console.error(`❌ Error loading days in status for ${issueId}:`, error);
        // Don't show anything if we can't get real data
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    loadDaysInStatus();
  }, [issueId, onDataLoaded]);

  // Listen for settings updates from popup
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'UPDATE_DAYS_IN_STATUS_SETTINGS') {
        if (message.hideCreated !== undefined) {
          setHideCreated(message.hideCreated);
        }
        if (message.thresholdYellow !== undefined) {
          setThresholdYellow(message.thresholdYellow);
        }
        if (message.thresholdRed !== undefined) {
          setThresholdRed(message.thresholdRed);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  if (loading) {
    return (
      <div className="days-in-status days-in-status--loading">
        <div className="days-in-status__indicator">...</div>
      </div>
    );
  }

  if (!data) {
    // Show dashes when API data is not available
    return (
      <div className="days-in-status">
        <div className="days-in-status__tag days-in-status__tag--gray" title="No data available">
          —
        </div>
        <div className="days-in-status__tag days-in-status__tag--gray" title="No data available">
          —
        </div>
      </div>
    );
  }

  /**
   * Calculate difference in calendar days (not 24-hour periods)
   * This matches YouTrack's behavior which counts days based on calendar dates in user's timezone
   */
  const getDaysDifference = (timestamp: number): number => {
    const now = new Date();
    const date = new Date(timestamp);
    
    // Set both dates to start of day in local timezone (midnight)
    // This ensures we count calendar days, not 24-hour periods
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Calculate difference in milliseconds and convert to days
    const diffMs = nowStart.getTime() - dateStart.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const daysSinceCreated = getDaysDifference(data.created);
  const daysSinceUpdated = getDaysDifference(data.updated);

  // Determine color based on age for Created
  // Temporarily disabled - always use gray for created
  // let createdColorClass = 'days-in-status__tag--green';
  // if (daysSinceCreated > thresholdRed) {
  //   createdColorClass = 'days-in-status__tag--red';
  // } else if (daysSinceCreated > thresholdYellow) {
  //   createdColorClass = 'days-in-status__tag--yellow';
  // }
  const createdColorClass = 'days-in-status__tag--gray';

  // Determine color based on age for Updated using configurable thresholds
  let updatedColorClass = 'days-in-status__tag--green';
  if (daysSinceUpdated > thresholdRed) {
    updatedColorClass = 'days-in-status__tag--red';
  } else if (daysSinceUpdated > thresholdYellow) {
    updatedColorClass = 'days-in-status__tag--yellow';
  }

  return (
    <div className="days-in-status">
      {!hideCreated && (
        <div className={`days-in-status__tag ${createdColorClass}`} title={`Created: ${new Date(data.created).toLocaleDateString()}`}>
          {daysSinceCreated}
        </div>
      )}
      <div className={`days-in-status__tag ${updatedColorClass}`} title={`Updated: ${new Date(data.updated).toLocaleDateString()}`}>
        {daysSinceUpdated}
      </div>
    </div>
  );
};
