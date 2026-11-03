const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function load(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(result.outputText, filename);
  return loaded.exports;
}
const positions = load("lib/companion/preferences.ts");
const moods = load("lib/companion/state.ts");
const turn = (id, status = "running") => ({ kind: "turn", id, status });
const item = (id, type, extra = {}) => ({ kind: "item", id, item: { id, type, ...extra } });
function session(extra = {}) {
  return { status: "running", isReplay: false, threadId: "live", sessionMeta: null,
    resumeSessionId: null, error: null, timeline: [turn("t1")], ...extra };
}

test("companion keeps the complete control footprint in desktop and narrow viewports", () => {
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 320, height: 568 },
    { width: 120, height: 140 }, { width: 16, height: 16 },
  ]) {
    for (const point of [{ x: -100, y: -50 }, { x: 999999, y: 999999 }]) {
      const result = positions.clampPosition(point, viewport);
      assert.ok(result.x >= 0 && result.y >= 0);
      assert.ok(result.x + Math.min(128, viewport.width - 16) <= viewport.width);
      assert.ok(result.y + Math.min(154, viewport.height - 16) <= viewport.height);
    }
  }
  const desktop = positions.defaultPosition({ width: 1440, height: 900 });
  assert.equal(desktop.y, 88, "default pet stays above the composer");
  assert.deepEqual(positions.clampPosition(desktop, { width: 320, height: 400 }), { x: 184, y: 88 });
  assert.deepEqual(positions.clampPosition({ x: NaN, y: Infinity }, { width: 320, height: 400 }), { x: 8, y: 8 });
});

test("companion storage handles corrupt, incompatible, oversized and unavailable data", () => {
  for (const raw of ["{", "null", "[]", "1", '{"version":2}', '{"version":1,"position":{"x":"1","y":2}}', "x".repeat(3000)]) {
    assert.deepEqual(positions.readCompanionPreferences({ getItem: () => raw }), { position: null, hidden: false });
  }
  const read = (position, hidden = true) => positions.readCompanionPreferences({
    getItem: () => JSON.stringify({ version: 1, position, hidden }),
  });
  assert.deepEqual(read({ x: 22, y: 55 }), { position: { x: 22, y: 55 }, hidden: true });
  assert.deepEqual(read({ x: 99999999999, y: 55 }, "true"), { position: null, hidden: false });
  assert.deepEqual(positions.readCompanionPreferences({ getItem: () => { throw new Error("blocked"); } }),
    { position: null, hidden: false });
  assert.doesNotThrow(() => positions.writeCompanionPreferences({ setItem: () => { throw new Error("full"); } },
    { position: { x: 22, y: 55 }, hidden: true }));
  let written;
  const storage = { getItem: () => written, setItem: (_key, value) => { written = value; } };
  const preferences = { position: { x: 22, y: 55 }, hidden: true };
  positions.writeCompanionPreferences(storage, preferences);
  assert.deepEqual(positions.readCompanionPreferences(storage), preferences);
});

test("companion attention follows only relevant unresolved current turn questions", () => {
  const question = item("q1", "user_input_request", { interactionId: "input-1" });
  const active = session({ timeline: [turn("old", "completed"), item("old-q", "user_input_request", { interactionId: "old" }), turn("t1"), question] });
  assert.equal(moods.companionMood(active), "attention");
  assert.equal(moods.companionMood(active, new Set(["different-input"])), "attention");
  assert.equal(moods.companionMood(active, new Set(["input-1"])), "running");
  assert.equal(moods.companionMood({ ...active, timeline: [...active.timeline, item("reason", "reasoning")] }), "running");
  assert.equal(moods.companionMood({ ...active, timeline: [turn("old", "completed"), question] }), "running");
  assert.equal(moods.companionMood({ ...active, status: "completed" }), "idle");
  assert.equal(moods.companionMood({ ...active, isReplay: true }), "idle");
  const secondQuestion = item("q2", "user_input_request", { interactionId: "input-2" });
  assert.equal(moods.companionMood({ ...active, timeline: [...active.timeline, secondQuestion] }, new Set(["input-1"])), "attention");
  assert.equal(moods.companionMood({ ...active, timeline: [...active.timeline, secondQuestion] }, new Set(["input-2"])), "attention");
  assert.equal(moods.companionMood({ ...active, timeline: [...active.timeline, secondQuestion] }, new Set(["input-1", "input-2"])), "running");
});

test("warnings and recovered errors do not keep companion in attention", () => {
  assert.equal(moods.companionMood(session({ error: "warning" })), "running");
  const timeline = [turn("t1"), item("warning", "error", { severity: "warning" })];
  assert.equal(moods.companionMood(session({ timeline })), "running");
  timeline.push(item("fatal", "error", { severity: "error" }));
  assert.equal(moods.companionMood(session({ timeline })), "attention");
  timeline.push(item("recovered", "agent_message"));
  assert.equal(moods.companionMood(session({ timeline })), "running");
  assert.equal(moods.companionMood(session({ status: "failed" })), "attention");
  assert.equal(moods.companionMood(session({ status: "failed", isReplay: true })), "idle");
  assert.equal(moods.companionMood(session({ status: "aborted" })), "idle");
});

test("only an observed live completion celebrates, never replay or switching historical chats", () => {
  const running = moods.sessionSnapshot(session());
  const completed = { ...running, status: "completed" };
  assert.equal(moods.shouldCelebrateCompletion(running, completed), true);
  assert.equal(moods.shouldCelebrateCompletion(null, completed), false);
  assert.equal(moods.shouldCelebrateCompletion(completed, completed), false);
  assert.equal(moods.shouldCelebrateCompletion(running, { ...completed, sessionId: "another" }), false);
  assert.equal(moods.shouldCelebrateCompletion(running, { ...completed, turnId: "t2" }), false);
  assert.equal(moods.shouldCelebrateCompletion({ ...running, isReplay: true }, completed), false);
  assert.equal(moods.shouldCelebrateCompletion(running, { ...completed, isReplay: true }), false);
  assert.equal(moods.shouldCelebrateCompletion({ ...running, status: "failed" }, completed), false);
  assert.equal(moods.shouldCelebrateCompletion({ ...running, sessionId: null, turnId: null }, completed), true);
});

test("sprite importer accepts only supported v1/v2 atlas dimensions", () => {
  assert.equal(positions.spriteVersion(1536, 1872), 1);
  assert.equal(positions.spriteVersion(1536, 2288), 2);
  for (const dimensions of [[768, 1144], [1536, 208], [2288, 1536], [NaN, 2288], [1536, 2288.1]]) {
    assert.equal(positions.spriteVersion(...dimensions), null);
  }
});
