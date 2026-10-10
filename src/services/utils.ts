import { tryNativeBoardQuery } from './boardQueryApplicator';

export class UtilsService {
  private static instance: UtilsService;

  public static getInstance(): UtilsService {
    if (!UtilsService.instance) {
      UtilsService.instance = new UtilsService();
    }
    return UtilsService.instance;
  }

  public async setQuery(query: string): Promise<void> {
    if (location.pathname.includes('/agiles/') && (await tryNativeBoardQuery(query))) {
      return;
    }

    const url = new URL(location.href);
    if (query && query.trim()) {
      url.searchParams.set('query', query.trim());
    } else {
      url.searchParams.delete('query');
    }
    location.assign(url.toString());
  }
}
