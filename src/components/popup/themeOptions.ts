import { ColorTheme } from '../../types';

export type ColorThemeOption = {
  value: ColorTheme;
  label: string;
};

// Four themes per row to match the palette grid: light families first, then dark.
export const COLOR_THEMES: ColorThemeOption[] = [
  // Default and violets
  { value: 'ring', label: 'YouTrack' },
  { value: 'violet-classic', label: 'Violet Classic' },
  { value: 'violet', label: 'Violet' },
  { value: 'indigo', label: 'Indigo' },
  // Cool blues
  { value: 'arctic', label: 'Arctic' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'harbor', label: 'Harbor' },
  { value: 'slate', label: 'Slate' },
  // Greens
  { value: 'mint', label: 'Mint' },
  { value: 'forest', label: 'Forest' },
  { value: 'teal-peach', label: 'Teal Peach' },
  { value: 'mint-cream', label: 'Mint Cream' },
  // Warm
  { value: 'amber', label: 'Amber' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'terracotta', label: 'Terracotta' },
  { value: 'cocoa', label: 'Cocoa' },
  // Pinks and paper
  { value: 'rose', label: 'Rose' },
  { value: 'raspberry', label: 'Raspberry' },
  { value: 'paper', label: 'Paper' },
  { value: 'latte', label: 'Latte' },
  // Dark warm
  { value: 'graphite', label: 'Graphite' },
  { value: 'gruvbox-dark', label: 'Gruvbox Dark' },
  { value: 'midnight-ember', label: 'Midnight Ember' },
  { value: 'dracula', label: 'Dracula' },
  // Dark cool
  { value: 'tokyo-night', label: 'Tokyo Night' },
  { value: 'nord', label: 'Nord' },
  { value: 'deep-sea', label: 'Deep Sea' },
  { value: 'pine', label: 'Pine' },
];
