"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "./ui/icons";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}