"use strict";

// Small, dependency-free DSP and note-event utilities used by Bloxify.
// Keep these deterministic so audio preprocessing can be tested without loading
// TensorFlow or downloading the Basic Pitch model.

function downmixChannels(channelData) {
  const channels = (Array.isArray(channelData) ? channelData : [])
    .filter(channel => channel && typeof channel.length === "number");
  if (!channels.length) return new Float32Array(0);
  const length = Math.min(...channels.map(channel => channel.length));
  if (!length) return new Float32Array(0);
  if (channels.length === 1) return Float32Array.from(channels[0]);

  // Use the strongest channel as a reference and correct globally inverted
  // channels before averaging. This avoids the common anti-phase stereo case
  // where a naïve L/R average erases bass and quiet notes.
  let referenceIndex = 0;
  let strongestEnergy = -1;
  for (let c = 0; c < channels.length; c += 1) {
    let energy = 0;
    const stride = Math.max(1, Math.floor(length / 8192));
    for (let i = 0; i < length; i += stride) {
      const value = Number(channels[c][i]) || 0;
      energy += value * value;
    }
    if (energy > strongestEnergy) {
      strongestEnergy = energy;
      referenceIndex = c;
    }
  }
  const reference = channels[referenceIndex];
  const signs = channels.map((channel, c) => {
    if (c === referenceIndex) return 1;
    let dot = 0;
    let refEnergy = 0;
    let channelEnergy = 0;
    const stride = Math.max(1, Math.floor(length / 16384));
    for (let i = 0; i < length; i += stride) {
      const a = Number(reference[i]) || 0;
      const b = Number(channel[i]) || 0;
      dot += a * b;
      refEnergy += a * a;
      channelEnergy += b * b;
    }
    const correlation = dot / Math.sqrt(Math.max(1e-20, refEnergy * channelEnergy));
    return correlation < -0.15 ? -1 : 1;
  });

  const output = new Float32Array(length);
  const scale = 1 / channels.length;
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let c = 0; c < channels.length; c += 1) {
      sum += (Number(channels[c][i]) || 0) * signs[c];
    }
    output[i] = sum * scale;
  }
  return output;
}


function normalizeForPitchDetection(samples, options = {}) {
  if (!samples || !samples.length) return new Float32Array(0);
  const maxGain = Number.isFinite(options.maxGain) ? Math.max(1, options.maxGain) : 4;
  let mean = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = Number(samples[i]) || 0;
    mean += value;
    peak = Math.max(peak, Math.abs(value));
  }
  mean /= samples.length;
  // Silence is left silent so normalization never turns digital silence into
  // apparent notes. Remove DC bias before estimating the safe gain.
  if (peak < 1e-5) return Float32Array.from(samples, () => 0);
  let centeredPeak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    centeredPeak = Math.max(centeredPeak, Math.abs((Number(samples[i]) || 0) - mean));
  }
  if (centeredPeak < 1e-5) return Float32Array.from(samples, () => 0);
  const gain = Math.min(maxGain, 0.95 / centeredPeak);
  const output = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const value = ((Number(samples[i]) || 0) - mean) * gain;
    output[i] = Math.max(-0.98, Math.min(0.98, value));
  }
  return output;
}

function sinc(x) {
  if (Math.abs(x) < 1e-8) return 1;
  const pix = Math.PI * x;
  return Math.sin(pix) / pix;
}

function resample(samples, fromRate, toRate) {
  if (!samples || !samples.length || !(fromRate > 0) || !(toRate > 0)) {
    return new Float32Array(0);
  }
  if (fromRate === toRate) return Float32Array.from(samples);

  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(outputLength);

  // A windowed-sinc low-pass kernel prevents aliasing when reducing sample
  // rate. Precompute fractional phases so long uploads do not call sin/cos
  // for every output sample.
  const radius = 8;
  const taps = radius * 2;
  const phases = 1024;
  const cutoff = Math.min(1, toRate / fromRate) * 0.94;
  const kernels = new Array(phases);
  for (let phase = 0; phase < phases; phase += 1) {
    const fraction = phase / phases;
    const kernel = new Float64Array(taps);
    let sum = 0;
    for (let tap = 0; tap < taps; tap += 1) {
      const offset = tap - radius + 1;
      const x = offset - fraction;
      const normalized = x / radius;
      let window = 0;
      if (Math.abs(normalized) <= 1) {
        // Blackman window gives useful stop-band rejection with a short kernel.
        window = 0.42 + 0.5 * Math.cos(Math.PI * normalized) +
          0.08 * Math.cos(2 * Math.PI * normalized);
      }
      const weight = cutoff * sinc(cutoff * x) * window;
      kernel[tap] = weight;
      sum += weight;
    }
    if (Math.abs(sum) > 1e-12) {
      for (let tap = 0; tap < taps; tap += 1) kernel[tap] /= sum;
    }
    kernels[phase] = kernel;
  }

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    let center = Math.floor(position);
    let phase = Math.round((position - center) * phases);
    if (phase >= phases) {
      center += 1;
      phase = 0;
    }
    const kernel = kernels[phase];
    let value = 0;
    let weightSum = 0;
    for (let tap = 0; tap < taps; tap += 1) {
      const sampleIndex = center + tap - radius + 1;
      if (sampleIndex < 0 || sampleIndex >= samples.length) continue;
      const weight = kernel[tap];
      value += samples[sampleIndex] * weight;
      weightSum += weight;
    }
    output[i] = Math.abs(weightSum) > 1e-8 ? value / weightSum : 0;
  }
  return output;
}

function mergeNotePasses(passes, options = {}) {
  const onsetTolerance = Number.isFinite(options.onsetTolerance)
    ? Math.max(0.005, options.onsetTolerance)
    : 0.045;
  const groups = [];
  const lists = Array.isArray(passes) ? passes : [];

  // Pass order is intentional: the first pass is the strictest and therefore
  // wins when multiple thresholds detect the same event. Sensitive passes
  // still contribute unique quiet/short events instead of being discarded.
  lists.forEach((list, passIndex) => {
    const candidates = (Array.isArray(list) ? list : [])
      .filter(note => note &&
        Number.isFinite(note.pitchMidi) &&
        Number.isFinite(note.startTimeSeconds) &&
        Number.isFinite(note.durationSeconds) &&
        note.pitchMidi >= 0 && note.pitchMidi <= 127 &&
        note.startTimeSeconds >= 0 && note.durationSeconds >= 0.025)
      .slice()
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

    candidates.forEach(note => {
      const pitch = Math.round(note.pitchMidi);
      let bestGroup = null;
      let bestDistance = Infinity;
      for (const group of groups) {
        if (group.pitch !== pitch || group.byPass.has(passIndex)) continue;
        const distance = Math.abs(group.anchor.startTimeSeconds - note.startTimeSeconds);
        if (distance <= onsetTolerance && distance < bestDistance) {
          // If note events are separated by a real gap, don't fuse them just
          // because the same pitch happens nearby. Similar end times indicate
          // that these are alternate threshold detections of one event.
          const aEnd = group.anchor.startTimeSeconds + group.anchor.durationSeconds;
          const bEnd = note.startTimeSeconds + note.durationSeconds;
          const overlap = Math.min(aEnd, bEnd) - Math.max(group.anchor.startTimeSeconds, note.startTimeSeconds);
          const shorter = Math.max(0.001, Math.min(group.anchor.durationSeconds, note.durationSeconds));
          const relatedEnds = Math.abs(aEnd - bEnd) <= Math.max(0.12, shorter * 0.6);
          if (overlap > 0 || relatedEnds) {
            bestGroup = group;
            bestDistance = distance;
          }
        }
      }
      if (bestGroup) {
        bestGroup.candidates.push({ note, passIndex });
        bestGroup.byPass.add(passIndex);
      } else {
        const group = {
          pitch,
          anchor: note,
          candidates: [{ note, passIndex }],
          byPass: new Set([passIndex]),
        };
        groups.push(group);
      }
    });
  });

  return groups.map(group => {
    group.candidates.sort((a, b) => a.passIndex - b.passIndex);
    const chosen = group.candidates[0].note;
    return {
      ...chosen,
      // Keep the representative note's pitch/onset/duration; never average
      // separate attacks or quantize the performance to a grid.
      pitchMidi: Number(chosen.pitchMidi),
      startTimeSeconds: Number(chosen.startTimeSeconds),
      durationSeconds: Number(chosen.durationSeconds),
    };
  }).sort((a, b) =>
    a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi
  );
}

module.exports = { downmixChannels, normalizeForPitchDetection, resample, mergeNotePasses };
