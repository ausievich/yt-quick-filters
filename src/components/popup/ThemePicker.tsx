import React, { useEffect, useRef, useState } from 'react';
import { ColorTheme } from '../../types';
import { ColorThemeOption } from './themeOptions';

type ThemePickerProps = {
  colorTheme: ColorTheme;
  selectedTheme: ColorThemeOption;
  themes: ColorThemeOption[];
  onChange: (theme: ColorTheme) => Promise<void>;
};

export const ThemePicker: React.FC<ThemePickerProps> = ({
  colorTheme,
  selectedTheme,
  themes,
  onChange,
}) => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPaletteOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsPaletteOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPaletteOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPaletteOpen]);

  const selectTheme = async (theme: ColorTheme) => {
    await onChange(theme);
  };

  return (
    <div className="popup-theme-picker" ref={pickerRef}>
      <button
        type="button"
        className="popup-theme-trigger"
        aria-haspopup="true"
        aria-expanded={isPaletteOpen}
        onClick={() => setIsPaletteOpen((isOpen) => !isOpen)}
      >
        <span
          aria-hidden="true"
          className={`popup-theme-trigger-preview popup-theme-preview--${selectedTheme.value}`}
        ></span>
        <span className="popup-theme-trigger-label">{selectedTheme.label}</span>
        <span aria-hidden="true" className="popup-theme-chevron"></span>
      </button>

      {isPaletteOpen && (
        <div className="popup-theme-palette" role="radiogroup" aria-label="Color theme">
          {themes.map((theme) => (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={theme.value === colorTheme}
              aria-label={theme.label}
              title={theme.label}
              className={`popup-theme-swatch-button${theme.value === colorTheme ? ' popup-theme-swatch-button--selected' : ''}`}
              onClick={() => void selectTheme(theme.value)}
            >
              <span
                aria-hidden="true"
                className={`popup-theme-swatch popup-theme-preview--${theme.value}`}
              ></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
