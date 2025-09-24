export class UtilsService {
  private static instance: UtilsService;

  public static getInstance(): UtilsService {
    if (!UtilsService.instance) {
      UtilsService.instance = new UtilsService();
    }
    return UtilsService.instance;
  }

  public getCurrentQuery(): string {
    return new URL(location.href).searchParams.get('query') || '';
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

  public findToolbar(): Element | null {
    return document.querySelector('.yt-agile-board__toolbar[data-test="yt-agile-board-toolbar"]') ||
           document.querySelector('.yt-agile-board__toolbar');
  }

  public createElement(tag: string, className?: string, id?: string): HTMLElement {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (id) element.id = id;
    return element;
  }

  public escapeHtml(text: string): string {
    return text.replace(/"/g, '&quot;');
  }
}
