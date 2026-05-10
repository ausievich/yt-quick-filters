/**
 * Applies the agile board issues query by driving YouTrack's search UI,
 * so the SPA refetches data without a full document navigation.
 *
 * Target: Ring query assist textbox on agile boards (YouTrack 2024+).
 */

const QUERY_ASSIST_INPUT = 'search-query-panel [data-test="ring-query-assist-input"]';

/**
 * Replace the contenteditable's text directly. Ring's controller is expected
 * to pick the new text up via the InputEvent dispatched right after, where
 * `inputType: 'insertText'` and `data` route the listener into the
 * "user typed something" branch rather than the unknown-change branch.
 */
function replaceContentEditableText(el: HTMLElement, text: string): void {
  el.focus();
  el.textContent = text;
}

/**
 * Dispatch the input events Ring actually listens to. A bare Event('input')
 * has no inputType/data, so most contenteditable controllers ignore it or
 * trigger a full DOM re-read that overrides our text.
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

  // Yield one frame so Ring can settle its internal state before we submit.
  await waitForUiTick();
  dispatchEnterSubmit(field);

  // The suggestions popover stays open as long as the field has focus, so we
  // blur after Enter is handled. A follow-up blur covers async re-focus from
  // Ring's suggestion API, which can re-open the popover for free-text queries.
  requestAnimationFrame(() => field.blur());
  setTimeout(() => field.blur(), 250);

  return true;
}
