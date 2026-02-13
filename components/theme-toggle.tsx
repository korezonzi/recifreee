"use client";

import { useCallback, useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTheme, setTheme, initTheme, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    initTheme();
    setThemeState(getTheme());
  }, []);

  const toggle = useCallback(() => {
    const next = NEXT[theme];
    setTheme(next);
    setThemeState(next);
  }, [theme]);

  const Icon = ICONS[theme];

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle} title={`テーマ: ${theme}`}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
