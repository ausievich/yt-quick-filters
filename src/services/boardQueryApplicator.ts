/**
 * Applies a query by driving YouTrack's Ring search UI without a full page reload.
 */

const QUERY_ASSIST_INPUT = 'search-query-panel [data-test="ring-query-assist-input"]';

/**
 * Sets the contenteditable text. Ring picks it up via the InputEvent dispatched after.
 */
function replaceContentEditableText(el: HTMLElement, text: string): void {
  el.focus();
  el.textContent = text;
}

/**
 * Dispatches input events with `inputType: 'insertText'` — required for Ring
 * to treat the change as user input rather than an external DOM mutation.
 */
function dispatchInputEvents(el: HTMLElement, text: string): void {
  el.dispatchEvent(new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    data: text,
    inputType: 'insertText'
  }));

  el.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    data: text,
    inputType: 'insertText'
  }));

  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function dispatchEnterSubmit(el: HTMLElement): void {
  const init: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keypress', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

function waitForUiTick(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * @returns true if the query assist field was found and a submit was dispatched
 */
export async function tryNativeBoardQuery(query: string): Promise<boolean> {
  const field = document.querySelector<HTMLElement>(QUERY_ASSIST_INPUT);
  if (!field) {
    return false;
  }

  const trimmed = query.trim();

  replaceContentEditableText(field, trimmed);
  dispatchInputEvents(field, trimmed);

  // Let Ring settle before submitting.
  await waitForUiTick();
  dispatchEnterSubmit(field);

  // Double-blur: Ring can async re-focus after Enter, which re-opens the popover.
  requestAnimationFrame(() => field.blur());
  setTimeout(() => field.blur(), 250);

  return true;
}
