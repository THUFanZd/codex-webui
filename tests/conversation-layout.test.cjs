const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
function load(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output, filename);
  return loaded.exports;
}
const { conversationTurns, emptyLayout, regroupRange, layoutUnits, readLayout, branchPrompt, attachLayoutTurn } = load("lib/session/conversation-layout.ts");
const user = (id, text) => ({ kind: "item", id, item: { id, type: "user_message", text } });
const answer = (id, text) => ({ kind: "item", id, item: { id, type: "agent_message", text } });
const boundary = (id) => ({ kind: "turn", id, status: "completed" });
function history() {
  return conversationTurns([boundary("a"), user("u1", "Question A"), answer("a1", "Answer A"),
    boundary("b"), user("u2", "Question B"), answer("a2", "Answer B"),
    boundary("c"), user("u3", "Question C"), answer("a3", "Answer C")]);
}
test("live and replay ordering project to the same question keys and turn boundaries", () => {
  const live = conversationTurns([user("pending-1", "Question A"), boundary("a"), answer("a1", "Answer A"),
    user("pending-2", "Question B"), boundary("b"), answer("a2", "Answer B")]);
  const replay = history().slice(0, 2);
  assert.deepEqual(live.map((turn) => [turn.id, turn.boundary.id, turn.prompt.text]),
    replay.map((turn) => [turn.id, turn.boundary.id, turn.prompt.text]));
});
test("range grouping includes full prompts, process events and final replies without changing history", () => {
  const turns = history(), before = JSON.stringify(turns);
  const doc = regroupRange(emptyLayout(), turns, ["question-1", "question-2"], "fold", "fold-1");
  assert.equal(doc.groups[0].collapsed, true);
  assert.equal(doc.groups[0].anchorTurnId, "question-0");
  assert.deepEqual(layoutUnits(turns, doc).map((unit) => [unit.kind, unit.id]), [["turn", "question-0"], ["region", "fold-1"]]);
  assert.equal(JSON.stringify(turns), before);
  assert.deepEqual(layoutUnits(turns, emptyLayout()).map((unit) => unit.id), turns.map((turn) => turn.id));
});
test("history regrouping rejects gaps, duplicate selection and missing messages", () => {
  for (const selection of [[], ["question-0", "question-2"], ["question-0", "question-0"], ["missing"]]) {
    assert.throws(() => regroupRange(emptyLayout(), history(), selection, "tree", "tree"));
  }
});
test("regrouping overlapping ranges reparents surviving branches and retains drafts", () => {
  const turns = history();
  const doc = regroupRange(emptyLayout(), turns, turns.map((turn) => turn.id), "tree", "old");
  doc.groups[0].nodes[1].parentId = doc.groups[0].nodes[0].id;
  doc.groups[0].nodes[2].parentId = doc.groups[0].nodes[1].id;
  doc.drafts.push({ id: "draft", text: "Pending follow-up", groupId: "old", parentId: doc.groups[0].nodes[1].id });
  const regrouped = regroupRange(doc, turns, ["question-1"], "fold", "new");
  assert.equal(regrouped.groups[0].nodes[1].parentId, null);
  assert.equal(regrouped.drafts[0].parentId, null);
  assert.equal(regrouped.drafts[0].text, "Pending follow-up");
});
test("an unsent tree region is positioned immediately after its source answer", () => {
  const turns = history(), doc = emptyLayout();
  doc.groups.push({ id: "tree", type: "tree", title: "", anchorTurnId: "question-0", collapsed: false, nodes: [] });
  doc.drafts.push({ id: "draft", text: "Another question", groupId: "tree", parentId: null });
  assert.deepEqual(layoutUnits(turns, doc).map((unit) => unit.id), ["question-0", "tree", "question-1", "question-2"]);
});
test("session storage preserves nested relationships, drafts and collapse state independently", () => {
  const doc = regroupRange(emptyLayout(), history(), ["question-1", "question-2"], "tree", "tree");
  doc.groups[0].nodes[1].parentId = doc.groups[0].nodes[0].id;
  doc.groups[0].nodes[0].collapsed = true;
  doc.drafts.push({ id: "draft", text: "Saved question", groupId: "tree", parentId: null });
  const storage = { getItem: (key) => key === "session-A" ? JSON.stringify(doc) : null };
  assert.deepEqual(readLayout(storage, "session-A"), doc);
  assert.deepEqual(readLayout(storage, "session-B"), emptyLayout());
  doc.groups[0].nodes[0].parentId = doc.groups[0].nodes[1].id;
  assert.deepEqual(readLayout({ getItem: () => JSON.stringify(doc) }, "session-A"), emptyLayout());
  assert.deepEqual(readLayout({ getItem: () => "broken JSON" }, "session-A"), emptyLayout());
});
test("a branch follow-up carries its intended parent while keeping the displayed prompt compact", () => {
  const raw = branchPrompt("Explain this part", history()[0]);
  assert.ok(raw.includes("Question: Question A\nAnswer: Answer A"));
  assert.equal(load("lib/codex/user-message.ts").formatUserMessageForDisplay(raw), "Explain this part");
  assert.equal(branchPrompt("Ordinary message"), "Ordinary message");
});


test("sending a turn gives it exactly one owner and normal mode removes stale membership", () => {
  const turns = history();
  let doc = regroupRange(emptyLayout(), turns, ["question-1"], "tree", "old");
  doc.groups.push({ id: "new", type: "tree", title: "", anchorTurnId: "question-0", collapsed: false, nodes: [] });
  doc.mode = "tree"; doc.activeGroupId = "new";
  doc = attachLayoutTurn(doc, "question-1", "new-node");
  assert.equal(doc.groups.flatMap((group) => group.nodes).filter((node) => node.turnId === "question-1").length, 1);
  assert.equal(doc.groups.find((group) => group.id === "new").nodes[0].id, "new-node");
  doc.mode = "normal"; doc.activeGroupId = null;
  doc = attachLayoutTurn(doc, "question-1", "unused");
  assert.equal(doc.groups.flatMap((group) => group.nodes).length, 0);
});


test("a question added later stays under its source answer rather than the chronological tail", () => {
  const turns = history(), doc = emptyLayout();
  doc.groups.push({ id: "tree", type: "tree", title: "", anchorTurnId: "question-0", collapsed: false,
    nodes: [{ id: "later-question", turnId: "question-2", parentId: null, collapsed: false }] });
  assert.deepEqual(layoutUnits(turns, doc).map((unit) => unit.id), ["question-0", "tree", "question-1"]);
});
