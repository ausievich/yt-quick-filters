import React from 'react';
import { createRoot } from 'react-dom/client';
import manifest from '../../manifest.json';
import { usePopupSettings } from '../hooks/usePopupSettings';
import { PopupFooter } from './popup/PopupFooter';
import { ThemePicker } from './popup/ThemePicker';
import { ToggleSetting } from './popup/ToggleSetting';
import { COLOR_THEMES } from './popup/themeOptions';
import './Popup.css';

const GITHUB_ISSUES_URL = 'https://github.com/ausievich/yt-quick-filters/issues';
const CHROME_WEB_STORE_REVIEWS_URL =
  'https://chromewebstore.google.com/detail/youtrack-quick-filters/iaddgmcajdiblafjfhloadmphkbplddo/reviews';

const Popup: React.FC = () => {
  const settings = usePopupSettings();

  if (settings.isLoading) {
    return (
      <div className="popup-container">
        <div className="popup-loading">Loading...</div>
      </div>
    );
  }

  const selectedTheme =
    COLOR_THEMES.find((theme) => theme.value === settings.colorTheme) ?? COLOR_THEMES[0];

  return (
    <div className="popup-container">
      <div className="popup-section">
        <section className="popup-settings-group">
          <h3 className="popup-section-title">Quick filters</h3>

          <div className="popup-setting popup-combine-setting">
            <label className="popup-toggle-label">
              <input
                type="checkbox"
                checked={settings.allowMultipleFilters}
                onChange={settings.handleAllowMultipleFiltersChange}
                className="popup-toggle-input"
              />
              <span className="popup-toggle-switch"></span>
              <span className="popup-toggle-text">Combine filters</span>
            </label>
            <span
              className="popup-help-trigger"
              role="img"
              tabIndex={0}
              aria-label="More information about combining filters"
              aria-describedby="combine-filters-help"
            >
              <span aria-hidden="true" className="popup-help-icon">
                ?
              </span>
            </span>
            <span id="combine-filters-help" role="tooltip" className="popup-help-tooltip">
              Select several filters at once.
            </span>
          </div>
          <ToggleSetting
            checked={settings.saveFiltersFromSearch}
            label="Save filters from search"
            onChange={settings.handleSaveFiltersFromSearchChange}
          />
        </section>

        <section className="popup-settings-group">
          <h3 className="popup-section-title">Appearance</h3>

          <div className="popup-setting popup-theme-setting">
            <span className="popup-theme-label">Color theme</span>
            <ThemePicker
              colorTheme={settings.colorTheme}
              selectedTheme={selectedTheme}
              themes={COLOR_THEMES}
              onChange={settings.handleColorThemeChange}
            />
          </div>
        </section>

        <section className="popup-settings-group">
          <h3 className="popup-section-title">Time badges</h3>

          <ToggleSetting
            checked={settings.showDaysInStatusButton}
            label="Show time badges button"
            onChange={settings.handleShowDaysInStatusButtonChange}
          />
          <ToggleSetting
            checked={settings.showCreated}
            disabled={!settings.showDaysInStatusButton}
            label="Show Created tag"
            onChange={settings.handleShowCreatedChange}
          />
          <ToggleSetting
            checked={settings.createdTagColored}
            disabled={!settings.showDaysInStatusButton}
            label="Color Created tag"
            onChange={settings.handleCreatedTagColoredChange}
          />

          <div
            className={`popup-setting popup-setting-thresholds ${
              !settings.showDaysInStatusButton ? 'popup-setting--disabled' : ''
            }`}
            aria-disabled={!settings.showDaysInStatusButton}
          >
            <div className="popup-threshold-row">
              <span className="popup-threshold-indicator popup-threshold-indicator--yellow"></span>
              <label className="popup-threshold-label">Warning after</label>
              <input
                type="text"
                value={settings.thresholdYellowInput}
                disabled={!settings.showDaysInStatusButton}
                onChange={settings.handleThresholdYellowChange}
                onBlur={() => void settings.handleThresholdYellowBlur()}
                placeholder={
                  settings.lastUserYellowValue > 0 ? settings.lastUserYellowValue.toString() : ''
                }
                className="popup-input popup-input-threshold"
              />
              <span className="popup-threshold-unit">days</span>
            </div>

            <div className="popup-threshold-row">
              <span className="popup-threshold-indicator popup-threshold-indicator--red"></span>
              <label className="popup-threshold-label">Stale after</label>
              <input
                type="text"
                value={settings.thresholdRedInput}
                disabled={!settings.showDaysInStatusButton}
                onChange={settings.handleThresholdRedChange}
                onBlur={() => void settings.handleThresholdRedBlur()}
                placeholder={
                  settings.lastUserRedValue > 0 ? settings.lastUserRedValue.toString() : ''
                }
                className="popup-input popup-input-threshold"
              />
              <span className="popup-threshold-unit">days</span>
            </div>
          </div>
        </section>
      </div>

      <PopupFooter
        version={manifest.version}
        issuesUrl={GITHUB_ISSUES_URL}
        reviewsUrl={CHROME_WEB_STORE_REVIEWS_URL}
      />
    </div>
  );
};

const container = document.getElementById('popup-root');
if (container) {
  createRoot(container).render(<Popup />);
}
