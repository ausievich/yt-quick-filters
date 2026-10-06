import React from 'react';
import { FilterBarProps } from '../types';
import { useDragReorder } from '../hooks/useDragReorder';
import { DaysInStatusButton } from './DaysInStatusButton';
import './FilterBar.css';

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  activeFilter,
  onFilterClick,
  onAddFilter,
  onContextMenu,
  onReorder,
}) => {
  const { containerRef, isDragging, getItemProps } = useDragReorder(filters.length, onReorder);

  // Stable keys keep each button's DOM node alive across a reorder.
  const occurrences = new Map<string, number>();

  return (
    <div id="ytqf-bar" ref={containerRef} className={isDragging ? 'is-dragging' : undefined}>
      <DaysInStatusButton />

      <button className="btn ghost" onClick={onAddFilter}>
        Add filter...
      </button>

      {filters.map((filter, index) => {
        const fingerprint = JSON.stringify([filter.label, filter.query]);
        const occurrence = occurrences.get(fingerprint) ?? 0;
        occurrences.set(fingerprint, occurrence + 1);

        const { className, ...dragProps } = getItemProps(index);

        return (
          <button
            key={`${fingerprint}:${occurrence}`}
            className={`btn ytqf-filter ${activeFilter === filter ? 'active' : ''} ${className}`}
            title={filter.query}
            onClick={() => onFilterClick(filter.query)}
            onContextMenu={(e) => onContextMenu(e, filter, index)}
            {...dragProps}
          >
            <span className="lbl">{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
};
