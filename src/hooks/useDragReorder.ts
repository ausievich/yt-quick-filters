import React, { useLayoutEffect, useRef, useState } from 'react';

// Pointer must travel this far before a press turns into a drag (keeps clicks working).
const DRAG_THRESHOLD = 4;
// Space between neighbouring items: flex `gap` (4px) + item margin (4px).
const ITEM_SPACING = 8;
const LIFT_SHADOW = '0 8px 20px rgb(39 40 46 / 22%)';
const SETTLE_OPTIONS = { duration: 240, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' };
// Matches the neighbour slide in FilterBar.css, so a returning item and the
// neighbours making room for it move together.
const RETURN_MS = 400;
const RETURN_EASING = 'cubic-bezier(0.45, 0, 0.25, 1)';

interface Press {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
}

interface Drag {
  from: number;
  // Where the lifted item was picked up (viewport coordinates) and its size.
  left: number;
  top: number;
  width: number;
  height: number;
  // Pointer travel since pick-up.
  dx: number;
  dy: number;
  // Index the item would land at once dropped; null while the pointer is away
  // from the row, when neighbours close the gap.
  slot: number | null;
  // Released away from the row: the item is gliding back to where it started.
  returning: boolean;
  // Until the first move after pick-up, neighbours change without a transition:
  // the lifted item leaving the flow must not look like a slide.
  pristine: boolean;
}

interface Settle {
  // Final index of the released item and its centre at the moment of release.
  index: number;
  x: number;
  y: number;
}

const INDEX_ATTR = 'data-drag-index';

/**
 * Pointer-based drag-to-reorder for a row of items. The lifted item leaves the
 * flow and follows the pointer, neighbours slide to open or close the gap, and
 * on release the item glides into its new place.
 *
 * Spread `getItemProps(index)` on every item; attach `containerRef` to their parent.
 */
export const useDragReorder = (count: number, onReorder: (from: number, to: number) => void) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pressRef = useRef<Press | null>(null);
  const suppressClickRef = useRef(false);
  const settleRef = useRef<Settle | null>(null);

  const updateDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  // Make the browser compute the pick-up layout before the next change, so that
  // closing the gap right after pick-up is a transition and not a jump.
  useLayoutEffect(() => {
    if (drag?.pristine) void containerRef.current?.offsetWidth;
  }, [drag?.pristine]);

  // After a drop the item is back in the flow at its final place: fly it there
  // from where it was released.
  useLayoutEffect(() => {
    const settle = settleRef.current;
    if (!settle || drag) return;
    settleRef.current = null;

    const item = containerRef.current?.querySelector<HTMLElement>(
      `[${INDEX_ATTR}="${settle.index}"]`,
    );
    if (!item) return;

    const rect = item.getBoundingClientRect();
    const deltaX = settle.x - (rect.left + rect.width / 2);
    const deltaY = settle.y - (rect.top + rect.height / 2);

    item.style.zIndex = '3';
    const animation = item.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(1.05)`, boxShadow: LIFT_SHADOW },
        { transform: 'none', boxShadow: '0 0 0 rgb(39 40 46 / 0%)' },
      ],
      SETTLE_OPTIONS,
    );
    animation.onfinish = animation.oncancel = () => {
      item.style.zIndex = '';
    };
  }, [drag]);

  const findSlot = (current: Drag, pointerX: number, pointerY: number): number | null => {
    const items = [
      ...(containerRef.current?.querySelectorAll<HTMLElement>(`[${INDEX_ATTR}]`) ?? []),
    ].filter((item) => Number(item.getAttribute(INDEX_ATTR)) !== current.from);
    const rects = items.map((item) => item.getBoundingClientRect());

    // Pointer left the rows (dragged up or down): no insertion point, so the
    // neighbours close the gap.
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    if (pointerY < top || pointerY > bottom) return null;

    let slot = 0;

    for (const rect of rects) {
      const isBelow = pointerY < rect.top;
      const isBefore = pointerY <= rect.bottom && pointerX < rect.left + rect.width / 2;
      if (isBelow || isBefore) break;
      slot++;
    }

    return slot;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;

    const dx = e.clientX - press.startX;
    const dy = e.clientY - press.startY;
    const current = dragRef.current;

    if (current) {
      updateDrag({
        ...current,
        dx,
        dy,
        pristine: false,
        slot: findSlot(current, e.clientX, e.clientY),
      });
      return;
    }
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    const rect = e.currentTarget.getBoundingClientRect();
    suppressClickRef.current = true;
    updateDrag({
      from: press.index,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      dx,
      dy,
      slot: press.index,
      returning: false,
      pristine: true,
    });
  };

  const finish = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const current = dragRef.current;
    if (pressRef.current?.pointerId !== e.pointerId) return;
    pressRef.current = null;
    if (!current) return;

    // Released away from the row (or cancelled): reopen the gap at the original
    // place and send the item back to it, then let go once everything has settled.
    if (cancelled || current.slot === null) {
      updateDrag({ ...current, slot: current.from, dx: 0, dy: 0, returning: true });
      setTimeout(() => updateDrag(null), RETURN_MS);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const to = current.slot;
    settleRef.current = { index: to, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateDrag(null);

    if (to !== current.from) onReorder(current.from, to);
  };

  const getItemProps = (index: number) => {
    const isLifted = drag?.from === index;
    let style: React.CSSProperties | undefined;

    if (drag && isLifted) {
      style = {
        position: 'fixed',
        left: drag.left,
        top: drag.top,
        width: drag.width,
        height: drag.height,
        margin: 0,
        zIndex: 3,
        transform: `translate(${drag.dx}px, ${drag.dy}px)`,
        transition: drag.returning ? `transform ${RETURN_MS}ms ${RETURN_EASING}` : undefined,
        pointerEvents: 'none',
      };
    } else if (drag) {
      // Open the gap in front of the item sitting at the target slot (or behind
      // the last one when dropping at the end).
      const position = index < drag.from ? index : index - 1;
      const gap = drag.width + ITEM_SPACING;
      if (position === drag.slot) style = { marginLeft: gap };
      else if (drag.slot !== null && drag.slot === count - 1 && position === count - 2)
        style = { marginRight: gap };
      if (drag.pristine) style = { ...style, transition: 'none' };
    }

    return {
      [INDEX_ATTR]: index,
      style,
      className: [isLifted && 'dragging', drag && 'shifting'].filter(Boolean).join(' '),
      // A drag ends in a click on the same element; keep it from activating the filter.
      onClickCapture: (e: React.MouseEvent) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        e.stopPropagation();
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 || dragRef.current) return;
        suppressClickRef.current = false;
        // Capture from the start so a fast flick off the item can't lose the gesture.
        e.currentTarget.setPointerCapture(e.pointerId);
        pressRef.current = { index, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
      },
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => finish(e, true),
    };
  };

  return { containerRef, isDragging: drag !== null, getItemProps };
};
