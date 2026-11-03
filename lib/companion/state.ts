import type { ActiveSessionState, TimelineEntry } from "@/stores/active-session";

export type CompanionMood = "idle" | "running" | "attention" | "completed";
export const INTERACTION_RESOLVED_EVENT = "codex-webui:interaction-resolved";
export interface InteractionResolvedDetail { interactionId: string }

export interface SessionSnapshot {
  sessionId: string | null;
  turnId: string | null;
  status: ActiveSessionState["status"];
  isReplay: boolean;
}

function latestTurn(timeline: TimelineEntry[]) {
  for (let index = timeline.length - 1; index >= 0; index--) {
    const entry = timeline[index];
    if (entry.kind === "turn") return { entry, index };
  }
  return null;
}

export function sessionSnapshot(state: ActiveSessionState): SessionSnapshot {
  const turn = latestTurn(state.timeline)?.entry;
  return {
    sessionId: state.threadId ?? state.sessionMeta?.session_id ?? state.resumeSessionId,
    turnId: turn ? `${turn.id}:${turn.startedAt ?? ""}` : null,
    status: state.status,
    isReplay: state.isReplay,
  };
}

/** Only a live turn observed running in this mounted app can celebrate. */
export function shouldCelebrateCompletion(
  previous: SessionSnapshot | null,
  current: SessionSnapshot,
): boolean {
  return Boolean(previous &&
    !previous.isReplay && !current.isReplay &&
    previous.status === "running" && current.status === "completed" &&
    (previous.sessionId === current.sessionId || previous.sessionId === null) &&
    (previous.turnId === current.turnId || previous.turnId === null));
}

export function companionMood(
  state: ActiveSessionState,
  resolvedInteractions: ReadonlySet<string> = new Set(),
): Exclude<CompanionMood, "completed"> {
  if (state.isReplay) return "idle";
  if (state.status === "failed") return "attention";
  if (state.status !== "running") return "idle";

  const turn = latestTurn(state.timeline);
  // START_EXECUTION can briefly retain the previous completed turn.
  const entries = turn
    ? turn.entry.status === "running" ? state.timeline.slice(turn.index + 1) : []
    : state.timeline;
  let needsAttention = false;
  for (const entry of entries) {
    if (entry.kind !== "item") continue;
    if (entry.item.type === "user_input_request") {
      needsAttention = needsAttention || !resolvedInteractions.has(entry.item.interactionId);
    } else if (entry.item.type === "error") {
      if (entry.item.severity !== "warning") needsAttention = true;
    } else {
      // Further model/tool output means execution has resumed.
      needsAttention = false;
    }
  }
  return needsAttention ? "attention" : "running";
}
