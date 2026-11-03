"use client";

import { useEffect, useRef, useState } from "react";
import { X, GitBranch, FoldVertical } from "lucide-react";
import { useConversationLayout } from "@/stores/conversation-layout";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function MessageRangeEditor({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { turns, groupSelection } = useConversationLayout();
  const { t } = useLanguage();
  const [anchor, setAnchor] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const first = anchor === null ? -1 : Math.min(anchor, end ?? anchor);
  const last = anchor === null ? -1 : Math.max(anchor, end ?? anchor);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const apply = (mode: "tree" | "fold") => {
    if (first < 0) return;
    groupSelection(turns.slice(first, last + 1).map((turn) => turn.id), mode, title.trim());
    onClose();
  };
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }}
    aria-labelledby="organization-editor-title"
    className="m-auto w-[min(760px,calc(100vw-32px))] max-h-[85vh] rounded-xl border border-[hsl(var(--overlay)/0.15)] bg-[hsl(var(--surface))] p-0 text-foreground shadow-xl backdrop:bg-[hsl(var(--overlay)/0.3)]">
    <div className="flex max-h-[85vh] flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-[hsl(var(--overlay)/0.1)] px-5 py-4">
        <div><h2 id="organization-editor-title" className="font-semibold">{t("org.editTitle")}</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("org.editHelp")}</p></div>
        <button type="button" onClick={onClose} aria-label={t("org.close")} className="rounded-md p-1 focus-ring"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background p-3">
        {turns.map((turn, index) => {
          const selected = index >= first && index <= last && first >= 0;
          const answer = [...turn.items].reverse().find((item) => item.type === "agent_message");
          return <label key={turn.id} className={"range-row mb-1.5 flex cursor-pointer items-start gap-3 rounded-lg border p-3 " +
            (selected ? "border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.06)]" : "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] hover:border-[hsl(var(--primary)/0.2)]")}>
            <input type="checkbox" checked={selected} aria-label={t("org.selectTurn") + " " + (index + 1)}
              className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              onChange={() => { if (anchor === index && (end === null || end === index)) { setAnchor(null); setEnd(null); }
                else if (anchor === null) setAnchor(index); else setEnd(index); }} />
            <div className="min-w-0 flex-1">
              <span className="mb-1 inline-block text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{index + 1}</span>
              <p className="line-clamp-2 text-sm font-medium leading-relaxed">{turn.prompt?.text ?? t("org.root")}</p>
              {answer?.type === "agent_message" && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{answer.text}</p>}
            </div>
          </label>;
        })}
      </div>
      <footer className="space-y-3 border-t border-[hsl(var(--overlay)/0.1)] px-5 py-4">
        <input aria-label={t("org.title")} placeholder={t("org.title")} value={title} onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border border-[hsl(var(--overlay)/0.15)] bg-[hsl(var(--surface-2))] px-3 py-2 text-sm focus-ring" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-[hsl(var(--muted-foreground))]">{first < 0 ? 0 : last - first + 1} {t("org.selected")}</span>
          <button onClick={() => { setAnchor(null); setEnd(null); }} className="rounded-md px-2 py-1.5 text-xs focus-ring">{t("org.clear")}</button>
          <button disabled={first < 0} onClick={() => apply("tree")} className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary)/0.12)] px-3 py-2 text-xs text-[hsl(var(--primary))] disabled:opacity-40 focus-ring"><GitBranch className="h-3.5 w-3.5" />{t("org.makeTree")}</button>
          <button disabled={first < 0} onClick={() => apply("fold")} className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary)/0.12)] px-3 py-2 text-xs text-[hsl(var(--primary))] disabled:opacity-40 focus-ring"><FoldVertical className="h-3.5 w-3.5" />{t("org.makeFold")}</button>
        </div>
      </footer>
    </div>
  </dialog>;
}
