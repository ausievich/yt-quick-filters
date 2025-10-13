export class UtilsService {
  private static instance: UtilsService;

  public static getInstance(): UtilsService {
    if (!UtilsService.instance) {
      UtilsService.instance = new UtilsService();
    }
    return UtilsService.instance;
  }

  public setQuery(query: string): void {
    const url = new URL(location.href);
    if (query && query.trim()) {
      url.searchParams.set('query', query.trim());
    } else {
      url.searchParams.delete('query');
    }
    location.assign(url.toString());
  }

  /**
   * Normalizes query for comparison - removes extra spaces and converts to lowercase
   */
  public normalizeQuery(query: string): string {
    return query.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Finds active filter by current query
   */
  public findActiveFilter<T extends { query: string }>(filters: T[], currentQuery: string): T | null {
    const normalizedCurrentQuery = this.normalizeQuery(currentQuery);
    
    for (const filter of filters) {
      if (this.normalizeQuery(filter.query) === normalizedCurrentQuery) {
        return filter;
      }
    }
    
    return null;
  }
}
