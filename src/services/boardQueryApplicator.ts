/**
 * Applies the agile board issues query by driving YouTrack's search UI,
 * so the SPA refetches data without a full document navigation.
 *
 * Target: Ring query assist textbox on agile boards (YouTrack 2024+).
 */

const QUERY_ASSIST_INPUT = 'search-query-panel [data-test="ring-query-assist-input"]';

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

/**
 * @returns true if the query assist field was found and a submit was dispatched
 */
export function tryNativeBoardQuery(query: string): boolean {
  const field = document.querySelector<HTMLElement>(QUERY_ASSIST_INPUT);
  if (!field) {
    return false;
  }

  const trimmed = query.trim();

  field.focus();

  // Ring query assist: contenteditable role="textbox", not <input>
  field.textContent = trimmed;

  field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  dispatchEnterSubmit(field);

  // Defer blur until after YouTrack handles Enter and any async suggestion
  // popover (shown for free-text queries) has had a chance to render.
  // Escape closes the Ring query assist suggestions popover; blur removes
  // the caret from the contenteditable field.
  requestAnimationFrame(() => {
    field.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true
      })
    );
    field.blur();
  });

  return true;
}
