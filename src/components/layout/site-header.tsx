"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useSettings } from "@/lib/use-settings";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/lingo", label: "Lingo" },
  { href: "/karogs", label: "Karogs" },
  { href: "/statistika", label: "Statistika" },
  { href: "/ka-spelet", label: "Kā spēlēt?" },
  { href: "/par-projektu", label: "Par projektu" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Lingo & Karogs sākums">
      <span
        className="relative grid size-8 place-items-center overflow-hidden rounded-xl shadow-sm"
        aria-hidden
      >
        <span className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400" />
        <span className="absolute -right-2 -bottom-2 size-6 rotate-45 rounded-md bg-red-600" />
        <span className="relative text-sm font-black tracking-tighter text-white">LK</span>
      </span>
      <span className="text-lg font-extrabold tracking-tight">Lingo &amp; Karogs</span>
    </Link>
  );
}

export function SiteHeader() {
  const [settings, update] = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <nav aria-label="Galvenā navigācija" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-stone-100 dark:hover:bg-stone-800",
                pathname.startsWith(item.href)
                  ? "bg-stone-100 text-indigo-700 dark:bg-stone-800 dark:text-indigo-300"
                  : "text-stone-600 dark:text-stone-300",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              update({ theme: isDark ? "light" : "dark" })
            }
            aria-label={isDark ? "Pārslēgt uz gaišo tēmu" : "Pārslēgt uz tumšo tēmu"}
            className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {isDark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
          </button>
          <Link
            href="/iestatijumi"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 sm:block"
          >
            Iestatījumi
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Aizvērt izvēlni" : "Atvērt izvēlni"}
            className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 md:hidden"
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav
          aria-label="Mobilā navigācija"
          className="border-t border-stone-200 bg-white px-4 py-2 dark:border-stone-800 dark:bg-stone-950 md:hidden"
        >
          {[...NAV, { href: "/iestatijumi", label: "Iestatījumi" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className={cn(
                "block rounded-lg px-3 py-3 text-base font-semibold",
                pathname.startsWith(item.href)
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
