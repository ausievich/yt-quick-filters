// Type definitions for YT Quick Filters

export interface Filter {
  label: string;
  query: string;
  showInToolbar?: boolean;
}

export interface StorageData {
  [key: string]: Filter[];
}

export interface BoardInfo {
  id: string;
  storageKey: string;
}


export interface ModalProps {
  isOpen: boolean;
  isEdit: boolean;
  initialName?: string;
  initialQuery?: string;
  initialShowInToolbar?: boolean;
  index?: number;
  onClose: () => void;
  onSave: (name: string, query: string, showInToolbar: boolean, index?: number) => void;
  onPreview?: (name: string, query: string, showInToolbar: boolean, index?: number) => void;
  onDelete?: (index: number) => void;
  onDuplicate?: (index: number) => void;
}

export interface FilterBarProps {
  filters: Filter[];
  currentQuery: string;
  onFilterClick: (query: string, source: 'dropdown' | 'toolbar') => void;
}

export interface FilterDropdownProps {
  filters: Filter[];
  currentQuery: string;
  onFilterClick: (query: string, source: 'dropdown' | 'toolbar') => void;
  onAddFilter: () => void;
  onClearFilter: () => void;
  onEditFilter: (item: Filter, index: number) => void;
}
