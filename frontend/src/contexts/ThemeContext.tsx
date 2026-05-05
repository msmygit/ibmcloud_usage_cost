import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme';

/**
 * Gets the initial theme from localStorage or defaults to 'light'
 * @returns The stored theme or 'light' as default
 */
const getInitialTheme = (): Theme => {
  // Check if window is available (SSR-safe)
  if (typeof window === 'undefined') {
    return 'light';
  }

  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }

  return 'light';
};

/**
 * ThemeProvider component that manages theme state and persistence
 * 
 * Provides theme context to all child components, handles localStorage persistence,
 * and applies the appropriate class to the document element for Tailwind dark mode.
 * 
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply theme class to document element and persist to localStorage
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Persist theme to localStorage
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }, [theme]);

  /**
   * Toggles between light and dark theme
   */
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook to access theme context
 * 
 * @throws {Error} If used outside of ThemeProvider
 * @returns Theme context value with current theme and toggle function
 * 
 * @example
 * ```tsx
 * const { theme, toggleTheme } = useTheme();
 * ```
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Made with Bob