// Prebaked old-Roblox MIDI song. Basic Pitch supplies the notes that were
// actually in the recording. The lead follows that tune. Bass, guitar, keys,
// pad, strings, arp, and drums all move, and the pattern changes by the bar
// so the song does not sit on one loop. A third is used only when it was
// heard. The arrangement runs to the end of the audio, up to 5 minutes.

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_TRIADS = [
  { degree: 0, minor: false },
  { degree: 2, minor: true },
  { degree: 4, minor: true },
  { degree: 5, minor: false },
  { degree: 7, minor: false },
  { degree: 9, minor: true },
];
const MINOR_TRIADS = [
  { degree: 0, minor: true },
  { degree: 3, minor: false },
  { degree: 5, minor: true },
  { degree: 7, minor: false },
  { degree: 8, minor: false },
  { degree: 10, minor: false },
];

function clampMidi(value) {
  return Math.max(24, Math.min(108, Math.round(value)));
}

function pushNote(target, role, pitchMidi, startTimeSeconds, durationSeconds, amplitude) {
  if (!Number.isFinite(startTimeSeconds) || !Number.isFinite(durationSeconds) || durationSeconds < 0.08) return;
  if (!Number.isFinite(pitchMidi)) return;
  target.push({
    id: 0,
    role,
    pitchMidi: clampMidi(pitchMidi),
    startTimeSeconds: Math.max(0, startTimeSeconds),
    durationSeconds,
    amplitude: Math.max(0.08, Math.min(0.92, amplitude)),
  });
}

function estimateBeatSeconds(notes) {
  const starts = notes.map(note => note.startTimeSeconds).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1];
    if (gap >= 0.18 && gap <= 1.05) gaps.push(gap);
  }
  if (gaps.length < 4) return 0.5;
  gaps.sort((a, b) => a - b);
  let beat = gaps[Math.floor(gaps.length / 2)];
  while (beat < 0.32) beat *= 2;
  while (beat > 0.78) beat *= 0.5;
  return beat;
}

function leadShift(melody) {
  if (!melody.length) return 0;
  const sorted = melody.map(note => note.pitchMidi).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let shift = 0;
  while (median + shift < 60) shift += 12;
  while (median + shift > 79) shift -= 12;
  return shift;
}

function placeBass(pitch) {
  let placed = Math.round(pitch);
  while (placed > 46) placed -= 12;
  while (placed < 33) placed += 12;
  return placed;
}

function pitchClassWeights(notes, start, end) {
  const weights = Array(12).fill(0);
  notes.forEach(note => {
    const noteEnd = note.startTimeSeconds + note.durationSeconds;
    const overlap = Math.min(end, noteEnd) - Math.max(start, note.startTimeSeconds);
    if (overlap <= 0.02) return;
    const pc = ((note.pitchMidi % 12) + 12) % 12;
    weights[pc] += overlap * (note.amplitude || 0.7);
  });
  return weights;
}

function scaleFor(minor) {
  return minor ? MINOR_SCALE : MAJOR_SCALE;
}

function inferKey(notes) {
  const weights = pitchClassWeights(notes, 0, 1e9);
  let best = { rootPc: 0, minor: false, score: -1e9 };
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    [false, true].forEach(minor => {
      const scale = new Set(scaleFor(minor).map(interval => (rootPc + interval) % 12));
      let score = 0;
      for (let pc = 0; pc < 12; pc++) {
        const rel = (pc - rootPc + 12) % 12;
        if (!scale.has(pc)) score -= weights[pc] * 0.85;
        else if (rel === 0) score += weights[pc] * 1.45;
        else if (rel === 7) score += weights[pc] * 1.15;
        else score += weights[pc];
      }
      if (score > best.score) best = { rootPc, minor, score };
    });
  }
  return best;
}

function triadFit(rootPc, minor, weights) {
  const third = minor ? 3 : 4;
  let heard = 0;
  let penalty = 0;
  for (let pc = 0; pc < 12; pc++) {
    const weight = weights[pc];
    if (weight <= 0) continue;
    const rel = (pc - rootPc + 12) % 12;
    if (rel === 0) heard += weight * 1.35;
    else if (rel === third) heard += weight * 1.2;
    else if (rel === 7) heard += weight * 1.05;
    else if (rel === 2 || rel === 5 || rel === 10 || rel === 11) heard += weight * 0.2;
    else penalty += weight * 0.7;
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;
  return (heard - penalty) / total;
}

function nearestPitch(pc, low, high, target) {
  const want = ((pc % 12) + 12) % 12;
  let best = null;
  let bestDist = 1e9;
  for (let pitch = low; pitch <= high; pitch++) {
    if (((pitch % 12) + 12) % 12 !== want) continue;
    const dist = Math.abs(pitch - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = pitch;
    }
  }
  return best;
}

function intervalClass(a, b) {
  const rel = Math.abs(a - b) % 12;
  return Math.min(rel, 12 - rel);
}

function isHarmonicOf(high, low) {
  const diff = Math.round(high.pitchMidi) - Math.round(low.pitchMidi);
  return (diff === 12 || diff === 19 || diff === 24) &&
    Math.abs(high.startTimeSeconds - low.startTimeSeconds) <= 0.05 &&
    (high.amplitude || 0) <= (low.amplitude || 0) * 0.92;
}

function cleanSource(notes) {
  const sorted = notes.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const kept = [];
  sorted.forEach(note => {
    if (note.durationSeconds < 0.06) return;
    if ((note.amplitude || 0) < 0.16 && note.durationSeconds < 0.14) return;
    if (note.pitchMidi >= 96 && (note.amplitude || 0) < 0.55) return;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (isHarmonicOf(note, kept[i])) return;
      if (isHarmonicOf(kept[i], note)) kept.splice(i, 1);
    }
    kept.push(note);
  });
  return kept;
}

function clusterNotes(notes, windowSeconds) {
  const sorted = notes.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const clusters = [];
  sorted.forEach(note => {
    const last = clusters[clusters.length - 1];
    if (!last || note.startTimeSeconds - last.time > windowSeconds) clusters.push({ time: note.startTimeSeconds, notes: [note] });
    else last.notes.push(note);
  });
  return clusters;
}

function smoothMelody(melody) {
  return melody.filter((note, index) => {
    if (note.durationSeconds >= 0.18) return true;
    const prev = melody[index - 1];
    const next = melody[index + 1];
    if (!prev || !next) return true;
    const leapIn = Math.abs(note.pitchMidi - prev.pitchMidi);
    const leapOut = Math.abs(next.pitchMidi - note.pitchMidi);
    const direct = Math.abs(next.pitchMidi - prev.pitchMidi);
    return !(leapIn >= 7 && leapOut >= 7 && direct <= 2);
  });
}

function scoreMelodyNote(note, cluster, prevPitch, prevTime) {
  let score = (note.amplitude || 0.5) * 2.4 + Math.min(note.durationSeconds, 0.9) * 0.75;
  const pitch = note.pitchMidi;
  if (pitch >= 62 && pitch <= 81) score += 0.75;
  else if (pitch >= 57 && pitch <= 88) score += 0.25;
  else if (pitch > 88) score -= 0.9;
  if (prevPitch != null) {
    const leap = Math.abs(pitch - prevPitch);
    const gap = note.startTimeSeconds - prevTime;
    const phraseBreak = gap > 1.05;
    if (!phraseBreak) {
      if (leap === 0) score += 0.5;
      else if (leap <= 2) score += 0.6;
      else if (leap <= 5) score += 0.22;
      else if (leap <= 7) score -= 0.05;
      else if (leap === 12) score -= 0.4;
      else score -= 0.3 * (leap - 7);
    } else if (leap <= 9) score += 0.15;
  }
  const strongerBelow = cluster.notes.some(other =>
    other !== note &&
    other.pitchMidi <= pitch - 3 &&
    other.pitchMidi >= 52 &&
    (other.amplitude || 0) >= (note.amplitude || 0) * 0.8 &&
    other.durationSeconds + 0.02 >= note.durationSeconds
  );
  if (strongerBelow && note.durationSeconds < 0.24) score -= 1.15;
  return score;
}

function extractMelody(notes) {
  const clusters = clusterNotes(notes, 0.06);
  const pick = floor => {
    const melody = [];
    let prevPitch = null;
    let prevTime = null;
    clusters.forEach(cluster => {
      const options = cluster.notes.filter(note => note.pitchMidi >= floor && note.pitchMidi <= 93 && note.durationSeconds >= 0.07);
      if (!options.length) return;
      let best = null;
      let bestScore = -1e9;
      options.forEach(note => {
        const score = scoreMelodyNote(note, cluster, prevPitch, prevTime);
        if (score > bestScore) {
          bestScore = score;
          best = note;
        }
      });
      if (!best) return;
      if (prevPitch != null && prevTime != null && Math.abs(best.pitchMidi - prevPitch) > 12 && best.durationSeconds < 0.1 && (best.amplitude || 0) < 0.4 && best.startTimeSeconds - prevTime < 0.35) return;
      melody.push(best);
      prevPitch = best.pitchMidi;
      prevTime = best.startTimeSeconds;
    });
    return smoothMelody(melody);
  };
  const sung = pick(57);
  if (sung.length >= 4 || sung.length >= clusters.length) return sung;
  const wider = pick(48);
  return wider.length > sung.length ? wider : sung;
}

function findDownbeat(notes, beat) {
  const bar = beat * 4;
  if (!notes.length) return 0;
  let bestPhase = 0;
  let bestScore = -1;
  const steps = 16;
  for (let step = 0; step < steps; step++) {
    const phase = (step / steps) * bar;
    let score = 0;
    notes.forEach(note => {
      const pos = ((note.startTimeSeconds - phase) % bar + bar) % bar;
      const weight = (note.amplitude || 0.5) * Math.min(1.3, 0.35 + note.durationSeconds);
      const dist = Math.min(pos, bar - pos);
      if (dist <= beat * 0.28) score += weight * (1.15 - dist / Math.max(0.05, beat * 0.28));
      else if (Math.abs(pos - beat * 2) <= beat * 0.2) score += weight * 0.22;
    });
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}

function heardClasses(weights) {
  const ranked = [];
  for (let pc = 0; pc < 12; pc++) if (weights[pc] > 0) ranked.push({ pc, w: weights[pc] });
  ranked.sort((a, b) => b.w - a.w);
  if (!ranked.length) return [];
  const cutoff = ranked[0].w * 0.42;
  const pool = ranked.filter(item => item.w >= cutoff).slice(0, 6);
  const chosen = [];
  pool.forEach(item => {
    const ok = chosen.every(pc => {
      const rel = intervalClass(item.pc, pc);
      return rel === 0 || rel === 3 || rel === 4 || rel === 5 || rel === 7;
    });
    if (ok && chosen.length < 3) chosen.push(item.pc);
  });
  return addSafeFifth(chosen);
}

function addSafeFifth(pcs) {
  if (!pcs.length || pcs.length >= 3) return pcs.slice(0, 3);
  const fifth = (pcs[0] + 7) % 12;
  if (pcs.indexOf(fifth) !== -1) return pcs;
  const safe = pcs.every(pc => {
    const rel = intervalClass(fifth, pc);
    return rel === 0 || rel >= 3;
  });
  return safe ? pcs.concat(fifth) : pcs;
}

function fallbackClasses(melody, start, stop, key) {
  const weights = pitchClassWeights(melody, start, stop);
  const triads = key.minor ? MINOR_TRIADS : MAJOR_TRIADS;
  let best = null;
  triads.forEach(triad => {
    const rootPc = (key.rootPc + triad.degree) % 12;
    const score = triadFit(rootPc, triad.minor, weights);
    if (!best || score > best.score) best = { rootPc, minor: triad.minor, score };
  });
  if (!best) return addSafeFifth([key.rootPc]);
  const pcs = [best.rootPc];
  const third = (best.rootPc + (best.minor ? 3 : 4)) % 12;
  if (weights[third] > 0) pcs.push(third);
  return addSafeFifth(pcs);
}

function sameChord(a, b) {
  if (!a || !b || !a.length || !b.length || a.length !== b.length) return false;
  const other = new Set(b);
  return a.every(pc => other.has(pc));
}

function voiceChord(pcs, low, high, previous) {
  const target = previous && previous.length ? previous : [Math.round((low + high) / 2)];
  const voices = [];
  pcs.forEach((pc, index) => {
    const aim = target[Math.min(index, target.length - 1)];
    const pitch = nearestPitch(pc, low, high, aim);
    if (pitch == null || voices.indexOf(pitch) !== -1) return;
    voices.push(pitch);
  });
  const sorted = voices.sort((a, b) => a - b);
  const spaced = [];
  sorted.forEach(pitch => {
    if (spaced.some(other => Math.abs(other - pitch) > 0 && Math.abs(other - pitch) < 3)) return;
    spaced.push(pitch);
  });
  return spaced;
}

function buildHarmonySegments(melody, harmonyNotes, gridOrigin, end, beat, key) {
  const bar = beat * 4;
  let cursor = gridOrigin;
  while (cursor > 0.03) cursor -= bar;
  const bars = [];
  for (let start = cursor; start < end - beat * 0.4; start += bar) {
    const from = Math.max(0, start);
    const to = Math.min(end, start + bar);
    if (to - from < beat * 0.35) continue;
    const weights = pitchClassWeights(harmonyNotes, from, to);
    const heard = heardClasses(weights);
    const pcs = heard.length >= 2 ? heard : fallbackClasses(melody, from, to, key);
    bars.push({ start: from, end: to, pcs });
  }
  const segments = [];
  for (let index = 0; index < bars.length; index += 2) {
    const left = bars[index];
    const right = bars[index + 1];
    if (!right || sameChord(left.pcs, right.pcs)) {
      segments.push({
        start: left.start,
        end: right ? right.end : left.end,
        pcs: left.pcs,
      });
    } else {
      segments.push(left);
      segments.push(right);
    }
  }
  if (!segments.length) {
    segments.push({ start: 0, end, pcs: addSafeFifth([key.rootPc]) });
  }
  segments[0].start = 0;
  segments[segments.length - 1].end = end;
  return segments;
}

function gameBeat(notes) {
  let beat = estimateBeatSeconds(notes);
  const target = 0.47;
  if (beat > 0.55) {
    const doubled = beat / 2;
    if (doubled >= 0.34 && Math.abs(doubled - target) < Math.abs(beat - target)) beat = doubled;
  }
  return Math.max(0.34, Math.min(0.62, beat));
}

function lockToGrid(time, origin, step) {
  const snapped = origin + Math.round((time - origin) / step) * step;
  return Math.max(0, snapped);
}

function bassPitch(pc, add) {
  const root = placeBass(36 + (((pc % 12) + 12) % 12));
  let pitch = root + add;
  while (pitch > 57) pitch -= 12;
  while (pitch < 31) pitch += 12;
  return pitch;
}

function scalePitch(pitch, key, low, high) {
  const scale = new Set(scaleFor(key.minor).map(interval => (key.rootPc + interval) % 12));
  let best = null;
  let bestDist = 99;
  const floor = Math.max(0, low);
  const ceil = Math.min(108, high);
  for (let candidate = floor; candidate <= ceil; candidate++) {
    if (!scale.has(((candidate % 12) + 12) % 12)) continue;
    const dist = Math.abs(candidate - pitch);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best == null ? clampMidi(pitch) : best;
}

const BASS_SHAPES = [
  [0, 7, 12, 7, 0, 5, 7, 10],
  [0, 2, 4, 7, 8, 7, 5, 2],
  [0, 12, 7, 0, 12, 7, 3, 10],
  [7, 5, 4, 2, 0, 10, 7, 0],
];
const ARP_SHAPES = [
  [0, 1, 2, 1, 0, 1, 2, 1],
  [2, 1, 0, 1, 2, 1, 0, 2],
  [0, 2, 1, 2, 0, 2, 1, 0],
  [0, 1, 0, 2, 1, 2, 0, 1],
];

export function buildRobloxArrangement(rawNotes, duration) {
  const source = (rawNotes || []).filter(note =>
    Number.isFinite(note.startTimeSeconds) &&
    Number.isFinite(note.durationSeconds) &&
    Number.isFinite(note.pitchMidi) &&
    note.durationSeconds >= 0.04 &&
    note.pitchMidi >= 0 &&
    note.pitchMidi <= 127
  );
  if (!source.length) return [];
  const cleaned = cleanSource(source);
  if (!cleaned.length) return [];
  const melody = extractMelody(cleaned);
  const harmonyNotes = cleaned.filter(note => note.pitchMidi >= 40 && note.pitchMidi <= 86);
  const beat = gameBeat(melody.length > 3 ? melody : cleaned);
  const detectedEnd = cleaned.reduce((max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds), 0);
  const fileEnd = Number(duration) || 0;
  // 5 minutes is 300 seconds. The band plays through the whole file, not
  // only up to the last pitched note.
  const end = Math.min(300, Math.max(detectedEnd, fileEnd > 0 ? fileEnd : detectedEnd));
  const accentNotes = melody.length ? melody : cleaned;
  const phase = findDownbeat(accentNotes, beat);
  const bar = beat * 4;
  const key = inferKey(melody.length ? melody : cleaned);
  const segments = buildHarmonySegments(melody, harmonyNotes, phase, end, beat, key);
  const eighth = beat / 2;
  const sixteenth = beat / 4;
  const out = [];
  const gridLead = [];
  const shift = leadShift(melody);

  melody.forEach(note => {
    if (note.startTimeSeconds >= end - 0.05) return;
    const start = lockToGrid(note.startTimeSeconds, phase, sixteenth);
    const prev = gridLead[gridLead.length - 1];
    const pitch = clampMidi(note.pitchMidi + shift);
    if (prev && Math.abs(prev.start - start) < sixteenth * 0.45) {
      if ((note.amplitude || 0) >= (prev.amplitude || 0)) {
        prev.pitch = pitch;
        prev.amplitude = note.amplitude || prev.amplitude;
      }
      return;
    }
    gridLead.push({
      start,
      pitch,
      amplitude: note.amplitude || 0.7,
    });
  });
  gridLead.forEach((note, index) => {
    const next = gridLead[index + 1];
    let length = beat * 1.5;
    if (next && next.start > note.start) length = Math.min(beat * 2, Math.max(sixteenth, next.start - note.start - 0.02));
    else length = Math.min(length, Math.max(sixteenth, end - note.start));
    pushNote(out, 'vocals', note.pitch, note.start, length, Math.max(0.78, Math.min(0.92, 0.72 + (note.amplitude || 0.7) * 0.16)));
  });

  function pcsAt(time) {
    const segment = segments.find(item => time >= item.start - 0.02 && time < item.end - 0.01);
    const pcs = segment && segment.pcs.length ? segment.pcs : [key.rootPc];
    return pcs.slice(0, 3);
  }

  function stabVoices(pcs, at) {
    const voices = voiceChord(pcs, 60, 74, null).slice(0, 3);
    const leadPitches = out.filter(note => note.role === 'vocals' && Math.abs(note.startTimeSeconds - at) < beat).map(note => note.pitchMidi);
    const filtered = voices.filter(pitch => !leadPitches.some(lead => lead === pitch));
    return (filtered.length ? filtered : voices).slice(0, 3);
  }

  let barStart = phase;
  while (barStart - bar > -0.03) barStart -= bar;
  let barIndex = 0;
  for (let start = barStart; start < end - beat * 0.35; start += bar) {
    if (start + bar < 0.08) {
      barIndex += 1;
      continue;
    }
    const at = start < 0.02 ? 0 : start;
    const pcs = pcsAt(at + eighth);
    const root = pcs[0];
    const shape = pcs.length >= 2 ? pcs : pcs.concat([(root + 7) % 12]);
    const voices = stabVoices(pcs, at);
    const bassShape = BASS_SHAPES[barIndex % BASS_SHAPES.length];
    const bassLen = Math.max(0.08, eighth * 0.72);
    bassShape.forEach((add, index) => {
      const time = at + index * eighth;
      if (time >= end - 0.05) return;
      const raw = bassPitch(root, add);
      const pitch = scalePitch(raw, key, 31, 55);
      const vel = index % 2 === 0 ? 0.7 : 0.48;
      pushNote(out, 'bass', pitch, time, Math.min(bassLen, end - time), vel);
    });

    const keyPattern = barIndex % 3;
    voices.forEach((pitch, voiceIndex) => {
      const hits = keyPattern === 0 ? [0, 2] : keyPattern === 1 ? [0, 1.5, 3] : [0, 0.5, 2, 3.5];
      hits.forEach((beatInBar, hitIndex) => {
        const time = at + beatInBar * beat;
        if (time >= end - 0.05) return;
        if (keyPattern === 2 && ((hitIndex + voiceIndex) % 2 === 1)) return;
        const length = keyPattern === 2 ? eighth * 0.9 : beat * (hitIndex === 0 ? 0.7 : 0.45);
        pushNote(out, 'keys', pitch, time, Math.min(length, end - time), hitIndex === 0 ? 0.52 : 0.36);
      });
    });

    const guitarHigh = barIndex % 2 === 0;
    for (let index = 0; index < 8; index++) {
      if (barIndex % 4 === 2 && index % 2 === 1) continue;
      const time = at + index * eighth + (index % 4 === 3 ? sixteenth * 0.0 : 0);
      if (time >= end - 0.05) break;
      const pc = shape[(index + (guitarHigh ? 1 : 0)) % shape.length];
      const pitch = nearestPitch(pc, guitarHigh ? 57 : 50, guitarHigh ? 72 : 64, guitarHigh ? 64 : 55);
      if (pitch == null) continue;
      const short = index % 2 === 1;
      pushNote(out, 'guitar', pitch, time, Math.min(short ? eighth * 0.42 : eighth * 0.8, end - time), short ? 0.34 : 0.5);
    }

    const padVoices = voiceChord(shape.slice(0, 3), 52, 67, null).slice(0, 2);
    padVoices.forEach(pitch => {
      pushNote(out, 'pad', pitch, at, Math.min(bar * 0.88, end - at), 0.28);
    });

    const leadHere = gridLead.filter(note => note.start >= at - 0.02 && note.start < at + bar);
    const leadPitch = leadHere.length ? leadHere[Math.floor(leadHere.length / 2)].pitch : 72;
    [0, 2].forEach(half => {
      const time = at + half * beat;
      if (time >= end - 0.05) return;
      const target = leadPitch - (half === 0 ? 8 : 5);
      const pc = shape[(half + barIndex) % shape.length];
      const pitched = nearestPitch(pc, 55, 76, target);
      const pitch = pitched == null ? scalePitch(target, key, 55, 76) : pitched;
      pushNote(out, 'strings', pitch, time, Math.min(beat * 1.7, end - time), 0.4);
    });

    const arpShape = ARP_SHAPES[barIndex % ARP_SHAPES.length];
    for (let index = 0; index < 8; index++) {
      if (barIndex % 4 === 3 && index % 3 === 2) continue;
      const time = at + index * eighth;
      if (time >= end - 0.05) break;
      const pc = shape[arpShape[index] % shape.length];
      const high = arpShape[index] === 2 || index >= 4;
      const pitch = nearestPitch(pc, high ? 76 : 70, 93, high ? 86 : 76);
      if (pitch == null) continue;
      pushNote(out, 'arp', pitch, time, Math.max(0.08, Math.min(eighth * (index % 4 === 3 ? 0.95 : 0.55), end - time)), 0.32 + (index % 2) * 0.06);
    }
    barIndex += 1;
  }

  let time = phase;
  while (time - eighth >= -0.001) time -= eighth;
  if (time < -0.001) time += eighth;
  for (; time < end - 0.04; time += eighth) {
    const hit = time < 0.02 ? 0 : time;
    const pos = ((hit - phase) % bar + bar) % bar;
    const eighthIndex = Math.round(pos / eighth) % 8;
    const drumBar = Math.floor((hit - phase + 0.001) / bar);
    const fill = drumBar > 0 && drumBar % 4 === 3 && eighthIndex >= 6;
    if (eighthIndex % 2 === 1) pushNote(out, 'drums', eighthIndex === 7 && drumBar % 2 === 1 ? 46 : 42, hit, Math.max(0.08, Math.min(0.12, eighth * 0.45)), eighthIndex === 7 ? 0.34 : 0.24);
    if (!fill && drumBar % 2 === 1 && eighthIndex % 2 === 0) pushNote(out, 'drums', 42, hit + sixteenth, Math.max(0.08, sixteenth * 0.8), 0.16);
    if (eighthIndex === 0 || eighthIndex === 4) pushNote(out, 'drums', 36, hit, Math.max(0.08, Math.min(0.18, eighth * 0.8)), eighthIndex === 0 ? 0.76 : 0.5);
    if (!fill && (eighthIndex === 2 || eighthIndex === 6)) pushNote(out, 'drums', 38, hit, Math.max(0.08, Math.min(0.12, eighth * 0.5)), 0.62);
    if (!fill && eighthIndex === 3 && drumBar % 2 === 0) pushNote(out, 'drums', 38, hit, Math.max(0.08, sixteenth), 0.22);
    if (fill) {
      pushNote(out, 'drums', eighthIndex === 6 ? 45 : 47, hit, Math.max(0.08, eighth * 0.7), 0.55);
      pushNote(out, 'drums', 38, hit + sixteenth, Math.max(0.08, sixteenth), 0.4);
    }
    if (eighthIndex === 0 && drumBar > 0 && drumBar % 4 === 0) pushNote(out, 'drums', 49, hit, Math.min(0.4, beat), 0.32);
  }

  return out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
}

export function orchestraProgramsFor(notes) {
  const leads = (notes || []).filter(note => note.role === 'vocals');
  const durations = leads.map(note => note.durationSeconds).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0.4;
  const beat = estimateBeatSeconds(leads.length > 3 ? leads : (notes || []).filter(note => note.role !== 'drums'));
  const flute = median < 0.16 && beat < 0.38;
  return {
    drums: 0,
    bass: 43,
    guitar: 42,
    vocals: flute ? 73 : 40,
    keys: 0,
    pad: 60,
    strings: beat < 0.36 ? 48 : 49,
    arp: 46,
  };
}
