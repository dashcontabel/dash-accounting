"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import CompanyLogo from "./company-logo";
import { useTheme } from "./theme-provider";

type AppShellProps = {
  role: "ADMIN" | "CLIENT" | null;
  email: string | null;
  children: React.ReactNode;
  onLogout?: () => void;
};

const SunIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    adminOnly: false,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/app/imports",
    label: "Importações",
    adminOnly: false,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
  },
  {
    href: "/app/docs/dashboard",
    label: "Guia do Dashboard",
    adminOnly: false,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/app/docs/import-mapping",
    label: "Guia de Importação",
    adminOnly: false,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
  },
  {
    href: "/app/admin/users",
    label: "Usuários",
    adminOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/app/admin/companies",
    label: "Empresas",
    adminOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: "/app/admin/mappings",
    label: "Mapeamentos",
    adminOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
];

export default function AppShell({ role, email, children, onLogout }: AppShellProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentItem = navItems.find((item) => pathname === item.href);
  const currentPageLabel =
    currentItem?.label ??
    (pathname.startsWith("/app/admin/") ? "Administração" : "Dashboard");

  const visibleNav = navItems.filter((item) => !item.adminOnly || role === "ADMIN");

  const adminNav = visibleNav.filter((i) => i.adminOnly);
  const publicNav = visibleNav.filter((i) => !i.adminOnly);

  function renderNavGroup(items: typeof navItems) {
    return items.map((item) => {
      const isActive = pathname === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setIsMenuOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
            isActive
              ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
              : "text-blue-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className={`flex-shrink-0 ${isActive ? "opacity-100" : "opacity-70"}`}>{item.icon}</span>
          <span>{item.label}</span>
          {isActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white opacity-80" />
          )}
        </Link>
      );
    });
  }

  const sidebarContent = (
    <>
      {/* Logo + Brand */}
      <div className="px-2">
        <CompanyLogo compact className="mx-auto mb-4 w-full max-w-[160px]" />
      </div>

      {/* User badge */}
      <div className="mx-2 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white">
            {(email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{email ?? "..."}</p>
            <p className="text-[11px] text-blue-200">{role === "ADMIN" ? "Administrador" : "Cliente"}</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="mt-5 px-2 flex flex-col gap-1">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-blue-300/70">Menu</p>
        {renderNavGroup(publicNav)}

        {adminNav.length > 0 && (
          <>
            <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-blue-300/70">Administração</p>
            {renderNavGroup(adminNav)}
          </>
        )}
      </nav>

      {/* Bottom actions */}
      {onLogout ? (
        <div className="mt-auto px-2 pt-6 flex flex-col gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-100/80 transition hover:bg-white/10 hover:text-white"
          >
            <span className="opacity-60">{theme === "dark" ? <SunIcon /> : <MoonIcon />}</span>
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-100/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>
      ) : (
        <div className="mt-auto px-2 pt-6">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-100/80 transition hover:bg-white/10 hover:text-white"
          >
            <span className="opacity-60">{theme === "dark" ? <SunIcon /> : <MoonIcon />}</span>
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="relative min-h-screen bg-[--background]">
      {/* Mobile hamburger */}
      {!isMenuOpen ? (
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-expanded={false}
          aria-controls="mobile-drawer-menu"
          className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f4c81] text-white shadow-lg lg:hidden"
        >
          <span className="sr-only">Abrir navegação</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      ) : null}

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside
        id="mobile-drawer-menu"
        className={`fixed left-0 top-0 z-50 flex h-screen w-[16.5rem] flex-col overflow-y-auto bg-gradient-to-b from-[#0c3460] via-[#0f4c81] to-[#0c3460] py-5 shadow-2xl transition-transform duration-300 ease-in-out dark:from-[#090f1a] dark:via-[#0d1f38] dark:to-[#090f1a] lg:translate-x-0 ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile close */}
        <div className="mb-3 flex items-center justify-end px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-200 hover:bg-white/10"
            aria-label="Fechar navegação"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="min-h-screen w-full px-3 py-4 sm:px-5 sm:py-5 lg:pl-[18rem] lg:pr-6 lg:py-6">
        {/* Top header bar */}
        <header className="mb-5 flex items-center justify-between rounded-2xl border border-[--border] bg-[--surface] px-4 py-3.5 shadow-sm sm:px-5">
          {/* Left: push right past hamburger on mobile */}
          <div className="flex items-center gap-3 pl-11 sm:pl-12 lg:pl-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#0f4c81]/10 text-[#0f4c81] dark:bg-blue-900/30 dark:text-blue-400">
              {currentItem?.icon ?? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
            </div>
            <div>
              <p className="hidden text-[10px] font-semibold uppercase tracking-widest text-[--text-muted] sm:block">
                Dash Contábil
              </p>
              <h1 className="text-base font-bold text-[--foreground] sm:text-[17px]">
                {currentPageLabel}
              </h1>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Theme toggle in mobile header */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[--border] text-[--text-muted] transition hover:border-[#0f4c81]/40 hover:bg-[#0f4c81]/5 hover:text-[#0f4c81] dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 lg:hidden"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Desktop: user info */}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="text-right">
                <p className="text-xs font-semibold text-[--foreground]">{email ?? "..."}</p>
                <p className="text-[10px] text-[--text-muted]">
                  {role === "ADMIN" ? "Administrador" : "Cliente"}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f4c81] text-xs font-bold text-white shadow-sm">
                {(email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="rounded-2xl border border-[--border] bg-[--surface] p-4 shadow-sm sm:p-5 lg:p-7">
          {children}
        </div>
      </main>
    </div>
  );
}
