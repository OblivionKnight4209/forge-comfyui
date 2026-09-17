import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextGenerateSeed, sameStillMeansSameSeed } from "./seed.ts";

describe("seed", () => {
  it("unlocked generate gets a new seed", () => {
    const a = nextGenerateSeed(42, false);
    assert.notEqual(a, 42);
  });
  it("locked or remake keeps the seed", () => {
    assert.equal(nextGenerateSeed(42, true), 42);
    assert.equal(nextGenerateSeed(42, false, true), 42);
  });
  it("same seed + prompt + checkpoint is the same picture", () => {
    const shot = { seed: 7, prompt: "cat", checkpoint: "xl.safetensors" };
    assert.equal(sameStillMeansSameSeed(shot, shot), true);
    assert.equal(sameStillMeansSameSeed(shot, { ...shot, seed: 8 }), false);
  });
});
