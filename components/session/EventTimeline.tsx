"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ListChecks, GitBranch } from "lucide-react";
import type { FileChangeItem } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";
import { useConversationLayout } from "@/stores/conversation-layout";
import { layoutUnits } from "@/lib/session/conversation-layout";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { ConversationTurnCard } from "./ConversationTurnCard";
import { ConversationRegion } from "./ConversationRegion";
import { MessageRangeEditor } from "./MessageRangeEditor";
import { ConversationNav } from "./ConversationNav";

export function EventTimeline({ onOpenDiff }: { onOpenDiff: (item: FileChangeItem) => void }) {
  const { state } = useActiveSession();
  const layout = useConversationLayout();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState(-1);
  const scroll = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousSession = useRef<string | null>(null);
  const units = useMemo(() => layoutUnits(layout.turns, layout.doc), [layout.turns, layout.doc]);
  const virtualizer = useVirtualizer({
    count: units.length, getScrollElement: () => scroll.current,
    getItemKey: (index) => units[index].id,
    estimateSize: (index) => units[index]?.kind === "region" && units[index].region.collapsed ? 84 : 220,
    overscan: 5,
  });
  useEffect(() => {
    const changed = previousSession.current !== state.threadId;
    previousSession.current = state.threadId;
    if (changed) following.current = true;
    if (!following.current) return;
    const frame = requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [state.timeline.length, state.threadId]);
  const anchors = layout.turns.filter((turn) => turn.prompt).map((turn) => ({
    id: turn.id, index: layout.turns.indexOf(turn), preview: turn.prompt!.text.slice(0, 120),
  }));
  const jump = (index: number) => {
    const turn = layout.turns[index];
    if (!turn) return;
    layout.openTurn(turn.id);
    const unit = units.findIndex((entry) => entry.kind === "turn" ? entry.turn.id === turn.id : entry.region.nodes.some((node) => node.turnId === turn.id));
    if (unit >= 0) virtualizer.scrollToIndex(unit, { align: "start" });
    window.setTimeout(() => document.getElementById("conversation-" + turn.id)?.scrollIntoView({ block: "nearest" }), 100);
    setActiveAnchor(anchors.findIndex((anchor) => anchor.index === index));
  };
  return <div className="relative flex h-full flex-col">
    <div className="flex shrink-0 items-center justify-end border-b border-[hsl(var(--overlay)/0.06)] px-4 py-1.5">
      <button disabled={!layout.turns.length || state.status === "running" || !layout.ready}
        onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--overlay)/0.05)] disabled:opacity-35 focus-ring">
        <ListChecks className="h-3.5 w-3.5" />{t("org.edit")}
      </button>
    </div>
    <div ref={scroll} data-conversation-scroll onScroll={() => {
      const el = scroll.current;
      if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    }} className="min-h-0 flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
      <div className="relative mx-auto max-w-4xl" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const unit = units[row.index];
          return <div key={row.key} data-index={row.index} ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full px-5 py-2" style={{ transform: "translateY(" + row.start + "px)" }}>
            {unit.kind === "region" ? <ConversationRegion region={unit.region} onOpenDiff={onOpenDiff} /> :
              <div id={"conversation-" + unit.turn.id}>
                <ConversationTurnCard turn={unit.turn} onOpenDiff={onOpenDiff} />
                {unit.turn.items.some((item) => item.type === "agent_message") && <div className="mt-1 flex justify-end">
                  <button onClick={() => { layout.beginAt(unit.turn.id); document.querySelector<HTMLTextAreaElement>("[data-main-composer]")?.focus(); }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] focus-ring">
                    <GitBranch className="h-3 w-3" />{t("org.siblings")}
                  </button>
                </div>}
              </div>}
          </div>;
        })}
      </div>
    </div>
    <ConversationNav anchors={anchors} activeIndex={activeAnchor} onJump={jump} />
    {editing && <MessageRangeEditor onClose={() => setEditing(false)} />}
  </div>;
}
