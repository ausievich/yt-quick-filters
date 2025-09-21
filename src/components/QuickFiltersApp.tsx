import React, { useState, useEffect, useCallback } from 'react';
import { Filter } from '../types';
import { StorageService } from '../services/storage';
import { UtilsService } from '../services/utils';
import { FilterDropdown } from './FilterDropdown';
import { FilterBar } from './FilterBar';
import { FilterModal } from './FilterModal';

interface ModalState {
  isOpen: boolean;
  isEdit: boolean;
  initialName?: string;
  initialQuery?: string;
  initialShowInToolbar?: boolean;
  index?: number;
}

export const QuickFiltersApp: React.FC = () => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'dropdown' | 'toolbar' | null>(null);
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    isEdit: false
  });

  const storageService = StorageService.getInstance();
  const utilsService = UtilsService.getInstance();

  const loadFilters = useCallback(async () => {
    try {
      const loadedFilters = await storageService.getFilters();
      setFilters(loadedFilters);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, [storageService]);

  const updateCurrentQuery = useCallback(() => {
    const query = utilsService.getCurrentQuery();
    setCurrentQuery(query);
    
    // Determine filter source based on current query and available filters
    if (query) {
      const toolbarFilters = filters.filter(filter => filter.showInToolbar);
      const isInToolbar = toolbarFilters.some(filter => filter.query === query);
      setFilterSource(isInToolbar ? 'toolbar' : 'dropdown');
    } else {
      setFilterSource(null);
    }
  }, [utilsService, filters]);

  useEffect(() => {
    loadFilters();
    updateCurrentQuery();
  }, [loadFilters, updateCurrentQuery]);

  // Update filter source when filters change
  useEffect(() => {
    updateCurrentQuery();
  }, [filters, updateCurrentQuery]);

  const handleFilterClick = useCallback((query: string, source: 'dropdown' | 'toolbar') => {
    utilsService.setQuery(query);
    setFilterSource(source);
    updateCurrentQuery();
  }, [utilsService, updateCurrentQuery]);

  const handleClearFilter = useCallback(() => {
    utilsService.setQuery('');
    setFilterSource(null);
    updateCurrentQuery();
  }, [utilsService, updateCurrentQuery]);

  const handleAddFilter = useCallback(() => {
    setModal({
      isOpen: true,
      isEdit: false
    });
  }, []);

  const handleEditFilter = useCallback((item: Filter, index: number) => {
    setModal({
      isOpen: true,
      isEdit: true,
      initialName: item.label,
      initialQuery: item.query,
      initialShowInToolbar: item.showInToolbar || false,
      index
    });
  }, []);

  const handleDuplicateFilter = useCallback(async (item: Filter, index: number) => {
    try {
      await storageService.duplicateFilter(index);
      await loadFilters();
    } catch (error) {
      console.error('Failed to duplicate filter:', error);
    }
  }, [storageService, loadFilters]);

  const handleDeleteFilter = useCallback(async (index: number) => {
    try {
      await storageService.deleteFilter(index);
      await loadFilters();
    } catch (error) {
      console.error('Failed to delete filter:', error);
    }
  }, [storageService, loadFilters]);

  const handleModalClose = useCallback(() => {
    setModal({
      isOpen: false,
      isEdit: false,
      index: undefined
    });
  }, []);

  const handleModalSave = useCallback(async (name: string, query: string, showInToolbar: boolean, index?: number) => {
    try {
      if (modal.isEdit && typeof modal.index === 'number') {
        await storageService.updateFilter(modal.index, { label: name, query, showInToolbar });
      } else {
        await storageService.addFilter({ label: name, query, showInToolbar });
      }
      await loadFilters();
      handleModalClose();
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  }, [modal.isEdit, modal.index, storageService, loadFilters, handleModalClose]);

  // Separate filters for toolbar and dropdown
  const toolbarFilters = filters.filter(filter => filter.showInToolbar);
  const dropdownFilters = filters; // All filters are shown in dropdown

  return (
    <>
      {/* FilterDropdown always first (leftmost) */}
      <FilterDropdown
        filters={dropdownFilters}
        currentQuery={currentQuery}
        onFilterClick={handleFilterClick}
        onAddFilter={handleAddFilter}
        onClearFilter={handleClearFilter}
        onEditFilter={handleEditFilter}
        filterSource={filterSource}
      />
      
      {/* Show FilterBar after FilterDropdown if there are filters with showInToolbar: true */}
      {toolbarFilters.length > 0 && (
        <FilterBar
          filters={toolbarFilters}
          currentQuery={currentQuery}
          onFilterClick={handleFilterClick}
          onAddFilter={handleAddFilter}
          onClearFilter={handleClearFilter}
        />
      )}
      
      <FilterModal
        isOpen={modal.isOpen}
        isEdit={modal.isEdit}
        initialName={modal.initialName}
        initialQuery={modal.initialQuery}
        initialShowInToolbar={modal.initialShowInToolbar}
        index={modal.index}
        onClose={handleModalClose}
        onSave={handleModalSave}
        onDelete={handleDeleteFilter}
        onDuplicate={(index) => {
          if (typeof modal.index === 'number') {
            const filter = filters[modal.index];
            if (filter) {
              handleDuplicateFilter(filter, modal.index);
            }
          }
        }}
      />
    </>
  );
};
