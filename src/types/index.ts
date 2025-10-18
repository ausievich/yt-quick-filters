// Type definitions for YT Quick Filters

export interface Filter {
  label: string;
  query: string;
}

export interface StorageData {
  [key: string]: Filter[];
}

export interface BoardInfo {
  id: string;
  storageKey: string;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  item: Filter;
  index: number;
  onEdit: (item: Filter, index: number) => void;
  onDuplicate: (item: Filter, index: number) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}

export interface ModalProps {
  isOpen: boolean;
  isEdit: boolean;
  initialName?: string;
  initialQuery?: string;
  index?: number;
  onClose: () => void;
  onSave: (name: string, query: string, index?: number) => void;
}

export interface FilterBarProps {
  filters: Filter[];
  activeFilter: Filter | null;
  onFilterClick: (query: string) => void;
  onAddFilter: () => void;
  onContextMenu: (e: React.MouseEvent, item: Filter, index: number) => void;
}

export interface IssueInfo {
  id: string;
  idReadable: string;
  summary: string;
  created: number;
  updated: number;
  resolved?: number;
  state?: {
    name: string;
    id: string;
  };
  project: {
    name: string;
    id: string;
  };
}

export interface IssueHistoryItem {
  id: string;
  timestamp: number;
  field: {
    name: string;
    id: string;
  };
  removed?: any;
  added?: any;
}

export interface DaysInStatusInfo {
  issueId: string;
  daysInCurrentStatus: number;
  statusName: string;
  lastStatusChange: number;
  created: number;
  updated: number;
}

export interface DaysInStatusProps {
  issueId: string;
  onDataLoaded?: (data: DaysInStatusInfo) => void;
}
