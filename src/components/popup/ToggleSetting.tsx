import React from 'react';

type ToggleSettingProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
};

export const ToggleSetting: React.FC<ToggleSettingProps> = ({
  checked,
  disabled = false,
  label,
  onChange,
}) => (
  <div className={`popup-setting ${disabled ? 'popup-setting--disabled' : ''}`}>
    <label className="popup-toggle-label">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="popup-toggle-input"
      />
      <span className="popup-toggle-switch"></span>
      <span className="popup-toggle-text">{label}</span>
    </label>
  </div>
);
