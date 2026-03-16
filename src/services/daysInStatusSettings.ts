import { DaysInStatusSettings } from '../types';
import { StorageService, DEFAULT_THRESHOLD_RED, DEFAULT_THRESHOLD_YELLOW } from './storage';

const DEFAULT_DAYS_IN_STATUS_SETTINGS: DaysInStatusSettings = {
  hideCreated: false,
  thresholdYellow: DEFAULT_THRESHOLD_YELLOW,
  thresholdRed: DEFAULT_THRESHOLD_RED,
  compactFormat: false,
  createdTagColored: false
};

type SettingsListener = (settings: DaysInStatusSettings) => void;

export class DaysInStatusSettingsService {
  private static instance: DaysInStatusSettingsService;
  private settings: DaysInStatusSettings = { ...DEFAULT_DAYS_IN_STATUS_SETTINGS };
  private initialized = false;
  private initPromise: Promise<DaysInStatusSettings> | null = null;
  private listeners: Set<SettingsListener> = new Set();

  public static getInstance(): DaysInStatusSettingsService {
    if (!DaysInStatusSettingsService.instance) {
      DaysInStatusSettingsService.instance = new DaysInStatusSettingsService();
    }
    return DaysInStatusSettingsService.instance;
  }

  public async init(): Promise<DaysInStatusSettings> {
    if (this.initialized) {
      return this.settings;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    const storageService = StorageService.getInstance();
    this.initPromise = storageService
      .getDaysInStatusSettings()
      .then((loaded) => {
        this.settings = loaded;
        this.initialized = true;
        this.emit();
        return this.settings;
      })
      .finally(() => {
        this.initPromise = null;
      });

    return this.initPromise;
  }

  public getSnapshot(): DaysInStatusSettings {
    return this.settings;
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public update(partial: Partial<DaysInStatusSettings>): void {
    const safePartial = Object.fromEntries(
      Object.entries(partial).filter(([, value]) => value !== undefined)
    ) as Partial<DaysInStatusSettings>;

    this.settings = {
      ...this.settings,
      ...safePartial
    };
    this.initialized = true;
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      listener(this.settings);
    });
  }
}
