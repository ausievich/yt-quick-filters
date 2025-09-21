import React, { useState, useEffect, useCallback } from 'react';
import { Filter } from '../types';
import { StorageService } from '../services/storage';
import { UtilsService } from '../services/utils';
import { FilterDropdown } from './FilterDropdown';
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
  const [currentQuery, setCurrentQuery] = useState('');
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

  const loadFilters = useCallback(async () => {
    try {
      const loadedFilters = await storageService.getFilters();
      setFilters(loadedFilters);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, [storageService]);

  const updateCurrentQuery = useCallback(() => {
    setCurrentQuery(utilsService.getCurrentQuery());
  }, [utilsService]);

  useEffect(() => {
    loadFilters();
    updateCurrentQuery();
  }, [loadFilters, updateCurrentQuery]);

  const handleFilterClick = useCallback((query: string) => {
    utilsService.setQuery(query);
    updateCurrentQuery();
  }, [utilsService, updateCurrentQuery]);

  const handleClearFilter = useCallback(() => {
    utilsService.setQuery('');
    updateCurrentQuery();
  }, [utilsService, updateCurrentQuery]);

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
      isEdit: false,
      index: undefined
    });
  }, []);

  const handleModalSave = useCallback(async (name: string, query: string, index?: number) => {
    try {
      if (modal.isEdit && typeof modal.index === 'number') {
        await storageService.updateFilter(modal.index, { label: name, query });
      } else {
        await storageService.addFilter({ label: name, query });
      }
      await loadFilters();
      handleModalClose();
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  }, [modal.isEdit, modal.index, storageService, loadFilters, handleModalClose]);

  return (
    <>
      <FilterDropdown
        filters={filters}
        currentQuery={currentQuery}
        onFilterClick={handleFilterClick}
        onAddFilter={handleAddFilter}
        onClearFilter={handleClearFilter}
        onContextMenu={handleContextMenu}
        onEditFilter={handleEditFilter}
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
