import type { TimelineEntry, TurnEntry } from "@/stores/active-session";
import type { ResponseItem, UserMessageItem } from "@/types/api";

export type ViewMode = "normal" | "tree" | "fold";
export interface ConversationTurn {
  id: string;
  prompt?: UserMessageItem;
  timestamp?: string;
  boundary?: TurnEntry;
  items: ResponseItem[];
}
export interface BranchNode { id: string; turnId: string; parentId: string | null; collapsed: boolean }
export interface MessageRegion {
  id: string; type: "tree" | "fold"; title: string;
  anchorTurnId: string | null; collapsed: boolean; nodes: BranchNode[];
}
export interface QuestionDraft { id: string; text: string; groupId: string; parentId: string | null }
export interface LayoutDocument {
  version: 1; mode: ViewMode; activeGroupId: string | null; replyToId: string | null;
  groups: MessageRegion[]; drafts: QuestionDraft[];
}
export const emptyLayout = (): LayoutDocument => ({
  version: 1, mode: "normal", activeGroupId: null, replyToId: null, groups: [], drafts: [],
});

/** Question-order keys remain stable when live item IDs are replaced by replay IDs. */
export function conversationTurns(timeline: TimelineEntry[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let current: ConversationTurn | undefined;
  let pending: TurnEntry | undefined;
  for (const entry of timeline) {
    if (entry.kind === "turn") {
      if (current && !current.boundary) current.boundary = entry;
      else pending = entry;
    } else if (entry.item.type === "user_message") {
      current = { id: "question-" + turns.length, prompt: entry.item, timestamp: entry.timestamp, boundary: pending, items: [] };
      pending = undefined;
      turns.push(current);
    } else {
      if (!current) {
        current = { id: "question-" + turns.length, boundary: pending, items: [] };
        pending = undefined;
        turns.push(current);
      }
      current.items.push(entry.item);
    }
  }
  return turns;
}

export function regroupRange(
  doc: LayoutDocument, turns: ConversationTurn[], selected: string[],
  type: "tree" | "fold", id: string, title = "",
): LayoutDocument {
  const indices = selected.map((key) => turns.findIndex((turn) => turn.id === key)).sort((a, b) => a - b);
  if (!indices.length || indices[0] < 0 || new Set(indices).size !== indices.length ||
    indices.some((value, i) => i > 0 && value !== indices[i - 1] + 1)) {
    throw new Error("Select a continuous range of complete turns");
  }
  const chosen = new Set(selected);
  const groups = doc.groups.map((group) => {
    const nodes = group.nodes.filter((node) => !chosen.has(node.turnId));
    const ids = new Set(nodes.map((node) => node.id));
    return { ...group, nodes: nodes.map((node) => ({ ...node, parentId: ids.has(node.parentId ?? "") ? node.parentId : null })) };
  }).filter((group) => group.nodes.length || doc.drafts.some((draft) => draft.groupId === group.id));
  const group: MessageRegion = {
    id, type, title, anchorTurnId: indices[0] ? turns[indices[0] - 1].id : null,
    collapsed: type === "fold",
    nodes: indices.map((index) => ({ id: id + ":" + turns[index].id, turnId: turns[index].id, parentId: null, collapsed: false })),
  };
  const drafts = doc.drafts.map((draft) => ({
    ...draft, parentId: groups.find((entry) => entry.id === draft.groupId)?.nodes.some((node) => node.id === draft.parentId) ? draft.parentId : null,
  }));
  return { ...doc, mode: "normal", activeGroupId: null, replyToId: null, groups: [...groups, group], drafts };
}

export type LayoutUnit = { kind: "turn"; id: string; turn: ConversationTurn }
  | { kind: "region"; id: string; region: MessageRegion };
export function layoutUnits(turns: ConversationTurn[], doc: LayoutDocument): LayoutUnit[] {
  const positions = new Map(turns.map((turn, i) => [turn.id, i]));
  const owners = new Set(doc.groups.flatMap((group) => group.nodes.map((node) => node.turnId)));
  const rows: Array<{ position: number; unit: LayoutUnit }> = turns
    .filter((turn) => !owners.has(turn.id))
    .map((turn) => ({ position: positions.get(turn.id)!, unit: { kind: "turn", id: turn.id, turn } }));
  for (const region of doc.groups) {
    const indices = region.nodes.map((node) => positions.get(node.turnId)).filter((index): index is number => index !== undefined);
    if (!indices.length && !doc.drafts.some((draft) => draft.groupId === region.id) && region.id !== doc.activeGroupId) continue;
    const anchor = region.anchorTurnId === null ? -1 : positions.get(region.anchorTurnId);
    const position = anchor !== undefined ? anchor + 0.5
      : indices.length ? Math.min(...indices) : turns.length + 0.5;
    rows.push({ position, unit: { kind: "region", id: region.id, region } });
  }
  return rows.sort((a, b) => a.position - b.position).map((row) => row.unit);
}

export function readLayout(storage: Pick<Storage, "getItem">, key: string): LayoutDocument {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null") as LayoutDocument | null;
    if (value?.version !== 1 || !["normal", "tree", "fold"].includes(value.mode) ||
      !Array.isArray(value.groups) || !Array.isArray(value.drafts)) return emptyLayout();
    if (value.groups.some((group) => !group || typeof group.id !== "string" ||
      !["tree", "fold"].includes(group.type) || !Array.isArray(group.nodes) ||
      group.nodes.some((node, i) => !node || typeof node.turnId !== "string" || typeof node.id !== "string" ||
        (node.parentId !== null && !group.nodes.slice(0, i).some((parent) => parent.id === node.parentId))))) return emptyLayout();
    if (value.drafts.some((draft) => !draft || typeof draft.text !== "string" || typeof draft.id !== "string" ||
      !value.groups.some((group) => group.id === draft.groupId))) return emptyLayout();
    return value;
  } catch { return emptyLayout(); }
}

export function branchPrompt(text: string, parent?: ConversationTurn): string {
  if (!parent) return text;
  const answer = [...parent.items].reverse().find((item) => item.type === "agent_message");
  return "[codex-webui branch]\nQuestion: " + (parent.prompt?.text ?? "") +
    "\nAnswer: " + (answer?.type === "agent_message" ? answer.text.slice(0, 6000) : "") +
    "\n[/codex-webui branch]\n\n" + text;
}


/** A turn has one visual owner, including when resumed history replaces pending IDs. */
export function attachLayoutTurn(doc: LayoutDocument, turnId: string, nodeId: string, draft?: QuestionDraft): LayoutDocument {
  const groupId = draft?.groupId ?? doc.activeGroupId;
  const parentId = draft ? draft.parentId : doc.replyToId;
  const groups = doc.groups.map((group) => {
    const nodes = group.nodes.filter((node) => node.turnId !== turnId);
    const ids = new Set(nodes.map((node) => node.id));
    const retained = nodes.map((node) => ({ ...node, parentId: ids.has(node.parentId ?? "") ? node.parentId : null }));
    return group.id === groupId ? { ...group, nodes: [...retained,
      { id: nodeId, turnId, parentId: ids.has(parentId ?? "") ? parentId : null, collapsed: false }] }
      : { ...group, nodes: retained };
  });
  const drafts = doc.drafts.filter((entry) => entry.id !== draft?.id).map((entry) => ({
    ...entry, parentId: groups.find((group) => group.id === entry.groupId)?.nodes.some((node) => node.id === entry.parentId) ? entry.parentId : null,
  }));
  return { ...doc, groups, drafts };
}
