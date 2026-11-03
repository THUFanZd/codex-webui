"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useActiveSession } from "./active-session";
import { useShowcaseMode } from "@/components/showcase/showcase-context";
import {
  emptyLayout, readLayout, conversationTurns, regroupRange, attachLayoutTurn,
  type LayoutDocument, type ViewMode, type QuestionDraft,
} from "@/lib/session/conversation-layout";

function useLayoutController() {
  const { state } = useActiveSession();
  const showcase = useShowcaseMode();
  const session = state.resumeSessionId ?? state.threadId;
  const key = "codex-webui-layout-v1:" + (showcase ? "showcase:" : "") + (session ?? "new");
  const [snapshot, setSnapshot] = useState({ key: "", doc: emptyLayout() });
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const turns = conversationTurns(state.timeline);
  const doc = snapshot.key === key ? snapshot.doc : emptyLayout();
  const ready = snapshot.key === key;

  useEffect(() => {
    if (snapshotRef.current.key === key) return;
    const old = snapshotRef.current;
    const newKey = "codex-webui-layout-v1:" + (showcase ? "showcase:" : "") + "new";
    const migrating = old.key === newKey && !!session && !state.isReplay;
    let loaded = emptyLayout();
    try {
      loaded = migrating ? old.doc : !session && old.key ? emptyLayout() : readLayout(window.localStorage, key);
      if (migrating) window.localStorage.setItem(newKey, JSON.stringify(emptyLayout()));
    } catch { /* browser storage can be unavailable */ }
    setSnapshot({ key, doc: loaded });
  }, [key, session, state.isReplay, showcase]);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(key, JSON.stringify(doc)); } catch { /* preserve in-memory editing */ }
  }, [key, doc, ready]);

  const update = (change: (current: LayoutDocument) => LayoutDocument) =>
    setSnapshot((current) => current.key === key ? { key, doc: change(current.doc) } : current);

  const selectMode = (mode: ViewMode) => update((current) => {
    if (mode === "normal") return { ...current, mode, activeGroupId: null, replyToId: null };
    if (current.mode === mode && current.activeGroupId) return current;
    const id = crypto.randomUUID();
    return { ...current, mode, activeGroupId: id, replyToId: null,
      groups: [...current.groups, { id, type: mode, title: "", anchorTurnId: turns.at(-1)?.id ?? null, collapsed: mode === "fold", nodes: [] }] };
  });
  const beginAt = (turnId: string) => update((current) => {
    const id = crypto.randomUUID();
    return { ...current, mode: "tree", activeGroupId: id, replyToId: null,
      groups: [...current.groups, { id, type: "tree", title: "", anchorTurnId: turnId, collapsed: false, nodes: [] }] };
  });
  const followUp = (groupId: string, parentId: string | null) => update((current) => ({
    ...current, mode: current.groups.find((group) => group.id === groupId)?.type ?? "tree",
    activeGroupId: groupId, replyToId: parentId,
    groups: current.groups.map((group) => group.id === groupId && group.type === "tree" ? { ...group, collapsed: false } : group),
  }));
  const addDraft = (text: string) => update((current) => !current.activeGroupId ? current : ({
    ...current, drafts: [...current.drafts, { id: crypto.randomUUID(), text, groupId: current.activeGroupId, parentId: current.replyToId }],
  }));
  const attachTurn = (turnId: string, draft?: QuestionDraft) =>
    update((current) => attachLayoutTurn(current, turnId, crypto.randomUUID(), draft));
  const toggle = (groupId: string, nodeId?: string) => update((current) => ({
    ...current, groups: current.groups.map((group) => group.id !== groupId ? group
      : nodeId ? { ...group, nodes: group.nodes.map((node) => node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node) }
        : { ...group, collapsed: !group.collapsed }),
  }));
  const ungroup = (groupId: string) => update((current) => current.drafts.some((draft) => draft.groupId === groupId) ? current : ({
    ...current, groups: current.groups.filter((group) => group.id !== groupId),
    ...(current.activeGroupId === groupId ? { mode: "normal" as const, activeGroupId: null, replyToId: null } : {}),
  }));
  const editDraft = (id: string, text: string) => update((current) => ({
    ...current, drafts: current.drafts.map((draft) => draft.id === id ? { ...draft, text } : draft),
  }));
  const removeDraft = (id: string) => update((current) => ({ ...current, drafts: current.drafts.filter((draft) => draft.id !== id) }));
  const groupSelection = (ids: string[], mode: "tree" | "fold", title: string) =>
    update((current) => regroupRange(current, turns, ids, mode, crypto.randomUUID(), title));
  const openTurn = (turnId: string) => update((current) => ({
    ...current, groups: current.groups.map((group) => group.nodes.some((node) => node.turnId === turnId)
      ? { ...group, collapsed: false, nodes: group.nodes.map((node) => ({ ...node, collapsed: false })) } : group),
  }));
  return { doc, ready, turns, selectMode, followUp, addDraft, attachTurn, toggle, ungroup,
    editDraft, removeDraft, groupSelection, openTurn, beginAt };
}
type Controller = ReturnType<typeof useLayoutController>;
const Context = createContext<Controller | null>(null);
export function ConversationLayoutProvider({ children }: { children: ReactNode }) {
  const value = useLayoutController();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useConversationLayout() {
  const value = useContext(Context);
  if (!value) throw new Error("ConversationLayoutProvider is required");
  return value;
}
