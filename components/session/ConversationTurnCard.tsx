"use client";

import { useState } from "react";
import type { FileChangeItem } from "@/types/api";
import type { ConversationTurn } from "@/lib/session/conversation-layout";
import { EventCard } from "@/components/events/EventCard";
import { ResponseBlockCard } from "@/components/events/ResponseBlockCard";
import { TurnStatusCard } from "@/components/events/TurnStatusCard";

export function ConversationTurnCard({ turn, onOpenDiff }: {
  turn: ConversationTurn; onOpenDiff: (item: FileChangeItem) => void;
}) {
  const [processExpanded, setProcessExpanded] = useState(false);
  let finalIndex = -1;
  turn.items.forEach((item, index) => { if (item.type === "agent_message") finalIndex = index; });
  const finalMessage = finalIndex >= 0 ? turn.items[finalIndex] : undefined;
  const process = turn.items.filter((item, index) => index !== finalIndex &&
    !["error", "user_input_request", "function_call", "function_call_output"].includes(item.type));
  const urgent = turn.items.filter((item) => item.type === "error" || item.type === "user_input_request");
  const boundary = turn.boundary;
  return <div className="conversation-turn space-y-3">
    {turn.prompt && <EventCard item={turn.prompt} timestamp={turn.timestamp} showHeader={false} onOpenDiff={onOpenDiff} />}
    {boundary?.status === "failed" && <TurnStatusCard entry={boundary} />}
    {(finalMessage || process.length > 0 || boundary?.status === "running") && <ResponseBlockCard
      expanded={boundary?.status === "running" ? true : processExpanded}
      onToggleExpand={() => setProcessExpanded((current) => !current)}
      processItems={process} finalMessage={finalMessage} onOpenDiff={onOpenDiff} timestamp={turn.timestamp}
      turnMeta={boundary && boundary.status !== "failed" ? { id: boundary.id, status: boundary.status, durationMs: boundary.durationMs, usage: boundary.usage } : undefined} />}
    {urgent.map((item) => <EventCard key={item.id} item={item} onOpenDiff={onOpenDiff} />)}
  </div>;
}
