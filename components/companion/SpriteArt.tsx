"use client";

import { useEffect, useState } from "react";
import type { CompanionMood } from "@/lib/companion/state";
import type { SpriteVersion } from "@/lib/companion/preferences";
import styles from "./WebCompanion.module.css";

const ANIMATIONS = {
  idle: { row: 0, times: [280, 110, 110, 140, 140, 320] },
  running: { row: 7, times: [120, 120, 120, 120, 120, 220] },
  attention: { row: 6, times: [150, 150, 150, 150, 150, 260] },
  completed: { row: 4, times: [140, 140, 140, 140, 280] },
} as const;

export function SpriteArt({ url, version, mood }: { url: string; version: SpriteVersion; mood: CompanionMood }) {
  const [frame, setFrame] = useState({ mood, index: 0 });
  const animation = ANIMATIONS[mood];
  const index = frame.mood === mood ? frame.index : 0;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    function animate() {
      clearTimeout(timer);
      setFrame({ mood, index: 0 });
      // Attention is a stable expectant pose. Idle stays still to keep the page quiet.
      if (media.matches || mood === "idle" || mood === "attention") return;
      let nextIndex = 0;
      function tick() {
        if (mood === "completed" && nextIndex === animation.times.length - 1) return;
        nextIndex = (nextIndex + 1) % animation.times.length;
        setFrame({ mood, index: nextIndex });
        timer = setTimeout(tick, animation.times[nextIndex]);
      }
      timer = setTimeout(tick, animation.times[0]);
    }
    animate();
    media.addEventListener("change", animate);
    return () => { clearTimeout(timer); media.removeEventListener("change", animate); };
  }, [animation, mood, url]);

  return <span aria-hidden="true" className={styles.sprite} style={{
    backgroundImage: `url("${url}")`,
    backgroundSize: `800% ${version === 2 ? 1100 : 900}%`,
    backgroundPosition: `${index / 7 * 100}% ${animation.row / (version === 2 ? 10 : 8) * 100}%`,
  }} />;
}
