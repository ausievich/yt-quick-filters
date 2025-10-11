import React, { useState, useEffect, useCallback } from 'react';
import { Filter } from '../types';
import { StorageService } from '../services/storage';
import { UtilsService } from '../services/utils';
import { useQueryParams } from '../hooks/useQueryParams';
import { FilterBar } from './FilterBar';
import { FilterModal } from './FilterModal';
import { ContextMenu } from './ContextMenu';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  item: Filter | null;
  index: number;
}

interface ModalState {
  isOpen: boolean;
  isEdit: boolean;
  initialName?: string;
  initialQuery?: string;
  index?: number;
}

export const QuickFiltersApp: React.FC = () => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
    index: -1
  });
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    isEdit: false
  });

  const storageService = StorageService.getInstance();
  const utilsService = UtilsService.getInstance();
  
  // Use custom hook for working with query parameters
  const { getParam } = useQueryParams();
  const currentQuery = getParam('query') || '';

  // Use custom hook for working with query parameters
  const { getParam } = useQueryParams();
  const currentQuery = getParam('query') || '';

  const loadFilters = useCallback(async () => {
    try {
      const loadedFilters = await storageService.getFilters();
      setFilters(loadedFilters);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, [storageService]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const handleFilterClick = useCallback((query: string) => {
    // If clicked on already active filter, deactivate it (toggle)
    if (utilsService.normalizeQuery(currentQuery) === utilsService.normalizeQuery(query)) {
      utilsService.setQuery('');
    } else {
      utilsService.setQuery(query);
    }
  }, [utilsService, currentQuery]);

  const handleAddFilter = useCallback(() => {
    setModal({
      isOpen: true,
      isEdit: false
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: Filter, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      item,
      index
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      item: null,
      index: -1
    });
  }, []);

  const handleEditFilter = useCallback((item: Filter, index: number) => {
    closeContextMenu();
    setModal({
      isOpen: true,
      isEdit: true,
      initialName: item.label,
      initialQuery: item.query,
      index
    });
  }, [closeContextMenu]);

  const handleDuplicateFilter = useCallback(async (item: Filter, index: number) => {
    closeContextMenu();
    try {
      await storageService.duplicateFilter(index);
      await loadFilters();
    } catch (error) {
      console.error('Failed to duplicate filter:', error);
    }
  }, [closeContextMenu, storageService, loadFilters]);

  const handleDeleteFilter = useCallback(async (index: number) => {
    closeContextMenu();
    try {
      await storageService.deleteFilter(index);
      await loadFilters();
    } catch (error) {
      console.error('Failed to delete filter:', error);
    }
  }, [closeContextMenu, storageService, loadFilters]);

  const handleModalClose = useCallback(() => {
    setModal({
      isOpen: false,
      isEdit: false
    });
  }, []);

  const handleModalSave = useCallback(async (name: string, query: string, index?: number) => {
    try {
      if (modal.isEdit && typeof index === 'number') {
        await storageService.updateFilter(index, { label: name, query });
      } else {
        await storageService.addFilter({ label: name, query });
      }
      await loadFilters();
      handleModalClose();
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  }, [modal.isEdit, storageService, loadFilters, handleModalClose]);

  // Determine active filter based on current query
  const activeFilter = utilsService.findActiveFilter(filters, currentQuery);

  return (
    <>
      <FilterBar
        filters={filters}
        activeFilter={activeFilter}
        onFilterClick={handleFilterClick}
        onAddFilter={handleAddFilter}
        onContextMenu={handleContextMenu}
      />
      
      {contextMenu.isOpen && contextMenu.item && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          index={contextMenu.index}
          onEdit={handleEditFilter}
          onDuplicate={handleDuplicateFilter}
          onDelete={handleDeleteFilter}
          onClose={closeContextMenu}
        />
      )}
      
      <FilterModal
        isOpen={modal.isOpen}
        isEdit={modal.isEdit}
        initialName={modal.initialName}
        initialQuery={modal.initialQuery}
        index={modal.index}
        onClose={handleModalClose}
        onSave={handleModalSave}
      />
    </>
  );
};
