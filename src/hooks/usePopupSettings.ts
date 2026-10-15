import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_THRESHOLD_RED,
  DEFAULT_THRESHOLD_YELLOW,
  StorageService,
} from '../services/storage';
import { ColorTheme, DaysInStatusSettings } from '../types';
import { COLOR_THEMES } from '../components/popup/themeOptions';

type ThresholdKey = 'thresholdYellow' | 'thresholdRed';
type ThresholdStorageUpdater = (value: number) => Promise<void>;

const shouldIgnoreMissingContentScript = (error: unknown): boolean =>
  (error instanceof Error ? error.message : String(error)).includes('Receiving end does not exist');

export const usePopupSettings = () => {
  const storageService = useMemo(() => StorageService.getInstance(), []);
  const [colorTheme, setColorTheme] = useState<ColorTheme>('ring');
  const [allowMultipleFilters, setAllowMultipleFilters] = useState(false);
  const [showDaysInStatusButton, setShowDaysInStatusButton] = useState(false);
  const [showCreated, setShowCreated] = useState(true);
  const [thresholdYellowInput, setThresholdYellowInput] = useState('');
  const [thresholdRedInput, setThresholdRedInput] = useState('');
  const [lastUserYellowValue, setLastUserYellowValue] = useState(DEFAULT_THRESHOLD_YELLOW);
  const [lastUserRedValue, setLastUserRedValue] = useState(DEFAULT_THRESHOLD_RED);
  const [createdTagColored, setCreatedTagColored] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const notifyContentScript = useCallback(async (message: Partial<DaysInStatusSettings>) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.tabs.sendMessage(tab.id, {
        type: 'UPDATE_DAYS_IN_STATUS_SETTINGS',
        ...message,
      });
    } catch (error) {
      if (shouldIgnoreMissingContentScript(error)) return;
      console.warn('Failed to notify content script:', error);
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const colorThemeValue = await storageService.getColorTheme();
        const allowMultipleFiltersValue = await storageService.getAllowMultipleFilters();
        const showDaysInStatusButtonValue = await storageService.getShowDaysInStatusButton();
        const hideCreatedValue = await storageService.getHideCreatedTag();
        const thresholdYellowValue = await storageService.getDaysInStatusThresholdYellow();
        const thresholdRedValue = await storageService.getDaysInStatusThresholdRed();
        const createdTagColoredValue = await storageService.getCreatedTagColored();
        const normalizedYellow =
          thresholdYellowValue > 0 ? thresholdYellowValue : DEFAULT_THRESHOLD_YELLOW;
        const normalizedRed = thresholdRedValue > 0 ? thresholdRedValue : DEFAULT_THRESHOLD_RED;
        const selectedTheme = COLOR_THEMES.some((theme) => theme.value === colorThemeValue)
          ? colorThemeValue
          : 'ring';

        setColorTheme(selectedTheme);
        if (selectedTheme !== colorThemeValue) {
          await storageService.setColorTheme(selectedTheme);
        }
        setAllowMultipleFilters(allowMultipleFiltersValue);
        setShowDaysInStatusButton(showDaysInStatusButtonValue);
        setShowCreated(!hideCreatedValue);
        setThresholdYellowInput(normalizedYellow.toString());
        setThresholdRedInput(normalizedRed.toString());
        setLastUserYellowValue(normalizedYellow);
        setLastUserRedValue(normalizedRed);
        setCreatedTagColored(createdTagColoredValue);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, [storageService]);

  const handleColorThemeChange = useCallback(
    async (value: ColorTheme) => {
      if (!COLOR_THEMES.some((theme) => theme.value === value)) return;

      setColorTheme(value);
      await storageService.setColorTheme(value);

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        await chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_COLOR_THEME', colorTheme: value });
      } catch (error) {
        if (shouldIgnoreMissingContentScript(error)) return;
        console.warn('Failed to notify content script about color theme:', error);
      }
    },
    [storageService],
  );

  const handleShowCreatedChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.checked;
      setShowCreated(value);
      await storageService.setHideCreatedTag(!value);
      await notifyContentScript({ hideCreated: !value });
    },
    [notifyContentScript, storageService],
  );

  const handleShowDaysInStatusButtonChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.checked;
      setShowDaysInStatusButton(value);
      await storageService.setShowDaysInStatusButton(value);
      await notifyContentScript({ showDaysInStatusButton: value });
    },
    [notifyContentScript, storageService],
  );

  const handleAllowMultipleFiltersChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.checked;
      setAllowMultipleFilters(value);
      await storageService.setAllowMultipleFilters(value);
    },
    [storageService],
  );

  const handleCreatedTagColoredChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.checked;
      setCreatedTagColored(value);
      await storageService.setCreatedTagColored(value);
      await notifyContentScript({ createdTagColored: value });
    },
    [notifyContentScript, storageService],
  );

  const commitThresholdValue = useCallback(
    async (
      inputValue: string,
      lastUserValue: number,
      setInput: (value: string) => void,
      setLastUserValue: (value: number) => void,
      saveToStorage: ThresholdStorageUpdater,
      notifyKey: ThresholdKey,
    ) => {
      const trimmedInput = inputValue.trim();
      const value = parseInt(trimmedInput, 10);
      const valueToCommit =
        trimmedInput !== '' && !isNaN(value) && value > 0 ? value : lastUserValue;

      setInput(valueToCommit.toString());
      if (valueToCommit !== lastUserValue) {
        setLastUserValue(valueToCommit);
      }
      await saveToStorage(valueToCommit);
      await notifyContentScript({ [notifyKey]: valueToCommit });
    },
    [notifyContentScript],
  );

  const createThresholdChangeHandler = useCallback(
    (
      setInput: (value: string) => void,
      saveToStorage: ThresholdStorageUpdater,
      notifyKey: ThresholdKey,
    ) =>
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const digitsOnly = event.target.value.replace(/\D/g, '');
        if (digitsOnly.length > 4) return;

        setInput(digitsOnly);
        const value = parseInt(digitsOnly, 10);
        if (digitsOnly !== '' && !isNaN(value) && value > 0) {
          await saveToStorage(value);
          await notifyContentScript({ [notifyKey]: value });
        }
      },
    [notifyContentScript],
  );

  const handleThresholdYellowChange = createThresholdChangeHandler(
    setThresholdYellowInput,
    storageService.setDaysInStatusThresholdYellow.bind(storageService),
    'thresholdYellow',
  );
  const handleThresholdYellowBlur = useCallback(
    () =>
      commitThresholdValue(
        thresholdYellowInput,
        lastUserYellowValue,
        setThresholdYellowInput,
        setLastUserYellowValue,
        storageService.setDaysInStatusThresholdYellow.bind(storageService),
        'thresholdYellow',
      ),
    [commitThresholdValue, lastUserYellowValue, storageService, thresholdYellowInput],
  );
  const handleThresholdRedChange = createThresholdChangeHandler(
    setThresholdRedInput,
    storageService.setDaysInStatusThresholdRed.bind(storageService),
    'thresholdRed',
  );
  const handleThresholdRedBlur = useCallback(
    () =>
      commitThresholdValue(
        thresholdRedInput,
        lastUserRedValue,
        setThresholdRedInput,
        setLastUserRedValue,
        storageService.setDaysInStatusThresholdRed.bind(storageService),
        'thresholdRed',
      ),
    [commitThresholdValue, lastUserRedValue, storageService, thresholdRedInput],
  );

  useEffect(() => {
    const commitAllThresholds = async () => {
      await Promise.all([handleThresholdYellowBlur(), handleThresholdRedBlur()]);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void commitAllThresholds();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleThresholdRedBlur, handleThresholdYellowBlur]);

  return {
    allowMultipleFilters,
    colorTheme,
    createdTagColored,
    handleAllowMultipleFiltersChange,
    handleColorThemeChange,
    handleCreatedTagColoredChange,
    handleShowDaysInStatusButtonChange,
    handleShowCreatedChange,
    handleThresholdRedBlur,
    handleThresholdRedChange,
    handleThresholdYellowBlur,
    handleThresholdYellowChange,
    isLoading,
    lastUserRedValue,
    lastUserYellowValue,
    showCreated,
    showDaysInStatusButton,
    thresholdRedInput,
    thresholdYellowInput,
  };
};
