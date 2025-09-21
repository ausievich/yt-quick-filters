import React, { useState, useRef, useEffect } from 'react';
import { Filter } from '../types';
import './FilterDropdown.css';

interface FilterDropdownProps {
  filters: Filter[];
  currentQuery: string;
  onFilterClick: (query: string) => void;
  onAddFilter: () => void;
  onClearFilter: () => void;
  onContextMenu: (e: React.MouseEvent, item: Filter, index: number) => void;
  onEditFilter: (item: Filter, index: number) => void;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  filters,
  currentQuery,
  onFilterClick,
  onAddFilter,
  onClearFilter,
  onContextMenu,
  onEditFilter
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find current filter
  const currentFilter = filters.find(filter => filter.query === currentQuery);
  const displayText = currentFilter ? currentFilter.label : 'Board filters';

  // Filter filters based on search query
  const filteredFilters = filters.filter(filter =>
    filter.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    filter.query.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        const totalItems = filteredFilters.length + 1; // +1 for Clear option
        setSelectedIndex(prev => 
          prev < totalItems - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        const totalItemsUp = filteredFilters.length + 1; // +1 for Clear option
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : totalItemsUp - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredFilters.length) {
          onFilterClick(filteredFilters[selectedIndex].query);
          setIsOpen(false);
          setSearchQuery('');
          setSelectedIndex(-1);
        } else if (selectedIndex === filteredFilters.length) {
          // Clear option selected
          onClearFilter();
          setIsOpen(false);
          setSearchQuery('');
          setSelectedIndex(-1);
        }
        break;
    }
  };

  const handleFilterSelect = (filter: Filter) => {
    onFilterClick(filter.query);
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
  };

  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClearFilter();
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
  };

  const handleNewFilterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddFilter();
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
  };

  const handleContextMenuClick = (e: React.MouseEvent, filter: Filter, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, filter, index);
  };

  const handleEditClick = (e: React.MouseEvent, filter: Filter, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    onEditFilter(filter, index);
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
  };

  return (
    <div className="filter-dropdown" ref={dropdownRef}>
      <button
        className={`filter-dropdown__button ${isOpen ? 'filter-dropdown__button--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="filter-dropdown__button-content">
          <span className="filter-dropdown__button-text">{displayText}</span>
          <svg className="filter-dropdown__icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path fillRule="evenodd" d="M9.067 4.246a.625.625 0 0 0-.884 0L6 6.429 3.817 4.246a.625.625 0 1 0-.884.883l2.625 2.625c.244.245.64.245.884 0L9.067 5.13a.625.625 0 0 0 0-.883Z" clipRule="evenodd"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="filter-dropdown__popup">
          <div className="filter-dropdown__search">
            <div className="filter-dropdown__search-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M11.504 6.877a4.627 4.627 0 1 1-9.254 0 4.627 4.627 0 0 1 9.254 0Zm-.937 4.575a5.877 5.877 0 1 1 .884-.884l3.361 3.36a.625.625 0 1 1-.884.884l-3.361-3.36Z" clipRule="evenodd"/>
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="filter-dropdown__search-input"
              placeholder="Filter items"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {searchQuery && (
              <button
                className="filter-dropdown__search-clear"
                onClick={() => setSearchQuery('')}
                type="button"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path fillRule="evenodd" d="M9.918 2.065a.6.6 0 0 1 .002.849L6.849 5.998 9.924 9.07l-.424.425-.424.424-3.074-3.072-3.07 3.083a.6.6 0 1 1-.85-.847L5.153 6 2.08 2.928a.6.6 0 1 1 .849-.849L6 5.15l3.07-3.082a.6.6 0 0 1 .848-.002ZM9.5 9.495l-.424.425a.6.6 0 1 0 .848-.849l-.424.425Z" clipRule="evenodd"/>
                </svg>
              </button>
            )}
          </div>

          <div className="filter-dropdown__list" role="listbox">
            {filteredFilters.length > 0 ? (
              <>
                {filteredFilters.map((filter, index) => {
                  // Find the original index by matching both query and label to ensure uniqueness
                  const originalIndex = filters.findIndex(f => f.query === filter.query && f.label === filter.label);
                  const isCurrent = filter.query === currentQuery;
                  const isSelected = selectedIndex === index;
                  
                  return (
                    <div
                      key={originalIndex}
                      className={`filter-dropdown__item ${isCurrent ? 'filter-dropdown__item--current' : ''} ${isSelected ? 'filter-dropdown__item--selected' : ''}`}
                      role="option"
                      aria-selected={isCurrent}
                      onClick={() => handleFilterSelect(filter)}
                      onContextMenu={(e) => handleContextMenuClick(e, filter, originalIndex)}
                    >
                      <div className="filter-dropdown__item-content">
                        <span className="filter-dropdown__item-label" title={filter.query}>
                          {filter.label}
                        </span>
                        <button
                          className="filter-dropdown__item-edit"
                          onClick={(e) => handleEditClick(e, filter, originalIndex)}
                          title="Edit filter"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" d="M10.07 1.552a1.786 1.786 0 0 1 2.533-.004l.012.012 1.848 1.964a1.77 1.77 0 0 1-.018 2.51l-2.312 2.315-6.482 6.47a.625.625 0 0 1-.442.182H1.623a.625.625 0 0 1-.625-.625v-3.52c0-.165.066-.325.184-.442l6.515-6.503 2.373-2.36Zm1.648.88a.536.536 0 0 0-.758-.002l-.006.006-1.93 1.919 2.667 2.667 1.878-1.88a.52.52 0 0 0 0-.745l-.006-.006-1.845-1.96Zm-.911 5.474-2.67-2.67-5.889 5.88v2.635h2.703l5.856-5.845Z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {/* Clear option */}
                <div
                  className={`filter-dropdown__item ${selectedIndex === filteredFilters.length ? 'filter-dropdown__item--selected' : ''}`}
                  role="option"
                  aria-selected={false}
                  onClick={handleClearClick}
                >
                  <div className="filter-dropdown__item-content">
                    <span className="filter-dropdown__item-label">Clear</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="filter-dropdown__item filter-dropdown__item--empty">
                <span className="filter-dropdown__item-label">No filters found</span>
              </div>
            )}
          </div>

          <div className="filter-dropdown__toolbar">
            <button
              className="filter-dropdown__toolbar-button"
              onClick={handleNewFilterClick}
              type="button"
            >
              New filter...
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
