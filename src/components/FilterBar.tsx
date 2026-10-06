import React, { useState } from 'react';
import { FilterBarProps } from '../types';
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div id="ytqf-bar">
      <DaysInStatusButton />

      <button className="btn ghost" onClick={onAddFilter}>
        Add filter...
      </button>

      {filters.map((filter, index) => (
        <button
          key={index}
          className={`btn ${activeFilter === filter ? 'active' : ''} ${dragIndex === index ? 'dragging' : ''}`}
          title={filter.query}
          draggable
          onClick={() => onFilterClick(filter.query)}
          onContextMenu={(e) => onContextMenu(e, filter, index)}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', ''); // Required by Firefox to start dragging
            setDragIndex(index);
          }}
          onDragOver={(e) => dragIndex !== null && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
          }}
          onDragEnd={() => setDragIndex(null)}
        >
          <span className="lbl">{filter.label}</span>
        </button>
      ))}
    </div>
  );
};
