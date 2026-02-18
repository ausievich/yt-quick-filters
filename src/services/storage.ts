import { Filter, StorageData, BoardInfo } from '../types';

const KEY_PREFIX = 'ytQuickFilters_';
const DEFAULT_FILTERS: Filter[] = [
  { label: 'My Tasks', query: 'Assignee: me' }
];

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

  public async getDaysInStatusThresholdYellow(): Promise<number> {
    return new Promise((resolve) => {
      chrome.storage.sync.get('ytqf_thresholdYellow', (data) => {
        resolve(data.ytqf_thresholdYellow || 14);
      });
    });
  }

  public async setDaysInStatusThresholdYellow(threshold: number): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ ytqf_thresholdYellow: threshold }, resolve);
    });
  }

  public async getDaysInStatusThresholdRed(): Promise<number> {
    return new Promise((resolve) => {
      chrome.storage.sync.get('ytqf_thresholdRed', (data) => {
        resolve(data.ytqf_thresholdRed || 60);
      });
    });
  }

  public async setDaysInStatusThresholdRed(threshold: number): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ ytqf_thresholdRed: threshold }, resolve);
    });
  }
}
