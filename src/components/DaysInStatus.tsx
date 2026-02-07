import React, { useState, useEffect } from 'react';
import { DaysInStatusInfo } from '../types';
import { DaysInStatusAPI } from '../services/daysInStatusAPI';
import './DaysInStatus.css';

interface DaysInStatusProps {
  issueId: string;
  onDataLoaded?: (data: DaysInStatusInfo) => void;
}

export const DaysInStatus: React.FC<DaysInStatusProps> = ({ issueId, onDataLoaded }) => {
  const [data, setData] = useState<DaysInStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDaysInStatus = async () => {
      try {
        const apiService = DaysInStatusAPI.getInstance();
        const cardElement = document.querySelector(`[data-issue-id="${issueId}"]`) as HTMLElement;
        
        if (cardElement) {
          const result = await apiService.getDaysInStatusFromDOM(issueId, cardElement);
          setData(result);
          if (result) {
            onDataLoaded?.(result);
          }
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
  // if (daysSinceCreated > 60) {
  //   createdColorClass = 'days-in-status__tag--red';
  // } else if (daysSinceCreated > 30) {
  //   createdColorClass = 'days-in-status__tag--yellow';
  // }
  const createdColorClass = 'days-in-status__tag--gray';

  // Determine color based on age for Updated
  let updatedColorClass = 'days-in-status__tag--green';
  if (daysSinceUpdated > 60) {
    updatedColorClass = 'days-in-status__tag--red';
  } else if (daysSinceUpdated > 14) {
    updatedColorClass = 'days-in-status__tag--yellow';
  }

  return (
    <div className="days-in-status">
      <div className={`days-in-status__tag ${createdColorClass}`} title={`Created: ${new Date(data.created).toLocaleDateString()}`}>
        {daysSinceCreated}
      </div>
      <div className={`days-in-status__tag ${updatedColorClass}`} title={`Updated: ${new Date(data.updated).toLocaleDateString()}`}>
        {daysSinceUpdated}
      </div>
    </div>
  );
};
