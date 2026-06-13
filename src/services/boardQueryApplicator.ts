/**
 * Applies a query by driving YouTrack's Ring search UI without a full page reload.
 */

const QUERY_ASSIST_SELECTORS = [
  '[data-test="ring-query-assist-input"][contenteditable="true"]',
  'search-query-panel [contenteditable="true"][role="textbox"]',
  'rg-query-assist [contenteditable="true"][role="textbox"]'
];

export function getQueryAssistInputElement(): HTMLElement | null {
  for (const selector of QUERY_ASSIST_SELECTORS) {
    const input = document.querySelector<HTMLElement>(selector);
    if (input) {
      return input;
    }
  }

  return null;
}

function normalizeUiQueryText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getCurrentQuery(): string {
  const input = getQueryAssistInputElement();

  if (input) {
    return normalizeUiQueryText(input.innerText || input.textContent || '');
  }

  return new URLSearchParams(location.search).get('query')?.trim() || '';
}

function replaceContentEditableText(element: HTMLElement, text: string): void {
  const selection = window.getSelection();
  const range = document.createRange();

  element.focus();

  if (typeof document.execCommand === 'function') {
    try {
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, text);
    } catch {
      element.textContent = text;
    }
  } else {
    element.textContent = text;
  }

  if (!selection) {
    return;
  }

  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function dispatchQueryInputEvents(element: HTMLElement, text: string): void {
  element.dispatchEvent(new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    data: text,
    inputType: 'insertText'
  }));

  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    data: text,
    inputType: 'insertText'
  }));

  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function dispatchEnterKey(element: HTMLElement): void {
  const keyboardEventInit: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  };

  element.dispatchEvent(new KeyboardEvent('keydown', keyboardEventInit));
  element.dispatchEvent(new KeyboardEvent('keypress', keyboardEventInit));
  element.dispatchEvent(new KeyboardEvent('keyup', keyboardEventInit));
}

function waitForUiTick(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * @returns true if the query assist field was found and a submit was dispatched
 */
export async function tryNativeBoardQuery(query: string): Promise<boolean> {
  const input = getQueryAssistInputElement();

  if (!input) {
    return false;
  }

  const normalizedQuery = query.trim();

  input.focus();
  replaceContentEditableText(input, normalizedQuery);
  dispatchQueryInputEvents(input, normalizedQuery);

  await waitForUiTick();
  dispatchEnterKey(input);
  input.blur();

  return true;
}
