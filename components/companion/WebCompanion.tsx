"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Home, ImagePlus, PawPrint, X } from "lucide-react";
import { useActiveSession } from "@/stores/active-session";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  companionMood, INTERACTION_RESOLVED_EVENT, sessionSnapshot, shouldCelebrateCompletion,
  type InteractionResolvedDetail, type SessionSnapshot,
} from "@/lib/companion/state";
import {
  clampPosition, defaultPosition, MAX_SPRITE_BYTES, readCompanionPreferences,
  spriteVersion, writeCompanionPreferences,
  type CompanionPreferences, type CompanionStorage, type SpriteVersion,
} from "@/lib/companion/preferences";
import { CompanionArt } from "./CompanionArt";
import { SpriteArt } from "./SpriteArt";
import styles from "./WebCompanion.module.css";

const COPY = {
  en: {
    name: "Companion", idle: "Here with you", running: "Working", attention: "Needs your attention",
    completed: "Task complete", hide: "Hide companion", restore: "Show companion",
    reset: "Return to default position", import: "Import local PNG / WebP sprite",
    builtin: "Use original companion", keys: "Drag to move. Arrow keys move; Shift moves farther. Home or Escape returns to default.",
    fileError: "Choose a PNG or WebP sprite, up to 20 MiB, at 1536 × 1872 or 1536 × 2288.",
  },
  "zh-CN": {
    name: "桌宠", idle: "陪你待着", running: "工作中", attention: "需要你处理",
    completed: "任务完成", hide: "隐藏桌宠", restore: "显示桌宠",
    reset: "回到默认位置", import: "导入本地 PNG / WebP 精灵图",
    builtin: "使用原创桌宠", keys: "拖动可移动；方向键微调，Shift 加速；Home 或 Escape 回到默认位置。",
    fileError: "请选择 20 MiB 以内、尺寸为 1536 × 1872 或 1536 × 2288 的 PNG / WebP 精灵图。",
  },
};

function storage(): CompanionStorage | null {
  try { return window.localStorage; } catch { return null; }
}
function viewport() { return { width: window.innerWidth, height: window.innerHeight }; }

interface Drag {
  pointerId: number; startX: number; startY: number;
  origin: { x: number; y: number }; moved: boolean;
}

/** Mount once inside both ActiveSessionProvider and LanguageProvider. */
export function WebCompanion() {
  const { state } = useActiveSession();
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [preferences, setPreferences] = useState<CompanionPreferences>({ position: null, hidden: false });
  const preferencesRef = useRef(preferences);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const previous = useRef<SessionSnapshot | null>(null);
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set());
  const [celebrating, setCelebrating] = useState(false);
  const [waving, setWaving] = useState(false);
  const [sprite, setSprite] = useState<{ url: string; version: SpriteVersion } | null>(null);
  const spriteUrl = useRef<string | null>(null);
  const importSequence = useRef(0);
  const [importError, setImportError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const petButton = useRef<HTMLButtonElement>(null);

  const snapshot = useMemo(() => sessionSnapshot(state), [state]);
  const baseMood = companionMood(state, resolved);
  const mood = celebrating && baseMood === "idle" ? "completed" : baseMood;

  function update(next: CompanionPreferences, persist = true) {
    preferencesRef.current = next;
    setPreferences(next);
    if (persist) writeCompanionPreferences(storage(), next);
  }

  useEffect(() => {
    const saved = readCompanionPreferences(storage());
    const next = { ...saved, position: saved.position ? clampPosition(saved.position, viewport()) : defaultPosition(viewport()) };
    preferencesRef.current = next;
    setPreferences(next);
    setReady(true);
    function resize() {
      const current = preferencesRef.current;
      const position = clampPosition(current.position ?? defaultPosition(viewport()), viewport());
      const nextPreferences = { ...current, position };
      preferencesRef.current = nextPreferences;
      setPreferences(nextPreferences);
      writeCompanionPreferences(storage(), nextPreferences);
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    function resolvedInteraction(event: Event) {
      const detail = (event as CustomEvent<InteractionResolvedDetail>).detail;
      if (!detail || typeof detail.interactionId !== "string" || detail.interactionId.length > 1024) return;
      setResolved((current) => new Set([...current, detail.interactionId].slice(-1000)));
    }
    window.addEventListener(INTERACTION_RESOLVED_EVENT, resolvedInteraction);
    return () => window.removeEventListener(INTERACTION_RESOLVED_EVENT, resolvedInteraction);
  }, []);

  useEffect(() => {
    if (shouldCelebrateCompletion(previous.current, snapshot)) setCelebrating(true);
    else if (snapshot.status !== "completed" || snapshot.isReplay) setCelebrating(false);
    previous.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 2100);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  useEffect(() => {
    if (!waving) return;
    const timer = window.setTimeout(() => setWaving(false), 850);
    return () => window.clearTimeout(timer);
  }, [waving]);

  useEffect(() => () => {
    importSequence.current++;
    if (spriteUrl.current) URL.revokeObjectURL(spriteUrl.current);
  }, []);

  function reset() {
    update({ ...preferencesRef.current, position: defaultPosition(viewport()) });
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      reset();
    } else if (steps[event.key]) {
      event.preventDefault();
      const step = event.shiftKey ? 32 : 8;
      const current = preferencesRef.current;
      const position = current.position ?? defaultPosition(viewport());
      update({ ...current, position: clampPosition({
        x: position.x + steps[event.key][0] * step,
        y: position.y + steps[event.key][1] * step,
      }, viewport()) });
    }
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      origin: preferencesRef.current.position ?? defaultPosition(viewport()), moved: false,
    };
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = drag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - currentDrag.startX;
    const dy = event.clientY - currentDrag.startY;
    if (!currentDrag.moved && Math.hypot(dx, dy) < 4) return;
    currentDrag.moved = true;
    suppressClick.current = true;
    setDragging(true);
    update({ ...preferencesRef.current, position: clampPosition({
      x: currentDrag.origin.x + dx, y: currentDrag.origin.y + dy,
    }, viewport()) }, false);
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    suppressClick.current = drag.current.moved;
    drag.current = null;
    setDragging(false);
    writeCompanionPreferences(storage(), preferencesRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function hide() {
    update({ ...preferencesRef.current, hidden: true });
    requestAnimationFrame(() => restoreButton.current?.focus());
  }

  function restore() {
    const current = preferencesRef.current;
    update({ hidden: false, position: clampPosition(current.position ?? defaultPosition(viewport()), viewport()) });
    requestAnimationFrame(() => petButton.current?.focus());
  }

  async function importSprite(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const sequence = ++importSequence.current;
    if (!["image/png", "image/webp"].includes(file.type) || file.size > MAX_SPRITE_BYTES) {
      setImportError(true);
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const version = spriteVersion(image.naturalWidth, image.naturalHeight);
      if (!version) throw new Error("Invalid sprite dimensions");
      if (sequence !== importSequence.current) { URL.revokeObjectURL(url); return; }
      if (spriteUrl.current) URL.revokeObjectURL(spriteUrl.current);
      spriteUrl.current = url;
      setSprite({ url, version });
      setImportError(false);
    } catch {
      URL.revokeObjectURL(url);
      if (sequence === importSequence.current) setImportError(true);
    }
  }

  function useOriginal() {
    importSequence.current++;
    if (spriteUrl.current) URL.revokeObjectURL(spriteUrl.current);
    spriteUrl.current = null;
    setSprite(null);
    setImportError(false);
  }

  if (!ready || !preferences.position) return null;
  if (preferences.hidden) return (
    <button ref={restoreButton} type="button" data-companion="restore" className={styles.restore} onClick={restore}>
      <PawPrint size={14} aria-hidden="true" />{copy.restore}
    </button>
  );

  return (
    <aside data-companion="visible" data-mood={mood} data-dragging={dragging || undefined}
      className={styles.root} aria-label={copy.name}
      style={{ left: preferences.position.x, top: preferences.position.y }}>
      <button ref={petButton} type="button" className={styles.pet} aria-label={copy.name + ". " + copy.keys} title={copy.keys}
        onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
        onClick={(event) => {
          if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; }
          setWaving(true);
        }}>
        {sprite ? <SpriteArt url={sprite.url} version={sprite.version} mood={mood} /> : <CompanionArt mood={mood} waving={waving} />}
      </button>
      <span role="status" className={styles.status}><span className={styles.dot} />{copy[mood]}</span>
      <div className={styles.controls}>
        <button type="button" onClick={reset} title={copy.reset} aria-label={copy.reset}><Home size={14} aria-hidden="true" /></button>
        <button type="button" onClick={sprite ? useOriginal : () => input.current?.click()}
          title={sprite ? copy.builtin : copy.import} aria-label={sprite ? copy.builtin : copy.import}>
          {sprite ? <PawPrint size={14} aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />}
        </button>
        <button type="button" onClick={hide} title={copy.hide} aria-label={copy.hide}><X size={14} aria-hidden="true" /></button>
      </div>
      <input ref={input} type="file" accept="image/png,image/webp" hidden onChange={importSprite} />
      {importError && <span role="alert" className={styles.error}>{copy.fileError}</span>}
    </aside>
  );
}
