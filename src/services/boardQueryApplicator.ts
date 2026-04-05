/**
 * Applies the agile board issues query by driving YouTrack's search UI,
 * so the SPA refetches data without a full document navigation.
 */

function* walkComposedSubtree(root: Element | ShadowRoot): Generator<Element> {
  const children =
    root instanceof ShadowRoot ? Array.from(root.children) : Array.from(root.children);
  for (const el of children) {
    yield el;
    yield* walkComposedSubtree(el);
    if (el.shadowRoot) {
      yield* walkComposedSubtree(el.shadowRoot);
    }
  }
}

function findSearchField(panel: Element): HTMLElement | null {
  let inputCandidate: HTMLInputElement | null = null;

  for (const el of walkComposedSubtree(panel)) {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'file') {
        continue;
      }
      if (el.getAttribute('role') === 'searchbox') {
        return el;
      }
      if (
        el.getAttribute('data-test')?.toLowerCase().includes('search') ||
        el.getAttribute('aria-label')?.toLowerCase().includes('search')
      ) {
        return el;
      }
      if (!inputCandidate) {
        inputCandidate = el;
      }
    }
    if (el instanceof HTMLElement && el.isContentEditable) {
      return el;
    }
  }

  return inputCandidate;
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getPrototypeOf(input) as object;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value') as
    | PropertyDescriptor
    | undefined;
  if (desc?.set) {
    desc.set.call(input, value);
  } else {
    input.value = value;
  }
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

/**
 * @returns true if the native search panel was found and a submit was dispatched
 */
export function tryApplyBoardQueryViaNativeSearch(query: string): boolean {
  const panel = document.querySelector('search-query-panel');
  if (!panel) {
    return false;
  }

  const field = findSearchField(panel);
  if (!field) {
    return false;
  }

  const trimmed = query.trim();

  field.focus();

  if (field instanceof HTMLInputElement) {
    setNativeInputValue(field, trimmed);
  } else {
    field.textContent = trimmed;
  }

  field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  dispatchEnterSubmit(field);

  queueMicrotask(() => {
    field.blur();
  });

  return true;
}
