import React, { useEffect, useRef } from 'react';
import { ContextMenuProps } from '../types';
import './ContextMenu.css';

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  item,
  index,
  onEdit,
  onDuplicate,
  onDelete,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onClose();
    };

    const handleBlur = () => {
      onClose();
    };

    const handleScroll = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const w = menu.offsetWidth;
      const h = menu.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      menu.style.left = Math.min(x, vw - w - 8) + 'px';
      menu.style.top = Math.min(y, vh - h - 8) + 'px';
    }
  }, [x, y]);

  return (
    <div ref={menuRef} id="ytqf-menu">
      <div 
        className="mi" 
        onClick={(e) => {
          e.stopPropagation();
          onEdit(item, index);
        }}
      >
        Edit
      </div>
      
      <div 
        className="mi" 
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(item, index);
        }}
      >
        Duplicate
      </div>
      
      <div className="sep"></div>
      
      <div 
        className="mi danger" 
        onClick={(e) => {
          e.stopPropagation();
          onDelete(index);
        }}
      >
        Delete
      </div>
    </div>
  );
};
