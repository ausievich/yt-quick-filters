import React from 'react';

type PopupFooterProps = {
  version: string;
  issuesUrl: string;
  reviewsUrl: string;
};

export const PopupFooter: React.FC<PopupFooterProps> = ({ version, issuesUrl, reviewsUrl }) => (
  <div className="popup-footer">
    <div className="popup-footer-links">
      <span className="popup-footer-version">v{version}</span>
      <span className="popup-footer-separator">•</span>
      <a href={reviewsUrl} target="_blank" rel="noopener noreferrer" className="popup-footer-link">
        Leave a review
      </a>
      <span className="popup-footer-separator">•</span>
      <a href={issuesUrl} target="_blank" rel="noopener noreferrer" className="popup-footer-link">
        Report an issue
      </a>
    </div>
  </div>
);
