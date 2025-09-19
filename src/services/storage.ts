import { Filter, StorageData, BoardInfo } from '../types';

const KEY_PREFIX = 'ytQuickFilters_';
const LEGACY_KEY = 'ytQuickFilters'; // Old single key for all boards
const MIGRATION_KEY = 'ytQuickFilters_migration_done'; // Flag to track migration
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
    // Check if migration is needed
    await this.migrateIfNeeded();
    
    const { storageKey } = this.getBoardInfo();
    return new Promise((resolve) => {
      chrome.storage.sync.get(storageKey, (data: StorageData) => {
        resolve(data[storageKey] || DEFAULT_FILTERS);
      });
    });
  }

  private async migrateIfNeeded(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.get([MIGRATION_KEY, LEGACY_KEY], (data) => {
        // If migration already done, skip
        if (data[MIGRATION_KEY]) {
          resolve();
          return;
        }

        // If no legacy data exists, mark migration as done and skip
        if (!data[LEGACY_KEY] || !Array.isArray(data[LEGACY_KEY])) {
          chrome.storage.sync.set({ [MIGRATION_KEY]: true }, () => resolve());
          return;
        }

        // Perform migration
        this.performMigration(data[LEGACY_KEY] as Filter[]).then(() => {
          // Mark migration as completed
          chrome.storage.sync.set({ [MIGRATION_KEY]: true }, () => resolve());
        });
      });
    });
  }

  private async performMigration(legacyFilters: Filter[]): Promise<void> {
    return new Promise((resolve) => {
      // Get all existing board-specific keys
      chrome.storage.sync.get(null, (allData) => {
        const boardKeys: string[] = [];
        
        // Find all existing board-specific keys
        Object.keys(allData).forEach(key => {
          if (key.startsWith(KEY_PREFIX) && key !== MIGRATION_KEY) {
            boardKeys.push(key);
          }
        });

        // If no board-specific data exists, create one for current board
        if (boardKeys.length === 0) {
          const { storageKey } = this.getBoardInfo();
          chrome.storage.sync.set({ [storageKey]: legacyFilters }, () => resolve());
          return;
        }

        // Copy legacy data to all existing board-specific keys
        const updates: StorageData = {};
        boardKeys.forEach(key => {
          // Only copy if the board doesn't already have data
          if (!allData[key] || !Array.isArray(allData[key]) || allData[key].length === 0) {
            updates[key] = legacyFilters;
          }
        });

        // Also copy to current board if it doesn't exist
        const { storageKey } = this.getBoardInfo();
        if (!allData[storageKey] || !Array.isArray(allData[storageKey]) || allData[storageKey].length === 0) {
          updates[storageKey] = legacyFilters;
        }

        if (Object.keys(updates).length > 0) {
          chrome.storage.sync.set(updates, () => resolve());
        } else {
          resolve();
        }
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
