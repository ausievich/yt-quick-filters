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
}
