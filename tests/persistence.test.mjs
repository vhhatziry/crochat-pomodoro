import test from "node:test";
import assert from "node:assert/strict";
import { createWriteQueue, repairPatternIds, uniqueLibraryPaths } from "../src/store/writeQueue.ts";

test("slow writes stay ordered and each snapshot preserves its own edits", async () => {
  const writes = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const queue = createWriteQueue(async (value) => {
    if (writes.length === 0) await gate;
    writes.push(value);
  });
  const source = [{ id: "one", body: "primera vuelta" }];
  const first = queue.save(source);
  source[0].body = "segunda vuelta";
  const second = queue.save(source);
  source[0].body = "cambio todavía sin guardar";
  release();
  await Promise.all([first, second, queue.flush()]);
  assert.deepEqual(writes.map((items) => items[0].body), ["primera vuelta", "segunda vuelta"]);
});

test("failed saves block closing, but a successful retry recovers", async () => {
  let fail = true;
  const queue = createWriteQueue(async () => { if (fail) throw new Error("disk full"); });
  await assert.rejects(queue.save([]), /disk full/);
  await assert.rejects(queue.flush(), /disk full/);
  fail = false;
  await queue.save([]);
  await queue.flush();
});

test("legacy repeated IDs are repaired without losing any pattern or notes", () => {
  const patterns = [{ id: "legacy", body: "uno" }, { id: "legacy", body: "dos" }, { id: "", body: "tres" }];
  const repaired = repairPatternIds(patterns);
  assert.equal(new Set(repaired.map((p) => p.id)).size, 3);
  assert.deepEqual(repaired.map((p) => p.body), ["uno", "dos", "tres"]);
  assert.equal(repaired[0].id, "legacy");
  assert.equal(patterns[1].id, "legacy");
});

test("Windows library paths ignore case and slash differences, keeping the first path", () => {
  assert.deepEqual(uniqueLibraryPaths(["C:\\Patrones\\Oso.pdf", "c:/patrones/oso.pdf", "C:/Patrones/Gato.pdf"]), ["C:\\Patrones\\Oso.pdf", "C:/Patrones/Gato.pdf"]);
});

test("closing waits for edits queued during an earlier disk write", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const writes = [];
  const queue = createWriteQueue(async (value) => {
    if (value === 1) await gate;
    writes.push(value);
  });
  void queue.save(1);
  const closing = queue.flush();
  void queue.save(2);
  release();
  await closing;
  assert.deepEqual(writes, [1, 2]);
});
