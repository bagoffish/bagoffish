"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { downmixChannels, resample, mergeNotePasses } = require("./bloxify-core.cjs");

test("phase-aware downmix preserves anti-phase stereo instead of cancelling it", () => {
  const left = Float32Array.from([0.2, -0.3, 0.4, -0.1, 0.25, -0.2]);
  const right = Float32Array.from(left, value => -value);
  const mono = downmixChannels([left, right]);
  assert.ok(mono.some(value => Math.abs(value) > 0.05));
  for (let i = 0; i < left.length; i += 1) assert.ok(Math.abs(mono[i] - left[i]) < 1e-6);
});

test("resampler preserves duration and a low-frequency tone", () => {
  const sourceRate = 48000;
  const targetRate = 22050;
  const seconds = 0.25;
  const samples = new Float32Array(sourceRate * seconds);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.sin(2 * Math.PI * 440 * i / sourceRate);
  }
  const result = resample(samples, sourceRate, targetRate);
  assert.equal(result.length, Math.floor(samples.length / (sourceRate / targetRate)));
  let crossings = 0;
  for (let i = 1; i < result.length; i += 1) {
    if (result[i - 1] <= 0 && result[i] > 0) crossings += 1;
  }
  assert.ok(Math.abs(crossings - 110) <= 2, `expected about 110 cycles, got ${crossings}`);
});

test("multi-pass merge collapses threshold duplicates but keeps distinct repeated attacks", () => {
  const primary = [
    { pitchMidi: 60, startTimeSeconds: 0.1, durationSeconds: 0.2, amplitude: 0.8 },
    { pitchMidi: 60, startTimeSeconds: 0.4, durationSeconds: 0.12, amplitude: 0.7 },
  ];
  const sensitive = [
    { pitchMidi: 60, startTimeSeconds: 0.12, durationSeconds: 0.21, amplitude: 0.3 },
    { pitchMidi: 64, startTimeSeconds: 0.2, durationSeconds: 0.08, amplitude: 0.18 },
    { pitchMidi: 60, startTimeSeconds: 0.41, durationSeconds: 0.11, amplitude: 0.25 },
  ];
  const result = mergeNotePasses([primary, sensitive]);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(note => Math.round(note.pitchMidi)), [60, 64, 60]);
  assert.equal(result[0].startTimeSeconds, 0.1);
  assert.equal(result[2].startTimeSeconds, 0.4);
});

test("merge keeps a note found only by a sensitive pass", () => {
  const result = mergeNotePasses([[], [
    { pitchMidi: 71, startTimeSeconds: 1.25, durationSeconds: 0.06, amplitude: 0.1 },
  ]]);
  assert.equal(result.length, 1);
  assert.equal(result[0].pitchMidi, 71);
});
