// Prebaked orchestra. Basic Pitch supplies the tune. This file writes the
// song around it: a key, a chord every bar or two, and parts that sit in
// their own registers. It is a rule model, not a neural net. Programs are
// GeneralUser GS General MIDI numbers.

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
    amplitude: Math.max(0.12, Math.min(0.95, amplitude)),
  });
}

function estimateBeatSeconds(notes) {
  const starts = notes.map(note => note.startTimeSeconds).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1];
    if (gap >= 0.14 && gap <= 1.1) gaps.push(gap);
  }
  if (gaps.length < 4) return 0.5;
  gaps.sort((a, b) => a - b);
  let beat = gaps[Math.floor(gaps.length / 2)];
  while (beat < 0.34) beat *= 2;
  while (beat > 0.72) beat *= 0.5;
  return beat;
}

function takeMelody(ordered) {
  const melody = [];
  let cluster = null;
  ordered.forEach(note => {
    if (!cluster || note.startTimeSeconds - cluster.time > 0.09) {
      if (cluster) melody.push(cluster.notes.slice().sort((a, b) => b.pitchMidi - a.pitchMidi)[0]);
      cluster = { time: note.startTimeSeconds, notes: [] };
    }
    cluster.notes.push(note);
  });
  if (cluster) melody.push(cluster.notes.slice().sort((a, b) => b.pitchMidi - a.pitchMidi)[0]);
  return melody;
}

function placeMelody(pitch, octaveShift) {
  let placed = Math.round(pitch) + octaveShift * 12;
  while (placed < 57) placed += 12;
  while (placed > 88) placed -= 12;
  return clampMidi(placed);
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

function verticalChord(weights) {
  let best = null;
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    [false, true].forEach(minor => {
      const at = step => weights[(rootPc + step) % 12];
      const root = at(0);
      const fifth = at(7);
      const third = at(minor ? 3 : 4);
      const otherThird = at(minor ? 4 : 3);
      if (root <= 0 || third <= 0 || otherThird > third) return;
      if (fifth <= 0 && third < root * 0.35) return;
      const score = root * 1.1 + fifth * 0.9 + third * 1.35;
      if (!best || score > best.score) {
        best = { rootPc, minor, hasThird: true, seventh: null, score, vertical: true };
      }
    });
  }
  return best;
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

function chordTones(seg) {
  const tones = [0, seg.minor ? 3 : 4, 7];
  if (seg.seventh != null) tones.push(seg.seventh);
  return tones;
}

function voiceLead(seg, low, high, previous, limit, avoid) {
  const voices = [];
  const blocked = new Set(avoid || []);
  chordTones(seg).forEach((interval, index) => {
    if (voices.length >= limit) return;
    const pc = (seg.rootPc + interval) % 12;
    if (blocked.has(pc) && chordTones(seg).length - blocked.size >= 2) return;
    const target = previous && previous[index] != null ? previous[index] : Math.round((low + high) / 2);
    const pitch = nearestPitch(pc, low, high, target);
    if (pitch == null || voices.indexOf(pitch) !== -1) return;
    voices.push(pitch);
  });
  return voices;
}

function buildChordSegments(melody, allNotes, gridStart, end, beat) {
  const bar = beat * 4;
  const span = Math.max(bar, end - gridStart);
  const barCount = Math.max(1, Math.ceil(span / bar - 1e-6));
  const key = inferKey(melody.length ? melody : allNotes);
  const triads = (key.minor ? MINOR_TRIADS : MAJOR_TRIADS).map(triad => ({
    rootPc: (key.rootPc + triad.degree) % 12,
    minor: triad.minor,
  }));
  const dominant = (key.rootPc + 7) % 12;
  const phraseBars = barCount >= 16 ? 8 : 4;
  const chosen = [];
  for (let barIndex = 0; barIndex < barCount; barIndex++) {
    const start = gridStart + barIndex * bar;
    const stop = Math.min(end, start + bar);
    const weights = pitchClassWeights(melody.length ? melody : allNotes, start, stop);
    const heard = verticalChord(pitchClassWeights(allNotes, start, stop));
    const heardStrong = heard && heard.score >= 1.15;
    let best = null;
    triads.forEach(triad => {
      let score = triadFit(triad.rootPc, triad.minor, weights);
      const previous = chosen[chosen.length - 1];
      if (previous && previous.rootPc === triad.rootPc && previous.minor === triad.minor) score += 0.16;
      const motion = previous ? (triad.rootPc - previous.rootPc + 12) % 12 : 0;
      if (motion === 5 || motion === 7) score += 0.1;
      if (barIndex % phraseBars === phraseBars - 1 && triad.rootPc === dominant && !triad.minor) score += 0.14;
      if (barIndex % phraseBars === 0 && triad.rootPc === key.rootPc) score += 0.12;
      if (!best || score > best.score) best = { ...triad, hasThird: true, seventh: null, score, vertical: false };
    });
    let pick = best || { rootPc: key.rootPc, minor: key.minor, hasThird: true, seventh: null, score: 0, vertical: false };
    if (heardStrong) pick = { rootPc: heard.rootPc, minor: heard.minor, hasThird: true, seventh: null, score: heard.score, vertical: true };
    const previous = chosen[chosen.length - 1];
    if (
      previous &&
      !previous.vertical &&
      !heardStrong &&
      pick.score < previous.score + 0.18 &&
      barIndex % 2 === 1
    ) {
      pick = { ...previous, vertical: false };
    }
    chosen.push(pick);
  }
  const segments = [];
  chosen.forEach((chord, barIndex) => {
    const start = gridStart + barIndex * bar;
    const stop = barIndex === chosen.length - 1 ? end : Math.min(end, start + bar);
    const previous = segments[segments.length - 1];
    if (previous && previous.rootPc === chord.rootPc && previous.minor === chord.minor && start <= previous.end + 0.02) {
      previous.end = stop;
      return;
    }
    segments.push({
      start,
      end: stop,
      rootPc: chord.rootPc,
      minor: chord.minor,
      hasThird: true,
      seventh: null,
    });
  });
  if (!segments.length) {
    segments.push({ start: gridStart, end, rootPc: key.rootPc, minor: key.minor, hasThird: true, seventh: null });
  }
  segments[0].start = gridStart;
  segments[segments.length - 1].end = end;
  return { segments, bar, phraseBars, barCount, beat };
}

function sectionAt(time, gridStart, bar, phraseBars, barCount) {
  if (barCount < 8) return 'full';
  const index = Math.floor((time - gridStart) / (bar * phraseBars));
  if (index <= 0) return 'intro';
  if (index % 2 === 1) return 'chorus';
  return 'verse';
}

function swell(time, gridStart, bar, phraseBars) {
  const phraseLen = bar * phraseBars;
  const pos = ((time - gridStart) % phraseLen) / phraseLen;
  return 0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, pos / 0.8));
}

function sectionGain(section) {
  if (section === 'intro') return 0.78;
  if (section === 'verse') return 0.9;
  if (section === 'chorus') return 1;
  return 0.95;
}

function leadAvoid(melody, start, end, octaveShift) {
  const counts = Array(12).fill(0);
  melody.forEach(note => {
    if (note.startTimeSeconds < start - 0.05 || note.startTimeSeconds >= end) return;
    const pc = ((placeMelody(note.pitchMidi, octaveShift) % 12) + 12) % 12;
    counts[pc] += note.durationSeconds;
  });
  let best = -1;
  let bestWeight = 0;
  counts.forEach((weight, pc) => {
    if (weight > bestWeight) {
      bestWeight = weight;
      best = pc;
    }
  });
  return best >= 0 ? [best] : [];
}

function bassPitch(rootPc, addFifth) {
  let pitch = 36 + (((rootPc - 0) % 12 + 12) % 12);
  if (addFifth) pitch += 7;
  while (pitch > 43) pitch -= 12;
  while (pitch < 31) pitch += 12;
  return pitch;
}

function melodyDirection(melody, start, end) {
  const inside = melody.filter(note => note.startTimeSeconds >= start - 0.02 && note.startTimeSeconds < end);
  if (inside.length < 2) return 0;
  return inside[inside.length - 1].pitchMidi - inside[0].pitchMidi;
}

export function buildOrchestralArrangement(rawNotes, duration, stylePlan) {
  const source = (rawNotes || []).filter(note =>
    Number.isFinite(note.startTimeSeconds) &&
    Number.isFinite(note.durationSeconds) &&
    Number.isFinite(note.pitchMidi) &&
    note.durationSeconds >= 0.04 &&
    note.pitchMidi >= 0 &&
    note.pitchMidi <= 127
  );
  if (!source.length) return [];
  const plan = stylePlan || {};
  const octaveShift = [-1, 0, 1].includes(Number(plan.melodyOctave)) ? Number(plan.melodyOctave) : 0;
  const fourOnFloor = plan.drumPattern === 'four_on_floor';
  const ordered = source.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const melody = takeMelody(ordered);
  const beat = estimateBeatSeconds(melody.length > 3 ? melody : ordered);
  const detectedEnd = ordered.reduce((max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds), 0);
  const end = Math.max(Number(duration) || 0, detectedEnd);
  const gridStart = Math.max(0, Math.floor(ordered[0].startTimeSeconds / beat) * beat);
  const harmony = buildChordSegments(melody, ordered, gridStart, end, beat);
  const { segments, bar, phraseBars, barCount } = harmony;
  const out = [];
  const bowGap = 0.09;
  const writeBowed = (role, pitches, start, stop, amplitude) => {
    const span = stop - start;
    const bow = Math.max(beat * 2, 0.9);
    if (span <= bow + 0.15) {
      pitches.forEach(pitch => pushNote(out, role, pitch, start, Math.max(0.2, span - 0.03), amplitude));
      return;
    }
    for (let time = start; time < stop - 0.22; time += bow) {
      const length = Math.min(bow - bowGap, stop - time - 0.03);
      if (length >= 0.2) pitches.forEach(pitch => pushNote(out, role, pitch, time, length, amplitude));
    }
  };

  melody.forEach((note, index) => {
    const pitch = placeMelody(note.pitchMidi, octaveShift);
    const next = melody[index + 1];
    const limit = next ? next.startTimeSeconds - 0.04 : note.startTimeSeconds + Math.max(note.durationSeconds, beat);
    const spoken = Math.max(note.durationSeconds, Math.min(beat * 0.85, 0.42));
    const room = Math.max(0.12, Math.min(spoken, limit - note.startTimeSeconds));
    const prevPitch = index > 0 ? placeMelody(melody[index - 1].pitchMidi, octaveShift) : pitch;
    const nextPitch = next ? placeMelody(next.pitchMidi, octaveShift) : pitch;
    const peak = pitch >= prevPitch && pitch >= nextPitch;
    const amplitude = Math.max(0.74, Math.min(0.95, 0.6 + (note.amplitude || 0.8) * 0.32 + (peak ? 0.05 : 0)));
    pushNote(out, 'vocals', pitch, note.startTimeSeconds, room, amplitude);
    if (room >= beat * 0.85 && pitch >= 69) {
      pushNote(out, 'vocals', pitch - 12, note.startTimeSeconds, room * 0.92, 0.34);
    }
    const gapEnd = next ? next.startTimeSeconds : end;
    const rest = gapEnd - (note.startTimeSeconds + room);
    if (rest >= beat * 1.7) {
      let echo = pitch >= 69 ? pitch - 12 : pitch - 7;
      while (echo > 81) echo -= 12;
      while (echo < 57) echo += 12;
      const when = note.startTimeSeconds + room + Math.min(beat * 0.4, rest * 0.3);
      const echoLen = Math.min(beat * 0.95, gapEnd - when - 0.06);
      if (echoLen >= 0.12 && Math.abs(echo - pitch) >= 3) {
        pushNote(out, 'vocals', echo, when, echoLen, 0.42);
      }
    }
  });

  let stringVoices = [];
  let hornVoices = [];
  let celloPitch = 50;
  segments.forEach(seg => {
    const section = sectionAt(seg.start, gridStart, bar, phraseBars, barCount);
    const gain = swell(seg.start, gridStart, bar, phraseBars) * sectionGain(section);
    const avoid = leadAvoid(melody, seg.start, seg.end, octaveShift);
    stringVoices = voiceLead(seg, 52, 67, stringVoices, 2, avoid);
    writeBowed('strings', stringVoices, seg.start, seg.end, 0.26 * gain);

    if (section !== 'intro') {
      hornVoices = voiceLead(seg, 64, 79, hornVoices, 2, avoid);
      const hornGain = section === 'chorus' || section === 'full' ? 0.24 : 0.16;
      const hornStart = seg.start + Math.min(0.06, beat * 0.15);
      writeBowed('pad', hornVoices, hornStart, seg.end, hornGain * gain);
    }

    const direction = melodyDirection(melody, seg.start, seg.end);
    const celloTarget = direction > 0 ? celloPitch - 3 : celloPitch + 3;
    const nextCello = voiceLead(seg, 45, 57, [celloTarget], 1, [])[0];
    if (nextCello != null) {
      celloPitch = nextCello;
      const celloGain = section === 'intro' ? 0.22 : 0.34;
      pushNote(out, 'guitar', celloPitch, seg.start, Math.max(0.2, seg.end - seg.start - 0.04), celloGain * gain);
      if (seg.end - seg.start >= beat * 2.5) {
        const middle = seg.start + (seg.end - seg.start) * 0.5;
        const step = voiceLead(seg, 45, 57, [celloPitch + (direction > 0 ? -2 : 2)], 1, [celloPitch % 12])[0];
        if (step != null && step !== celloPitch) {
          pushNote(out, 'guitar', step, middle, Math.max(0.2, seg.end - middle - 0.04), celloGain * 0.9);
        }
      }
    }

    if (section !== 'intro') {
      const piano = voiceLead(seg, 48, 64, null, 2, avoid);
      const comps = section === 'chorus' || section === 'full' ? [1] : [1, 3];
      comps.forEach(beatInBar => {
        for (let barTime = seg.start; barTime < seg.end - beat; barTime += bar) {
          const when = barTime + beatInBar * beat;
          if (when >= seg.end - 0.1) continue;
          piano.forEach(pitch => pushNote(out, 'keys', pitch, when, Math.max(0.16, beat * 0.55), 0.26 * gain));
        }
      });
    }

    if (section === 'chorus' || section === 'full') {
      const harpTones = chordTones(seg)
        .map(interval => nearestPitch((seg.rootPc + interval) % 12, 62, 86, 74))
        .filter(pitch => pitch != null)
        .filter((pitch, index, list) => list.indexOf(pitch) === index)
        .sort((a, b) => a - b);
      for (let barTime = seg.start; barTime < seg.end - beat; barTime += bar) {
        harpTones.slice(0, 3).forEach((pitch, index) => {
          const when = barTime + index * beat * 0.5;
          if (when < seg.end - 0.08) pushNote(out, 'arp', pitch, when, Math.max(0.12, beat * 0.4), 0.24 * gain);
        });
        harpTones.slice(0, 3).slice().reverse().forEach((pitch, index) => {
          const when = barTime + beat * 2 + index * beat * 0.5;
          if (when < seg.end - 0.08) pushNote(out, 'arp', pitch, when, Math.max(0.12, beat * 0.34), 0.18 * gain);
        });
      }
    }

    const next = segments[segments.indexOf(seg) + 1];
    let bassIndex = 0;
    for (let time = seg.start; time < seg.end - beat * 0.35; time += beat * 2, bassIndex++) {
      const hold = Math.min(seg.end, time + beat * 2);
      let pitch = bassPitch(seg.rootPc, bassIndex % 2 === 1);
      let noteEnd = hold - 0.04;
      if (next && next.rootPc !== seg.rootPc && hold >= seg.end - 0.05 && hold - time > beat) {
        noteEnd = seg.end - beat * 0.5;
        const approach = bassPitch(next.rootPc, false) - 1;
        if (approach >= 31 && approach <= 43) {
          pushNote(out, 'bass', approach, seg.end - beat * 0.5, Math.max(0.1, beat * 0.42), 0.5 * gain);
        }
      }
      pushNote(out, 'bass', pitch, time, Math.max(0.16, noteEnd - time), (bassIndex % 2 === 0 ? 0.66 : 0.56) * gain);
    }
  });

  const hatStep = beat / 2;
  const steps = Math.ceil((end - gridStart) / hatStep);
  for (let step = 0; step < steps; step++) {
    const time = gridStart + step * hatStep;
    if (time >= end - 0.03) break;
    const beatIndex = Math.floor(step / 2);
    const onDown = step % 2 === 0;
    const section = sectionAt(time, gridStart, bar, phraseBars, barCount);
    const gain = swell(time, gridStart, bar, phraseBars);
    const beatInBar = beatIndex % 4;
    const barIndex = Math.floor(beatIndex / 4);
    const phraseStart = barIndex % phraseBars === 0 && beatInBar === 0 && onDown;
    const fill = (section === 'chorus' || section === 'full') && barIndex % phraseBars === phraseBars - 1 && beatInBar === 3;
    if (!onDown) {
      if ((section === 'chorus' || section === 'full') && beatInBar % 2 === 1) {
        pushNote(out, 'drums', 51, time, Math.min(beat * 0.35, end - time), 0.14 * gain);
      }
      continue;
    }
    if (fill) {
      pushNote(out, 'drums', 45, time, Math.min(beat * 0.22, end - time), 0.28);
      pushNote(out, 'drums', 47, time + beat * 0.25, Math.min(beat * 0.22, end - time), 0.3);
      pushNote(out, 'drums', 50, time + beat * 0.5, Math.min(beat * 0.22, end - time), 0.32);
      continue;
    }
    const kick = fourOnFloor || beatInBar === 0 || (section !== 'intro' && beatInBar === 2);
    if (kick) {
      const kickAmp = section === 'intro' ? 0.36 : beatInBar === 0 ? 0.55 : 0.4;
      pushNote(out, 'drums', 36, time, Math.min(beat * 0.7, end - time), kickAmp * gain);
    }
    if (section !== 'intro' && (beatInBar === 1 || beatInBar === 3)) {
      pushNote(out, 'drums', 38, time, Math.min(beat * 0.45, end - time), (beatInBar === 3 ? 0.42 : 0.34) * gain);
    }
    if (phraseStart && section !== 'intro' && section !== 'verse') {
      pushNote(out, 'drums', 49, time, Math.min(beat * 1.4, end - time), 0.32);
    }
  }

  return out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
}

export function orchestraProgramsFor(notes) {
  const leads = (notes || []).filter(note => note.role === 'vocals' && (note.amplitude || 0) >= 0.55);
  const durations = leads.map(note => note.durationSeconds).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0.4;
  const beat = estimateBeatSeconds(leads.length > 3 ? leads : (notes || []).filter(note => note.role !== 'drums'));
  return {
    drums: 48,
    bass: 43,
    guitar: 42,
    vocals: median < 0.26 ? 73 : 40,
    keys: 0,
    pad: 60,
    strings: beat < 0.42 ? 48 : 49,
    arp: 46,
  };
}
