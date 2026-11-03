import type { CompanionMood } from "@/lib/companion/state";
import styles from "./WebCompanion.module.css";

/** Original vector artwork; no desktop application artwork is bundled. */
export function CompanionArt({ mood, waving }: { mood: CompanionMood; waving: boolean }) {
  return (
    <svg viewBox="0 0 112 112" aria-hidden="true" className={styles.art}>
      <ellipse cx="56" cy="101" rx="29" ry="4" fill="currentColor" opacity=".1" />
      <g className={`${styles.character} ${waving ? styles.waving : ""}`}>
        <path d="M78 77q25-6 18 12q-3 7-15 3" fill="none" stroke="#66a89d" strokeWidth="9" strokeLinecap="round" />
        <path d="M32 67q-4 17 2 26q21 11 43 0q7-15 0-27" fill="#66a89d" stroke="#244d4a" strokeWidth="2.5" />
        <path className={styles.leftFoot} d="M39 92v8h10v-8" fill="#e9d7b0" stroke="#244d4a" strokeWidth="2.5" strokeLinejoin="round" />
        <path className={styles.rightFoot} d="M65 92v8h10v-8" fill="#e9d7b0" stroke="#244d4a" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M24 40L21 17q0-6 7-2l18 12M68 27l18-13q7-4 6 4l-3 25" fill="#66a89d" stroke="#244d4a" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M28 29l-1-7 9 7M79 28l8-7-1 10" fill="#dfa9a4" />
        <path d="M20 47q1-26 35-25q37 0 38 26l-4 20q-7 14-33 14q-28 0-35-14Z" fill="#82b9aa" stroke="#244d4a" strokeWidth="2.5" />
        <path d="M29 53q1-13 27-13q26 0 28 13v11q-4 11-28 11q-22 0-27-11Z" fill="#f8edd4" />
        <g className={styles.eyes}>
          {mood === "completed" || waving ? (
            <path d="M38 56q4-7 8 0M66 56q4-7 8 0" stroke="#244d4a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          ) : (
            <><ellipse cx="42" cy={mood === "attention" ? 54 : 56} rx="3" ry={mood === "attention" ? 4.5 : 4} fill="#244d4a" /><ellipse cx="70" cy={mood === "attention" ? 54 : 56} rx="3" ry={mood === "attention" ? 4.5 : 4} fill="#244d4a" /></>
          )}
        </g>
        <path d="m53 61 3 2 3-2M56 63v3" stroke="#244d4a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="34" cy="63" rx="4.5" ry="2.5" fill="#e3a39e" opacity=".65" />
        <ellipse cx="78" cy="63" rx="4.5" ry="2.5" fill="#e3a39e" opacity=".65" />
        <path d="M32 76q22 8 47-1l-3 9q-21 8-43 0Z" fill="#8f82b7" stroke="#244d4a" strokeWidth="2" />
        <path d="m65 83 11 2-5 12-10-4Z" fill="#a396c7" stroke="#244d4a" strokeWidth="2" strokeLinejoin="round" />
        <path className={styles.paw} d="M29 82q-12-9-13 1q-1 8 15 10" fill="#82b9aa" stroke="#244d4a" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {mood === "attention" && <g><circle cx="92" cy="26" r="11" fill="#f5d98e" stroke="#785c1d" strokeWidth="1.5" /><path d="M92 20v7m0 5v.2" stroke="#785c1d" strokeWidth="2.5" strokeLinecap="round" /></g>}
      {mood === "completed" && <path d="m88 20 4 5 9-10" stroke="#438b70" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
    </svg>
  );
}
