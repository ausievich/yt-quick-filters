import React from 'react';
import { FilterBarProps } from '../types';
import './FilterBar.css';

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  currentQuery,
  onFilterClick,
  onAddFilter,
  onContextMenu
}) => {
  return (
    <>
      {filters.map((filter, index) => (
        <button
          key={index}
          className={`btn ${currentQuery === filter.query ? 'active' : ''}`}
          title={filter.query}
          onClick={() => onFilterClick(filter.query)}
          onContextMenu={(e) => onContextMenu(e, filter, index)}
        >
          <span className="lbl">{filter.label}</span>
        </button>
      ))}
      
      
      <button className="btn ghost" onClick={onAddFilter}>
        Add filter...
      </button>
    </>
  );
};
