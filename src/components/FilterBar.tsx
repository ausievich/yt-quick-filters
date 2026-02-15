import React from 'react';
import { FilterBarProps } from '../types';
import { DaysInStatusButton } from './DaysInStatusButton';
import './FilterBar.css';

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  activeFilter,
  onFilterClick,
  onAddFilter,
  onContextMenu
}) => {
  return (
    <div id="ytqf-bar">
      <DaysInStatusButton />
      
      <button className="btn ghost" onClick={onAddFilter}>
        Add filter...
      </button>

      {filters.map((filter, index) => (
        <button
          key={index}
          className={`btn ${activeFilter === filter ? 'active' : ''}`}
          title={filter.query}
          onClick={() => onFilterClick(filter.query)}
          onContextMenu={(e) => onContextMenu(e, filter, index)}
        >
          <span className="lbl">{filter.label}</span>
        </button>
      ))}
    </div>
  );
};
