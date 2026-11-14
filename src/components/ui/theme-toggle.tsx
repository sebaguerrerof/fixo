"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY } from "@/design-system/theme";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

export function ThemeToggle({ className }: { readonly className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => { setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light"); }, []);

  function toggle() {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage can be blocked; the choice then lasts for this visit */ }
    setTheme(next);
  }

  const label = theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  return (
    <button aria-label={label} className={cn("press touch-target inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", className)} onClick={toggle} title={label} type="button">
      <Sun className="hidden size-5 dark:block" />
      <Moon className="size-5 dark:hidden" />
    </button>
  );
}
