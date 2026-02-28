import { Filter, StorageData, BoardInfo, DaysInStatusSettings } from '../types';

const KEY_PREFIX = 'ytQuickFilters_';
const DEFAULT_FILTERS: Filter[] = [
  { label: 'My Tasks', query: 'Assignee: me' }
];

export const DEFAULT_THRESHOLD_YELLOW = 14;
export const DEFAULT_THRESHOLD_RED = 60;

export class StorageService {
  private static instance: StorageService;

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private getBoardId(): string {
    const match = location.pathname.match(/\/agiles\/([^\/]+)/);
    return match ? match[1] : 'default';
  }

  public getBoardInfo(): BoardInfo {
    const id = this.getBoardId();
    return {
      id,
      storageKey: KEY_PREFIX + id
    };
  }

  public async getFilters(): Promise<Filter[]> {
    const { storageKey } = this.getBoardInfo();
    return new Promise((resolve) => {
      chrome.storage.sync.get(storageKey, (data: StorageData) => {
        resolve(data[storageKey] || DEFAULT_FILTERS);
      });
    });
  }


  public async saveFilters(filters: Filter[]): Promise<void> {
    const { storageKey } = this.getBoardInfo();
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [storageKey]: filters }, resolve);
    });
  }

  public async getDaysInStatusEnabled(): Promise<boolean> {
    const { storageKey } = this.getBoardInfo();
    const daysInStatusKey = storageKey + '_daysInStatus';
    return new Promise((resolve) => {
      chrome.storage.sync.get(daysInStatusKey, (data) => {
        resolve(data[daysInStatusKey] || false);
      });
    });
  }

  public async setDaysInStatusEnabled(enabled: boolean): Promise<void> {
    const { storageKey } = this.getBoardInfo();
    const daysInStatusKey = storageKey + '_daysInStatus';
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [daysInStatusKey]: enabled }, resolve);
    });
  }

  public async addFilter(filter: Filter): Promise<void> {
    const filters = await this.getFilters();
    filters.push(filter);
    await this.saveFilters(filters);
  }

  public async updateFilter(index: number, filter: Filter): Promise<void> {
    const filters = await this.getFilters();
    if (index >= 0 && index < filters.length) {
      filters[index] = filter;
      await this.saveFilters(filters);
    }
  }

  public async deleteFilter(index: number): Promise<void> {
    const filters = await this.getFilters();
    if (index >= 0 && index < filters.length) {
      filters.splice(index, 1);
      await this.saveFilters(filters);
    }
  }

  public async duplicateFilter(index: number): Promise<void> {
    const filters = await this.getFilters();
    if (index >= 0 && index < filters.length) {
      const originalFilter = filters[index];
      const uniqueLabel = this.generateUniqueLabel(originalFilter.label, filters);
      const newFilter: Filter = {
        label: uniqueLabel,
        query: originalFilter.query
      };
      filters.splice(index + 1, 0, newFilter);
      await this.saveFilters(filters);
    }
  }

  private generateUniqueLabel(base: string, filters: Filter[]): string {
    let name = base + ' (copy)';
    let n = 2;
    const labels = new Set(filters.map(f => f.label));
    
    while (labels.has(name)) {
      name = base + ' (copy ' + n + ')';
      n++;
    }
    return name;
  }

  // Days In Status settings (global, not board-specific)
  public async getHideCreatedTag(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.sync.get('ytqf_hideCreatedTag', (data) => {
        resolve(data.ytqf_hideCreatedTag || false);
      });
    });
  }

  public async setHideCreatedTag(hide: boolean): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ ytqf_hideCreatedTag: hide }, resolve);
    });
  }

  // Generic helper for getting storage values
  private async getStorageValue<T>(key: string, defaultValue: T): Promise<T> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(key, (data) => {
        resolve(data[key] !== undefined ? data[key] : defaultValue);
      });
    });
  }

  // Generic helper for setting storage values
  private async setStorageValue<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, resolve);
    });
  }

  public async getDaysInStatusThresholdYellow(): Promise<number> {
    return this.getStorageValue('ytqf_thresholdYellow', DEFAULT_THRESHOLD_YELLOW);
  }

  public async setDaysInStatusThresholdYellow(threshold: number): Promise<void> {
    return this.setStorageValue('ytqf_thresholdYellow', threshold);
  }

  public async getDaysInStatusThresholdRed(): Promise<number> {
    return this.getStorageValue('ytqf_thresholdRed', DEFAULT_THRESHOLD_RED);
  }

  public async setDaysInStatusThresholdRed(threshold: number): Promise<void> {
    return this.setStorageValue('ytqf_thresholdRed', threshold);
  }

  public async getDaysInStatusCompactFormat(): Promise<boolean> {
    return this.getStorageValue('ytqf_compactFormat', false);
  }

  public async setDaysInStatusCompactFormat(enabled: boolean): Promise<void> {
    return this.setStorageValue('ytqf_compactFormat', enabled);
  }

  public async getCreatedTagColored(): Promise<boolean> {
    return this.getStorageValue('ytqf_createdTagColored', false);
  }

  public async setCreatedTagColored(enabled: boolean): Promise<void> {
    return this.setStorageValue('ytqf_createdTagColored', enabled);
  }

  public async getDaysInStatusSettings(): Promise<DaysInStatusSettings> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        [
          'ytqf_hideCreatedTag',
          'ytqf_thresholdYellow',
          'ytqf_thresholdRed',
          'ytqf_compactFormat',
          'ytqf_createdTagColored'
        ],
        (data) => {
          resolve({
            hideCreated: data.ytqf_hideCreatedTag ?? false,
            thresholdYellow: data.ytqf_thresholdYellow ?? DEFAULT_THRESHOLD_YELLOW,
            thresholdRed: data.ytqf_thresholdRed ?? DEFAULT_THRESHOLD_RED,
            compactFormat: data.ytqf_compactFormat ?? false,
            createdTagColored: data.ytqf_createdTagColored ?? false
          });
        }
      );
    });
  }
}
