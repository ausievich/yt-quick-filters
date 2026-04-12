/**
 * Applies the agile board issues query by driving YouTrack's search UI,
 * so the SPA refetches data without a full document navigation.
 *
 * Target: Ring query assist textbox on agile boards (YouTrack 2024+).
 */

const QUERY_ASSIST_INPUT = 'search-query-panel [data-test="ring-query-assist-input"]';
const NEUTRAL_FOCUS_TARGET =
  '#ytqf-filter-container, .yt-agile-board__top-bar, .yt-agile-board__toolbar[data-test="yt-agile-board-toolbar"], .yt-agile-board__toolbar';

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

function dismissQueryAssist(el: HTMLElement): void {
  const neutralTarget = document.querySelector<HTMLElement>(NEUTRAL_FOCUS_TARGET);

  // Blur on the next frame so YouTrack can finish handling Enter first,
  // then move focus to a neutral toolbar container instead of leaving it
  // on the query assist textbox.
  requestAnimationFrame(() => {
    el.blur();
    window.getSelection()?.removeAllRanges();

    if (neutralTarget) {
      const hadTabIndex = neutralTarget.hasAttribute('tabindex');
      if (!hadTabIndex) {
        neutralTarget.setAttribute('tabindex', '-1');
      }
      neutralTarget.focus({ preventScroll: true });
      if (!hadTabIndex) {
        neutralTarget.removeAttribute('tabindex');
      }
    }
  });
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

  queueMicrotask(() => {
    dismissQueryAssist(field);
  });

  return true;
}
