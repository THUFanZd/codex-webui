# Conversation organization

Implement the two agreed entry points in the existing local client:
- A composer mode for subsequent turns: normal, tree, or folded.
- An editor for an inclusive, contiguous range of complete question/answer turns.

Tree regions are attached to the preceding answer. Sibling questions can be saved as
local drafts before sending; a branch can receive further nested follow-ups. Sending
remains serial in the same Codex session. Folded regions include prompts, execution
events and final replies, with urgent questions/errors still accessible.

Keep layout metadata, drafts and expansion state in browser storage per session.
Use stable question-order keys across live execution and historical replay. Preserve
the original chronological event stream. Regrouping is reversible and cannot create
gaps in a selected historical range. No topic detection or automatic classification.

Implementation:
1. Add pure turn projection, range validation, grouping and storage helpers.
2. Wire a session-scoped layout provider to the composer and timeline.
3. Reuse existing event/Diff cards within virtualized turns and collapsible tree regions.
4. Add the range editor and localized, keyboard-accessible controls.
5. Verify model transitions, persistence, rendering and interactions with the showcase;
   run tests, lint and production build, update both READMEs and DEVELOPMENT, commit.
