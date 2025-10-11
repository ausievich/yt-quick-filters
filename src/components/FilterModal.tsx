import React, { useState, useEffect, useRef } from 'react';
import { ModalProps } from '../types';
import './FilterModal.css';

export const FilterModal: React.FC<ModalProps> = ({
  isOpen,
  isEdit,
  initialName = '',
  initialQuery = '',
  index,
  onClose,
  onSave
}) => {
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState(initialQuery);
  const [isValid, setIsValid] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setQuery(initialQuery);
      // Focus on name input when modal opens
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, isEdit, initialName, initialQuery]);

  useEffect(() => {
    setIsValid(name.trim() !== '' && query.trim() !== '');
  }, [name, query]);

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
      onSave(name.trim(), query.trim(), index);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleSave();
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
              ref={nameInputRef}
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
          </div>
          
          <div className="f">
            <button id="ytqf-cancel" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="primary" 
              id="ytqf-save" 
              onClick={handleSave}
              disabled={!isValid}
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
