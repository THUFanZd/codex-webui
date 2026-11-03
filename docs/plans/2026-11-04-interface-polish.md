# Interface polish and companion implementation plan

> Execution: two isolated worktrees with subagent implementation, followed by independent specification review, code review, integration, and browser verification.

**Goal:** Refine the existing conversation workspace and add an optional draggable web companion while preserving tree/fold workflows and Codex execution behavior.

**Architecture:** Keep the current Next.js/React application, session store, and conversation layout data model. Visual changes own the workspace and conversation components; the companion owns separate components, styles, and state helpers. Integrate the companion once at AppShell level after both branches are reviewed.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS, CSS/SVG animation, existing synthetic showcase and Node tests.

## Design direction and scope

- Recommend a quiet discussion workspace: blue-grey surfaces, a restrained periwinkle discussion accent, readable Chinese text, and visible structural connectors. Alternative full canvas navigation would increase interaction changes; cinematic continuous animation would compete with reading. Preserve current scrolling conversation.
- Palette baseline: paper #F7F8FC, light surface #FFFFFF, ink #252B3D, discussion #5967BE, dark canvas #151824, dark surface #1D2130. Final colors must satisfy readable contrast in both themes.
- Type: use installed system sans fonts with a deliberate Chinese/Latin scale; monospace only for code and paths. Comfortable message width, clear prompts/answers, quieter process details.
- Motion: brief feedback for user-triggered disclosure, mode changes, and sending. Respect reduced motion and virtualization measurements. HyperFrames is a design reference for timing/composition, not a runtime dependency.
- Companion: investigate official Codex docs and locally available assets first. Prefer an original self-contained animated web companion if no supported reusable desktop component exists. A web overlay stays inside its browser viewport. Support drag, keyboard positioning, hide/show, remembered position, viewport clamping, reduced motion, and idle/running/attention/completed states derived from the existing session.
- Preserve existing normal/tree/fold mode, draft queue, contiguous range organization, persistence, execution configuration, and shared session semantics. No automatic topic detection, new backend, forked model context, video export, or app-wide pet-setting changes.

## Task 1: Visual worktree

Files: app/globals.css; components/layout/{Sidebar,TopBar}.tsx; components/session/{Composer,EventTimeline,ConversationRegion,ConversationTurnCard,MessageRangeEditor}.tsx; shared UI styles as necessary. Do not edit AppShell.tsx, session stores, or companion files.

1. Inspect current showcase and identify concrete hierarchy/spacing weaknesses.
2. Refine theme tokens, workspace chrome, message rhythm, composer mode selection, branch connectors, compact folded records, editor and draft queue.
3. Add restrained CSS transitions with reduced-motion handling; retain focus states and mobile operation.
4. Check types/lint and existing tests; self-review keyboard/scroll/expand behavior. Document usage and architecture in README.md, README.zh-CN.md, DEVELOPMENT.md. Commit all scoped changes.

## Task 2: Companion worktree

Files: new components/companion/*; lib/companion/*; tests/companion.test.cjs; docs/pet-research.md; local public companion assets if needed. Do not edit AppShell.tsx, globals.css, or existing conversation components.

1. Research the installed Codex desktop companion and official docs. Record verified implementation/format facts separately from inference, with source links. Do not alter the desktop app or its pet configuration.
2. Build a self-contained accessible Companion component with local styling and original visual asset, supporting pointer capture dragging, keyboard movement, show/hide, persistent position, resize clamping, and reduced motion.
3. Derive status from the existing active session: idle, running, attention on actionable user-input requests/errors, brief completion feedback. Avoid replaying old completed turns as new completion events.
4. Unit-test state derivation and position/persistence rules where meaningful; typecheck/lint. Document usage and architecture in all three docs. Commit scoped changes and report the single AppShell integration line.

## Task 3: Independent review and integration

1. Review each branch for scope/spec compliance. Resolve gaps before quality review.
2. Review reliability, state derivation, storage validation, accessibility, styles, and responsive behavior. Have implementers fix material findings.
3. Merge reviewed branches into feature/interface-polish; resolve shared docs deliberately. Add the companion to AppShell without changing session provider lifetimes.
4. Run npm.cmd test, TypeScript noEmit, ESLint for changed code, and an isolated NEXT_DIST_DIR production build.
5. Run a separate local preview without touching the user's existing server. Browser-test tree drafts, nested followup, fold/unfold, continuous range editor, theme switching, narrow viewport, reduced motion, companion drag/hide/restore/persistence and state transitions using synthetic showcase data.
6. Inspect screenshots, fix visual defects, commit integration and report exact commits, worktree path, verification and preview instructions. Leave worktrees and assets intact; no file deletion and no push/deploy.