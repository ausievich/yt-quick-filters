import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Filter } from '../types';
import {
  StorageService,
  ALLOW_MULTIPLE_FILTERS_KEY,
  DEFAULT_ALLOW_MULTIPLE_FILTERS,
} from '../services/storage';
import { UtilsService } from '../services/utils';
import { YouTrackVersionService } from '../services/youTrackVersion';
import { useQueryParams } from '../hooks/useQueryParams';
import { FilterBar } from './FilterBar';
import { FilterModal } from './FilterModal';
import { ContextMenu } from './ContextMenu';
import { DaysInStatusUI } from '../services/daysInStatusUI';
import { trackEvent } from '../services/analytics';
import {
  getActiveFilterIndices,
  normalizeQuery,
  toggleFilterInQuery,
} from '../services/queryComposer';

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

const reorderFilters = (filters: Filter[], from: number, to: number): Filter[] => {
  if (from < 0 || from >= filters.length || to < 0 || to >= filters.length) {
    return filters;
  }

  const reorderedFilters = [...filters];
  const [movedFilter] = reorderedFilters.splice(from, 1);
  reorderedFilters.splice(to, 0, movedFilter);
  return reorderedFilters;
};

export const QuickFiltersApp: React.FC = () => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [optimisticQuery, setOptimisticQuery] = useState<string | null>(null);
  const [allowMultipleFilters, setAllowMultipleFilters] = useState<boolean>(
    DEFAULT_ALLOW_MULTIPLE_FILTERS,
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
    index: -1,
  });
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    isEdit: false,
  });

  const storageService = StorageService.getInstance();
  const utilsService = UtilsService.getInstance();
  const versionService = YouTrackVersionService.getInstance();
  const daysInStatusUI = DaysInStatusUI.getInstance();

  // State to hold the DOM node for the portal
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  // Use custom hook for working with query parameters
  const { query: currentQuery, pathname } = useQueryParams();

  const loadFilters = useCallback(async () => {
    try {
      const loadedFilters = await storageService.getFilters();
      setFilters(loadedFilters);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, [storageService]);

  // Effect to find the target elements for the portals
  useEffect(() => {
    const findTargetElements = () => {
      const filterTarget = versionService.getTargetElement();
      return { filterTarget };
    };

    // Try immediately first
    const { filterTarget } = findTargetElements();
    if (filterTarget) {
      setPortalTarget(filterTarget);
    }

    // Keep observing DOM changes to reattach after SPA navigation
    const observer = new MutationObserver(() => {
      const { filterTarget } = findTargetElements();
      if (filterTarget) {
        setPortalTarget(filterTarget);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [versionService]);

  // Reload filters when pathname changes (board change)
  useEffect(() => {
    loadFilters();
  }, [pathname, loadFilters]);

  useEffect(() => {
    setOptimisticQuery(null);
  }, [currentQuery]);

  // Follow the setting, including changes made from the popup while the board is open.
  useEffect(() => {
    void storageService.getAllowMultipleFilters().then(setAllowMultipleFilters);

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      const change = changes[ALLOW_MULTIPLE_FILTERS_KEY];
      if (areaName === 'sync' && change) {
        setAllowMultipleFilters(change.newValue ?? DEFAULT_ALLOW_MULTIPLE_FILTERS);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [storageService]);

  // Initialize DaysInStatusUI
  useEffect(() => {
    const initDaysInStatus = async () => {
      await daysInStatusUI.start();
    };

    initDaysInStatus();

    return () => {
      daysInStatusUI.stop();
    };
  }, [daysInStatusUI]);

  const effectiveQuery = optimisticQuery ?? currentQuery;

  const handleFilterClick = useCallback(
    (query: string) => {
      let nextQuery = query;
      if (allowMultipleFilters) {
        nextQuery = toggleFilterInQuery(effectiveQuery, query);
      } else if (normalizeQuery(effectiveQuery) === normalizeQuery(query)) {
        nextQuery = '';
      }

      trackEvent('filter_toggled');

      setOptimisticQuery(nextQuery);
      void utilsService.setQuery(nextQuery);
    },
    [utilsService, effectiveQuery, allowMultipleFilters],
  );

  const handleAddFilter = useCallback(() => {
    setModal({
      isOpen: true,
      isEdit: false,
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
      index,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      item: null,
      index: -1,
    });
  }, []);

  const handleEditFilter = useCallback(
    (item: Filter, index: number) => {
      closeContextMenu();
      setModal({
        isOpen: true,
        isEdit: true,
        initialName: item.label,
        initialQuery: item.query,
        index,
      });
    },
    [closeContextMenu],
  );

  const handleDuplicateFilter = useCallback(
    async (item: Filter, index: number) => {
      closeContextMenu();
      try {
        await storageService.duplicateFilter(index);
        trackEvent('filter_duplicated', { board_filter_count: filters.length + 1 });
        await loadFilters();
      } catch (error) {
        console.error('Failed to duplicate filter:', error);
      }
    },
    [closeContextMenu, storageService, loadFilters, filters.length],
  );

  const handleDeleteFilter = useCallback(
    async (index: number) => {
      closeContextMenu();
      try {
        await storageService.deleteFilter(index);
        trackEvent('filter_deleted', { board_filter_count: Math.max(filters.length - 1, 0) });
        await loadFilters();
      } catch (error) {
        console.error('Failed to delete filter:', error);
      }
    },
    [closeContextMenu, storageService, loadFilters, filters.length],
  );

  const handleReorderFilter = useCallback(
    async (from: number, to: number) => {
      setFilters((currentFilters) => reorderFilters(currentFilters, from, to));

      try {
        await storageService.moveFilter(from, to);
        trackEvent('filters_reordered');
      } catch (error) {
        console.error('Failed to reorder filter:', error);
        await loadFilters();
      }
    },
    [storageService, loadFilters],
  );

  const handleModalClose = useCallback(() => {
    setModal({
      isOpen: false,
      isEdit: false,
    });
  }, []);

  const handleModalSave = useCallback(
    async (name: string, query: string, index?: number) => {
      try {
        if (modal.isEdit && typeof index === 'number') {
          await storageService.updateFilter(index, { label: name, query });
          trackEvent('filter_edited');
        } else {
          await storageService.addFilter({ label: name, query });
          trackEvent('filter_created', { board_filter_count: filters.length + 1 });
        }
        await loadFilters();
        handleModalClose();
      } catch (error) {
        console.error('Failed to save filter:', error);
      }
    },
    [modal.isEdit, storageService, loadFilters, handleModalClose, filters.length],
  );

  // With the setting off, preserve the original one-active-filter behaviour.
  const singleActiveFilterIndex = filters.findIndex(
    (filter) => normalizeQuery(filter.query) === normalizeQuery(effectiveQuery),
  );
  const activeFilterIndices = allowMultipleFilters
    ? getActiveFilterIndices(filters, effectiveQuery)
    : new Set(singleActiveFilterIndex >= 0 ? [singleActiveFilterIndex] : []);

  return (
    <>
      {/* Render FilterBar */}
      {portalTarget ? (
        ReactDOM.createPortal(
          <FilterBar
            filters={filters}
            activeFilterIndices={activeFilterIndices}
            onFilterClick={handleFilterClick}
            onAddFilter={handleAddFilter}
            onContextMenu={handleContextMenu}
            onReorder={handleReorderFilter}
          />,
          portalTarget,
        )
      ) : (
        <FilterBar
          filters={filters}
          activeFilterIndices={activeFilterIndices}
          onFilterClick={handleFilterClick}
          onAddFilter={handleAddFilter}
          onContextMenu={handleContextMenu}
          onReorder={handleReorderFilter}
        />
      )}

      {/* Render context menu and modal in document.body for proper layering */}
      {contextMenu.isOpen &&
        contextMenu.item &&
        ReactDOM.createPortal(
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            item={contextMenu.item}
            index={contextMenu.index}
            onEdit={handleEditFilter}
            onDuplicate={handleDuplicateFilter}
            onDelete={handleDeleteFilter}
            onClose={closeContextMenu}
          />,
          document.body,
        )}

      {modal.isOpen &&
        ReactDOM.createPortal(
          <FilterModal
            isOpen={modal.isOpen}
            isEdit={modal.isEdit}
            initialName={modal.initialName}
            initialQuery={modal.initialQuery}
            index={modal.index}
            onClose={handleModalClose}
            onSave={handleModalSave}
          />,
          document.body,
        )}
    </>
  );
};
