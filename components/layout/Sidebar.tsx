"use client";

import { useEffect, useRef, useState } from "react";
import { SessionList } from "@/components/sessions/SessionList";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useActiveSession } from "@/stores/active-session";
import { Plus, Terminal, PanelLeft, X } from "lucide-react";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function Sidebar() {
  const { dispatch } = useActiveSession();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const newSession = () => {
    dispatch({ type: "RESET" });
    dispatch({ type: "SET_RESUME", sessionId: null });
    setOpen(false);
  };

  return <>
    <button ref={toggle} type="button" aria-label={t(open ? "sidebar.close" : "sidebar.open")}
      aria-expanded={open} aria-controls="workspace-sidebar" onClick={() => setOpen((current) => !current)}
      className="fixed left-3 top-2 z-[60] flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--muted-foreground))] focus-ring md:hidden">
      {open ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
    </button>
    {open && <button type="button" tabIndex={-1} aria-label={t("sidebar.close")} onClick={() => setOpen(false)}
      className="fixed inset-0 z-40 bg-[hsl(var(--overlay)/0.25)] md:hidden" />}
    <aside id="workspace-sidebar" data-open={open} className="workspace-sidebar flex shrink-0 flex-col border-r border-[hsl(var(--border))]">
      <div className="space-y-4 px-4 pb-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
            <span className="truncate text-sm font-semibold tracking-tight">codex<span className="font-normal text-[hsl(var(--muted-foreground))]">-webui</span></span>
          </div>
          <div className="workspace-tools flex items-center gap-1.5"><ThemeToggle /><LanguageToggle /></div>
        </div>
        <button onClick={newSession}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--surface))] px-3 py-2 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.05)] focus-ring">
          <Plus className="h-3.5 w-3.5" />{t("sidebar.newSession")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto"><SessionList /></div>
    </aside>
  </>;
}
