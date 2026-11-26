import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "zlib";
import { findUserRecords, shardNumber, pageOf, createShardStore } from "./archiveshards.js";

const shardText = [
  `15\t{"m":"a"}`,
  `156\t{"m":"one"}`,
  `156\t{"m":"two"}`,
  `1561\t{"m":"other"}`,
  `56\t{"m":"x"}`,
  `156\tnot json`,
].join("\n");

test("finds only the requested user's records", () => {
  assert.deepEqual(findUserRecords(shardText, "156").map((r) => r.m), ["one", "two"]);
  assert.deepEqual(findUserRecords(shardText, "15").map((r) => r.m), ["a"]);
  assert.deepEqual(findUserRecords(shardText, "56").map((r) => r.m), ["x"]);
  assert.deepEqual(findUserRecords(shardText, "1561").map((r) => r.m), ["other"]);
  assert.deepEqual(findUserRecords(shardText, "999"), []);
  assert.deepEqual(findUserRecords("", "1"), []);
});

test("shard numbers handle ids beyond 2^53", () => {
  assert.equal(shardNumber("156", 1000), 156);
  assert.equal(shardNumber("9007199254740993", 1000), 993);
});

test("pagination", () => {
  const list = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(pageOf(list, 0, 25).nextOffset, 25);
  assert.deepEqual(pageOf(list, 25, 25).items, [25, 26, 27, 28, 29]);
  assert.equal(pageOf(list, 25, 25).nextOffset, null);
  assert.equal(pageOf(list, "x", 9999).limit, 100);
});

test("store reads manifest and the right shard", async () => {
  const calls = [];
  const files = {
    "manifest.json": JSON.stringify({ shards: 10, prefix: "gw-s", suffix: ".txt.gz" }),
    "gw-s6.txt.gz": gzipSync(Buffer.from(shardText)),
  };
  const fetchImpl = async (url) => {
    calls.push(url);
    const name = url.split("/").pop().split("?")[0];
    if (!(name in files)) return new Response("", { status: 404 });
    return new Response(files[name], { status: 200 });
  };
  const store = createShardStore({ releaseBase: "https://x/rel", fetchImpl });
  const { records, shard } = await store.recordsFor("156");
  assert.equal(shard, "gw-s6.txt.gz");
  assert.equal(records.length, 2);
  await store.recordsFor("156");
  assert.equal(calls.filter((c) => c.includes("gw-s6")).length, 1, "shard is cached");
  const missing = await store.recordsFor("7");
  assert.deepEqual(missing.records, []);
});

test("unpublished archive reports a clear code", async () => {
  const store = createShardStore({ releaseBase: "https://x/rel", fetchImpl: async () => new Response("", { status: 404 }) });
  await assert.rejects(store.recordsFor("1"), (err) => err.code === "ARCHIVE_NOT_PUBLISHED");
});
