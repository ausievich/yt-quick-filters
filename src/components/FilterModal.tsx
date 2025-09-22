import React, { useState, useEffect } from 'react';
import { ModalProps } from '../types';
import './FilterModal.css';

export const FilterModal: React.FC<ModalProps> = ({
  isOpen,
  isEdit,
  initialName = '',
  initialQuery = '',
  initialShowInToolbar = false,
  index,
  onClose,
  onSave,
  onPreview,
  onDelete,
  onDuplicate
}) => {
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState(initialQuery);
  const [showInToolbar, setShowInToolbar] = useState(initialShowInToolbar);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setQuery(initialQuery);
      setShowInToolbar(initialShowInToolbar);
    }
  }, [isOpen, isEdit, initialName, initialQuery, initialShowInToolbar]);

  useEffect(() => {
    setIsValid(name.trim() !== '' && query.trim() !== '');
  }, [name, query]);

  // Preview changes when showInToolbar changes (only for edit mode)
  useEffect(() => {
    if (isValid && isEdit) {
      handlePreview();
    }
  }, [showInToolbar, isEdit]);

  // Global keyboard handler for ESC key
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleGlobalKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    if (isValid) {
      onSave(name.trim(), query.trim(), showInToolbar, index);
    }
  };

  const handlePreview = () => {
    if (onPreview && name.trim() && query.trim()) {
      onPreview(name.trim(), query.trim(), showInToolbar, index);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleSave();
    }
  };

  const handleDelete = () => {
    if (onDelete && typeof index === 'number') {
      onDelete(index);
      onClose();
    }
  };

  const handleDuplicate = () => {
    if (onDuplicate && typeof index === 'number') {
      onDuplicate(index);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div id="ytqf-modal-backdrop" onClick={onClose} />
      <div id="ytqf-modal">
        <div className="card">
          <div className="hdr">
            {isEdit ? 'Edit quick filter' : 'Create quick filter'}
          </div>
          
          <div className="body">
            <label>Name</label>
            <input
              id="ytqf-name"
              type="text"
              placeholder="My tasks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className={name.trim() === '' ? 'error' : ''}
            />
            
            <label>Query</label>
            <input
              id="ytqf-query"
              type="text"
              placeholder="Assignee: me"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className={query.trim() === '' ? 'error' : ''}
            />
            
            <div className="checkbox-container">
              <input
                id="ytqf-show-in-toolbar"
                type="checkbox"
                checked={showInToolbar}
                onChange={(e) => setShowInToolbar(e.target.checked)}
              />
              <label htmlFor="ytqf-show-in-toolbar">Show in toolbar</label>
            </div>
          </div>
          
          <div className="f">
            <div className="f-left">
              <button 
                className="primary" 
                id="ytqf-save" 
                onClick={handleSave}
                disabled={!isValid}
              >
                {isEdit ? 'Save' : 'Create'}
              </button>
              <button id="ytqf-cancel" onClick={onClose}>
                Cancel
              </button>
            </div>
            {isEdit && onDelete && onDuplicate && typeof index === 'number' && (
              <div className="f-right">
                <button 
                  className="duplicate-btn" 
                  onClick={handleDuplicate}
                >
                  Duplicate
                </button>
                <button 
                  className="delete-btn" 
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
