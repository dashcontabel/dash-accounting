"use client";

import { useEffect, useRef, useState } from "react";

import type { DashNotification } from "@/lib/dashboard/freshness";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export default function NotificationsBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: DashNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Reset history view whenever dropdown closes
  useEffect(() => {
    if (!open) setShowHistory(false);
  }, [open]);

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);
  const visible = showHistory ? notifications : unread;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[--border] bg-[--surface] text-[--text-muted] transition-colors hover:bg-[--surface-2] hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Explicit inline background to guarantee full opacity regardless of Tailwind v4 variable resolution
        <div
          className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-[--border] shadow-2xl"
          style={{ backgroundColor: "var(--surface)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b border-[--border] px-4 py-3"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Notificações
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs text-brand hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto" style={{ backgroundColor: "var(--surface)" }}>
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <svg
                  className="h-8 w-8"
                  style={{ color: "var(--text-muted)" }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
                </svg>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {showHistory ? "Sem notificações no histórico" : "Nenhuma notificação não lida"}
                </p>
              </div>
            ) : (
              visible.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 border-b border-[--border] px-4 py-3 last:border-0"
                  style={{
                    backgroundColor: n.read ? "var(--surface)" : "color-mix(in srgb, var(--brand) 6%, var(--surface))",
                  }}
                >
                  {/* Unread dot */}
                  <div
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: n.read ? "transparent" : "var(--brand)" }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {n.companyName}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {n.action}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)", opacity: 0.75 }}>
                      {formatRelativeTime(n.detectedAt)}
                    </p>
                  </div>

                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      aria-label="Marcar como lida"
                      className="mt-0.5 shrink-0 rounded p-0.5 hover:text-foreground"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer — history toggle */}
          {read.length > 0 && (
            <div
              className="border-t border-[--border] px-4 py-2.5"
              style={{ backgroundColor: "var(--surface-2)" }}
            >
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                {showHistory
                  ? "Ocultar histórico"
                  : `Ver histórico · ${read.length} lida${read.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
