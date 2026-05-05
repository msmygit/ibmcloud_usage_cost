import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * ThemeToggle component that provides a button to switch between light and dark themes
 * 
 * Features:
 * - Displays Sun icon in dark mode, Moon icon in light mode
 * - Smooth transitions and hover effects
 * - Visual feedback on click with scale animation
 * - Theme-aware styling using Tailwind classes
 * - Fully accessible with ARIA labels
 * 
 * @example
 * ```tsx
 * <ThemeToggle />
 * ```
 */
export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="
        relative
        p-2
        rounded-md
        border border-border
        bg-background
        text-foreground
        hover:bg-accent
        transition-all duration-200
        active:scale-95
        focus:outline-none
        focus:ring-2
        focus:ring-ring
        focus:ring-offset-2
      "
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      type="button"
    >
      {theme === 'dark' ? (
        <Sun
          className="h-5 w-5 transition-transform duration-200 rotate-0"
          aria-hidden="true"
        />
      ) : (
        <Moon
          className="h-5 w-5 transition-transform duration-200 rotate-0"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

// Made with Bob