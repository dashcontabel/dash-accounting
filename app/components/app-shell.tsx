"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import CompanyLogo from "./company-logo";

type AppShellProps = {
  role: "ADMIN" | "CLIENT" | null;
  email: string | null;
  children: React.ReactNode;
  onLogout?: () => void;
};

const navItems = [
  { href: "/", label: "Dashboard", adminOnly: false },
  { href: "/app/imports", label: "Imports", adminOnly: false },
  { href: "/app/admin/users", label: "Usuarios", adminOnly: true },
  { href: "/app/admin/companies", label: "Empresas", adminOnly: true },
];

export default function AppShell({ role, email, children, onLogout }: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentPageLabel =
    navItems.find((item) => pathname === item.href)?.label ??
    (pathname.startsWith("/app/admin/") ? "Administracao" : "Dashboard");

  function renderNav() {
    return (
      <nav className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {navItems
          .filter((item) => !item.adminOnly || role === "ADMIN")
          .map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`block rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-[#0f4c81] bg-[#0f4c81] text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-[#0f4c81]/40 hover:bg-[#f5f8fc]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
      </nav>
    );
  }

  return (
    <div className="relative min-h-screen">
      {!isMenuOpen ? (
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-expanded={false}
          aria-controls="mobile-drawer-menu"
          className="fixed right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white/95 shadow-sm backdrop-blur lg:hidden"
        >
          <span className="sr-only">Abrir navegacao</span>
          <span className="relative block h-4 w-5">
            <span className="absolute left-0 top-0 block h-[3px] w-5 rounded-full bg-[#0f4c81]" />
            <span className="absolute left-0 top-[6px] block h-[3px] w-4 rounded-full bg-[#0f4c81]" />
            <span className="absolute left-0 top-[12px] block h-[3px] w-3 rounded-full bg-[#0f4c81]" />
          </span>
        </button>
      ) : null}

      <div
        className={`fixed inset-0 z-40 bg-slate-900/45 transition-opacity lg:hidden ${
          isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      <aside
        id="mobile-drawer-menu"
        className={`card-surface fixed left-0 top-0 z-50 h-screen w-[18.5rem] rounded-none border-r p-4 transition-transform duration-300 lg:w-[18.5rem] ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="mb-3 flex items-center justify-end lg:hidden">
          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700"
            aria-label="Fechar navegacao"
          >
            <span className="relative block h-4 w-4">
              <span className="absolute left-0 top-[6px] block h-[2px] w-4 rotate-45 rounded-full bg-[#0f4c81]" />
              <span className="absolute left-0 top-[6px] block h-[2px] w-4 -rotate-45 rounded-full bg-[#0f4c81]" />
            </span>
          </button>
        </div>

        <CompanyLogo compact className="mx-auto mb-3 w-full max-w-[190px]" />
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-[#0f4c81] to-[#1d5f9a] px-4 py-3 text-white">
          <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">Dash Contabil</p>
          <p className="mt-1 truncate text-sm font-semibold">{email ?? "..."}</p>
          <p className="mt-0.5 text-xs text-blue-100">Perfil: {role ?? "..."}</p>
        </div>
        {renderNav()}

        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="mt-4 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
          >
            Sair
          </button>
        ) : null}
      </aside>

      <main className="mx-auto min-h-screen w-full max-w-none px-3 py-4 sm:px-6 sm:py-6 lg:pl-[20.5rem] lg:pr-8 lg:py-8">
        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm sm:px-6 lg:px-7 lg:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Pagina atual</p>
              <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">{currentPageLabel}</h1>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <p className="font-medium text-zinc-900">{email ?? "..."}</p>
              <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">Perfil: {role ?? "..."}</p>
            </div>
          </div>
        </section>
        <section className="card-surface min-h-[70vh] p-5 sm:p-7 lg:p-8">{children}</section>
      </main>
    </div>
  );
}
