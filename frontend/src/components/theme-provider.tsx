"use client";

import * as React from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setThemeState("light");
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add("light");
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState("light");
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add("light");
  };
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div style={{ visibility: mounted ? "visible" : "hidden" }} className="w-full min-h-screen">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
