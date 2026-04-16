import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionSettingsForm } from './ExtensionSettingsForm';

const container = document.getElementById('popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<ExtensionSettingsForm />);
}
