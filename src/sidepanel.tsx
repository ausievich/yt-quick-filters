import React from 'react';
import { createRoot } from 'react-dom/client';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import './styles.css';

const rootEl = document.getElementById('sidepanel-root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<AIAssistantPanel />);
}
