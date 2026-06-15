import React, { useEffect, useRef } from 'react';
import { SaveFilterButtonProps } from '../types';
import { getQueryAssistInputElement } from '../services/boardQueryApplicator';
import './SaveFilterButton.css';

export const SaveFilterButton: React.FC<SaveFilterButtonProps> = ({ visible, onSave }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const input = getQueryAssistInputElement();
    if (!input) {
      return;
    }

    if (!visible) {
      input.style.removeProperty('padding-right');
      return;
    }

    const updatePadding = () => {
      const button = buttonRef.current;
      if (!button) {
        return;
      }

      input.style.paddingRight = `${button.offsetWidth + 2}px`;
    };

    updatePadding();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updatePadding)
      : null;

    if (buttonRef.current && resizeObserver) {
      resizeObserver.observe(buttonRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      input.style.removeProperty('padding-right');
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <button
      ref={buttonRef}
      id="ytqf-save-from-search"
      type="button"
      className="ytqf-save-from-search"
      title="Save current search as a quick filter"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSave();
      }}
    >
      Save filter
    </button>
  );
};
