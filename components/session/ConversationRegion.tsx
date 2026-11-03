"use client";

import { ChevronRight, GitBranch, FoldVertical, Loader2, CornerDownRight, Undo2 } from "lucide-react";
import type { FileChangeItem } from "@/types/api";
import type { MessageRegion, BranchNode } from "@/lib/session/conversation-layout";
import { useConversationLayout } from "@/stores/conversation-layout";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useActiveSession } from "@/stores/active-session";
import { EventCard } from "@/components/events/EventCard";
import { ConversationTurnCard } from "./ConversationTurnCard";

export function ConversationRegion({ region, onOpenDiff }: {
  region: MessageRegion; onOpenDiff: (item: FileChangeItem) => void;
}) {
  const layout = useConversationLayout();
  const { state } = useActiveSession();
  const { t } = useLanguage();
  const turns = region.nodes.map((node) => layout.turns.find((turn) => turn.id === node.turnId)).filter((turn) => !!turn);
  const drafts = layout.doc.drafts.filter((draft) => draft.groupId === region.id);
  const running = turns.some((turn) => turn.boundary?.status === "running" ||
    (!turn.boundary && turn.id === layout.turns.at(-1)?.id && state.status === "running"));
  const urgent = turns.flatMap((turn) => turn.items.filter((item) => item.type === "error" || item.type === "user_input_request"));
  const title = region.title || (region.type === "fold" ? turns[0]?.prompt?.text.slice(0, 70) : "") || t(region.type === "tree" ? "org.treeRegion" : "org.foldRegion");
  const rows: Array<{ node: BranchNode; depth: number }> = [];
  const visit = (parent: string | null, depth: number) => {
    for (const node of region.nodes.filter((entry) => entry.parentId === parent)) {
      rows.push({ node, depth });
      if (!node.collapsed) visit(node.id, depth + 1);
    }
  };
  visit(null, 0);
  const followUp = (parentId: string | null) => {
    layout.followUp(region.id, parentId);
    document.querySelector<HTMLTextAreaElement>("[data-main-composer]")?.focus();
  };
  return <section data-region-id={region.id} data-region-type={region.type} aria-label={title}
    className={"conversation-region my-2 overflow-hidden rounded-xl border " + (region.type === "tree" ? "border-[hsl(var(--primary)/0.26)]" : "border-[hsl(var(--border))]")}>
    <div className="region-header flex items-center gap-2 bg-[hsl(var(--surface-2)/0.65)] px-3 py-2.5">
      <button aria-expanded={!region.collapsed} onClick={() => layout.toggle(region.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left focus-ring">
        <ChevronRight className={"region-disclosure h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] " + (!region.collapsed ? "rotate-90" : "")} />
        {region.type === "tree" ? <GitBranch className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" /> : <FoldVertical className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />}
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="shrink-0 rounded-md bg-[hsl(var(--surface))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{turns.length + drafts.length} {t(region.type === "tree" ? "org.questions" : "org.turns")}</span>
        {!running && turns.some((turn) => turn.boundary?.status === "failed" || turn.items.some((item) => item.type === "error")) &&
          <span className="shrink-0 text-xs text-[hsl(var(--danger))]">{t("org.failed")}</span>}
        {running && <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[hsl(var(--primary))]"><Loader2 className="h-3 w-3 animate-spin" />{t("org.running")}</span>}
      </button>
      {region.collapsed && <button title={t(region.type === "tree" ? "org.siblings" : "org.continue")}
        aria-label={t(region.type === "tree" ? "org.siblings" : "org.continue")} onClick={() => followUp(null)}
        className="rounded-md p-1.5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)] focus-ring"><CornerDownRight className="h-3.5 w-3.5" /></button>}
      <button disabled={drafts.length > 0} title={drafts.length ? t("org.pendingFirst") : t("org.ungroup")} aria-label={t("org.ungroup")}
        onClick={() => layout.ungroup(region.id)} className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--overlay)/0.06)] disabled:opacity-30 focus-ring"><Undo2 className="h-3.5 w-3.5" /></button>
    </div>
    {!region.collapsed && <div className={"region-body px-3 py-3 sm:px-4 " + (region.type === "tree" ? "space-y-4" : "space-y-3")}>
      <div className={region.type === "tree" ? "region-tree-body space-y-4" : "space-y-3"}>
      {region.type === "fold" ? turns.map((turn) => <div key={turn.id} id={"conversation-" + turn.id} className="fold-turn"><ConversationTurnCard turn={turn} onOpenDiff={onOpenDiff} /></div>)
        : rows.map(({ node, depth }) => {
          const turn = layout.turns.find((entry) => entry.id === node.turnId);
          if (!turn) return null;
          const busy = turn.boundary?.status === "running" || (!turn.boundary && state.status === "running" && turn.id === layout.turns.at(-1)?.id);
          return <div key={node.id} id={"conversation-" + turn.id} data-depth={depth > 0 ? "nested" : "root"} style={{ marginLeft: Math.min(depth, 6) * 18 }}
            className="branch-node">
            <div className="flex items-start gap-1.5">
              <button onClick={() => layout.toggle(region.id, node.id)} aria-expanded={!node.collapsed}
                className="branch-question flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium focus-ring">
                <ChevronRight className={"region-disclosure mt-1 h-3 w-3 shrink-0 text-[hsl(var(--primary))] " + (!node.collapsed ? "rotate-90" : "")} />
                <span className={"min-w-0 flex-1 " + (node.collapsed ? "line-clamp-2" : "whitespace-pre-wrap break-words")}>{turn.prompt?.text ?? t("org.root")}</span>
                {busy && <Loader2 className="mt-1 h-3 w-3 shrink-0 animate-spin text-[hsl(var(--primary))]" />}
              </button>
              <button aria-label={t("org.follow")} title={t("org.follow")} onClick={() => followUp(node.id)}
                className="mt-1 rounded-md p-1.5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)] focus-ring"><CornerDownRight className="h-3.5 w-3.5" /></button>
            </div>
            {node.collapsed && turn.items.filter((item) => item.type === "error" || item.type === "user_input_request").map((item) =>
              <EventCard key={item.id} item={item} onOpenDiff={onOpenDiff} />)}
            {!node.collapsed && <ConversationTurnCard turn={{ ...turn, prompt: turn.prompt?.images?.length || turn.prompt?.attachments?.length ? turn.prompt : undefined }} onOpenDiff={onOpenDiff} />}
          </div>;
        })}
      {drafts.map((draft) => <div key={draft.id} className="border-l-2 border-dashed border-[hsl(var(--primary)/0.25)] py-1 pl-3 text-sm text-[hsl(var(--muted-foreground))]">
        <span className="mr-2 rounded bg-[hsl(var(--overlay)/0.05)] px-1.5 py-0.5 text-[10px]">{t("org.drafts")}</span>{draft.text}
      </div>)}
      </div>
      {!turns.length && !drafts.length && <p className="px-1 text-xs text-[hsl(var(--muted-foreground))]">{t("org.empty")}</p>}
    </div>}
    {region.collapsed && urgent.length > 0 && <div className="px-3 py-2">{urgent.map((item) => <EventCard key={item.id} item={item} onOpenDiff={onOpenDiff} />)}</div>}
    {!region.collapsed && <div className="border-t border-[hsl(var(--border-subtle))] px-3 py-1.5">
      <button onClick={() => followUp(null)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)] focus-ring"><CornerDownRight className="h-3 w-3" />{t(region.type === "tree" ? "org.siblings" : "org.continue")}</button>
    </div>}
  </section>;
}
