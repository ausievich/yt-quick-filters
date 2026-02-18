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
  const [compactFormat, setCompactFormat] = useState<boolean>(false);
  const [createdTagColored, setCreatedTagColored] = useState<boolean>(false);

  const storageService = StorageService.getInstance();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const hideCreatedValue = await storageService.getHideCreatedTag();
        const thresholdYellowValue = await storageService.getDaysInStatusThresholdYellow();
        const thresholdRedValue = await storageService.getDaysInStatusThresholdRed();
        const compactFormatValue = await storageService.getDaysInStatusCompactFormat();
        const createdTagColoredValue = await storageService.getCreatedTagColored();
        setHideCreated(hideCreatedValue);
        setThresholdYellow(thresholdYellowValue);
        setThresholdRed(thresholdRedValue);
        setCompactFormat(compactFormatValue);
        setCreatedTagColored(createdTagColoredValue);
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
        if (message.compactFormat !== undefined) {
          setCompactFormat(message.compactFormat);
        }
        if (message.createdTagColored !== undefined) {
          setCreatedTagColored(message.createdTagColored);
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
   * Calculate difference in milliseconds for precise time calculation
   */
  const getTimeDifference = (timestamp: number): number => {
    const now = new Date();
    const date = new Date(timestamp);
    return now.getTime() - date.getTime();
  };

  /**
   * Format time difference into compact format (single value: minutes/hours/days/weeks/months/years)
   * Examples: 30 -> "30m", 5 -> "5h", 14 -> "14d", 10 -> "2w", 45 -> "2mo", 400 -> "1y"
   */
  const formatTime = (diffMs: number): string => {
    if (!compactFormat) {
      // For non-compact format, show calendar days
      const now = new Date();
      const date = new Date(now.getTime() - diffMs);
      const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const days = Math.floor((nowStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24));
      return days.toString();
    }

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Minutes: less than 1 hour
    if (minutes < 60) {
      return `${minutes}m`;
    }

    // Hours: less than 1 day
    if (hours < 24) {
      return `${hours}h`;
    }

    // Days: less than 7 days
    if (days < 7) {
      return `${days}d`;
    }

    // Weeks: 7-29 days, round to nearest week
    if (days < 30) {
      const weeks = Math.round(days / 7);
      return `${weeks}w`;
    }

    // Months: 30-364 days, round to nearest month (using 30 days as month)
    if (days < 365) {
      const months = Math.round(days / 30);
      return `${months}mo`;
    }

    // Years: 365+ days, round to nearest year
    const years = Math.round(days / 365);
    return `${years}y`;
  };

  const timeDiffCreated = getTimeDifference(data.created);
  const timeDiffUpdated = getTimeDifference(data.updated);
  
  // For color calculation, still use calendar days
  const now = new Date();
  const createdDate = new Date(data.created);
  const updatedDate = new Date(data.updated);
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const createdStart = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
  const updatedStart = new Date(updatedDate.getFullYear(), updatedDate.getMonth(), updatedDate.getDate());
  const daysSinceCreated = Math.floor((nowStart.getTime() - createdStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceUpdated = Math.floor((nowStart.getTime() - updatedStart.getTime()) / (1000 * 60 * 60 * 24));

  // Determine color based on age for Created
  let createdColorClass = 'days-in-status__tag--gray';
  if (createdTagColored) {
    createdColorClass = 'days-in-status__tag--green';
    if (daysSinceCreated > thresholdRed) {
      createdColorClass = 'days-in-status__tag--red';
    } else if (daysSinceCreated > thresholdYellow) {
      createdColorClass = 'days-in-status__tag--yellow';
    }
  }

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
          {formatTime(timeDiffCreated)}
        </div>
      )}
      <div className={`days-in-status__tag ${updatedColorClass}`} title={`Updated: ${new Date(data.updated).toLocaleDateString()}`}>
        {formatTime(timeDiffUpdated)}
      </div>
    </div>
  );
};
