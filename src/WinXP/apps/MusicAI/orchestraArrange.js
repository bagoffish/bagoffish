// ULTRA Classic Roblox-style arrangement engine.
// Generates authentic 2009-era Roblox orchestral accompaniment:
// - Violin lead that follows the heard tune
// - Contrabass and cello in LONG sustained notes (Roblox signature)
// - Heavy use of square/synth waves from C64 samples
// - String ensemble, horn, flute, oboe, clarinet answering in phrases
// - Harp broken chords, soft piano stabs, pizzicato offbeats
// - Trumpet only at phrase endings
// - Timpani on downbeat and short roll at cadence
// - Light kit: kick/snare, hats sometimes, rest every few bars
// - More quantized timing (less humanization for that MIDI feel)
// - Lo-fi SoundFont crunch with heavier compression
// - Simple I-V-vi-IV chord progressions (very Roblox)

function cleanSource(notes) {
  const sorted = (Array.isArray(notes) ? notes : [])
    .filter(note => note && Number.isFinite(note.startTimeSeconds) &&
      Number.isFinite(note.durationSeconds) && Number.isFinite(note.pitchMidi))
    .slice()
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const kept = [];
  const buckets = new Map();
  const bucketWidth = 0.012;
  sorted.forEach(note => {
    if (note.durationSeconds < 0.035 || note.pitchMidi < 0 || note.pitchMidi > 127 ||
        note.startTimeSeconds < 0) return;
    const pitch = Math.round(note.pitchMidi);
    const bucket = Math.floor(note.startTimeSeconds / bucketWidth);
    let duplicate = false;
    for (let near = bucket - 1; near <= bucket + 1 && !duplicate; near += 1) {
      const candidates = buckets.get(pitch + ':' + near) || [];
      duplicate = candidates.some(previous =>
        Math.abs(previous.startTimeSeconds - note.startTimeSeconds) < 0.012 &&
        Math.abs(previous.durationSeconds - note.durationSeconds) < 0.025
      );
    }
    if (duplicate) return;
    kept.push(note);
    const key = pitch + ':' + bucket;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(note);
  });
  return kept;
}
function clusterNotes(notes, windowSeconds = 0.06) {
  const clusters = [];
  notes.forEach(note => {
    const last = clusters[clusters.length - 1];
    if (!last || note.startTimeSeconds - last.time > windowSeconds) {
      clusters.push({ time: note.startTimeSeconds, notes: [note] });
    } else {
      last.notes.push(note);
    }
  });
  return clusters;
}

// Detect musical phrases for call-response patterns
function detectPhrases(notes, barSeconds = 2.0) {
  const phrases = [];
  let currentPhrase = [];
  let lastTime = 0;
  
  notes.forEach(note => {
    const gap = note.startTimeSeconds - lastTime;
    // Phrase boundary after a significant rest
    if (gap > barSeconds * 0.75 && currentPhrase.length > 0) {
      phrases.push([...currentPhrase]);
      currentPhrase = [];
    }
    currentPhrase.push(note);
    lastTime = note.startTimeSeconds;
  });
  
  if (currentPhrase.length > 0) {
    phrases.push(currentPhrase);
  }
  
  return phrases;
}

// Simple chord estimation from melody notes - favors simple Roblox progressions
function estimateChord(pitches) {
  if (!pitches || pitches.length === 0) return null;

  const pitchClasses = pitches.map(p => p % 12);
  const majorProfile = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]; // Major scale
  const minorProfile = [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]; // Minor scale

  let bestRoot = 0;
  let bestScore = -Infinity;
  let isMinor = false;

  for (let root = 0; root < 12; root++) {
    let majorScore = 0;
    let minorScore = 0;

    pitchClasses.forEach(pc => {
      const normalized = (pc - root + 12) % 12;
      majorScore += majorProfile[normalized];
      minorScore += minorProfile[normalized];
    });

    if (majorScore > bestScore) {
      bestScore = majorScore;
      bestRoot = root;
      isMinor = false;
    }
    if (minorScore > bestScore) {
      bestScore = minorScore;
      bestRoot = root;
      isMinor = true;
    }
  }

  return { root: bestRoot, isMinor };
}

// Generate simple I-V-vi-IV progression (very Roblox)
function getRobloxProgression(rootKey) {
  // I (tonic), V (dominant), vi (submediant), IV (subdominant)
  const intervals = [0, 7, 9, 5]; // Semitones from root
  return intervals.map(interval => (rootKey + interval) % 12);
}

// Generate bass line from chord progression - VERY LONG sustained notes
function generateBassLine(phrases, duration) {
  const bassNotes = [];
  const bassPitches = [36, 38, 40, 41, 43, 45, 47]; // C2-G2 range

  phrases.forEach((phrase, pIndex) => {
    const pitches = phrase.map(n => Math.round(n.pitchMidi));
    const chord = estimateChord(pitches);

    if (chord) {
      const rootMidi = 36 + chord.root; // C2 as base
      const bassPitch = bassPitches.find(p => (p % 12) === chord.root) || rootMidi;

      // ULTRA long sustained bass notes (Roblox signature - 2+ beats)
      phrase.forEach((note, nIndex) => {
        if (nIndex % 4 === 0) { // Every 4th note for even longer sustain
          bassNotes.push({
            pitchMidi: bassPitch,
            startTimeSeconds: note.startTimeSeconds,
            durationSeconds: Math.min(2.0, note.durationSeconds * 3), // Much longer
            amplitude: 0.8, // Louder bass
            role: 'bass'
          });
        }
      });
    }
  });

  return bassNotes;
}

// Generate light drum pattern (kick/snare, occasional hats)
function generateDrums(notes, duration, tempoBpm = 120) {
  const beatSeconds = 60 / tempoBpm;
  const barBeats = 4;
  const barSeconds = beatSeconds * barBeats;
  const numBars = Math.ceil(duration / barSeconds);
  
  const drums = [];
  
  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * barSeconds;
    
    // Kick on beats 1 and 3
    drums.push({
      pitchMidi: 36,
      startTimeSeconds: barStart,
      durationSeconds: 0.1,
      amplitude: 0.8,
      role: 'drums'
    });
    
    if (barStart + beatSeconds * 2 < duration) {
      drums.push({
        pitchMidi: 36,
        startTimeSeconds: barStart + beatSeconds * 2,
        durationSeconds: 0.1,
        amplitude: 0.75,
        role: 'drums'
      });
    }
    
    // Snare on beats 2 and 4
    if (barStart + beatSeconds < duration) {
      drums.push({
        pitchMidi: 38,
        startTimeSeconds: barStart + beatSeconds,
        durationSeconds: 0.15,
        amplitude: 0.7,
        role: 'drums'
      });
    }
    
    if (barStart + beatSeconds * 3 < duration) {
      drums.push({
        pitchMidi: 38,
        startTimeSeconds: barStart + beatSeconds * 3,
        durationSeconds: 0.15,
        amplitude: 0.7,
        role: 'drums'
      });
    }
    
    // Hi-hat on offbeats (every other bar only - light kit)
    if (bar % 2 === 0) {
      for (let i = 0; i < 8; i++) {
        const time = barStart + (i * beatSeconds * 0.5);
        if (time < duration) {
          drums.push({
            pitchMidi: 42,
            startTimeSeconds: time,
            durationSeconds: 0.05,
            amplitude: 0.4,
            role: 'drums'
          });
        }
      }
    }
  }
  
  return drums;
}

// Generate harp arpeggios (broken chords) - more frequent for Roblox feel
function generateHarpArps(phrases, duration) {
  const arps = [];

  phrases.forEach((phrase, pIndex) => {
    const pitches = phrase.map(n => Math.round(n.pitchMidi));
    const chord = estimateChord(pitches);

    if (chord) {
      // Triad notes for the chord
      const chordTones = [0, 4, 7].map(interval => {
        if (chord.isMinor && interval === 4) return 3; // Minor third
        return interval;
      });

      const basePitch = 60 + chord.root; // Middle C as base

      phrase.forEach((note, nIndex) => {
        if (nIndex % 2 === 0) { // More frequent arps (every 2nd note)
          chordTones.forEach((interval, toneIndex) => {
            const arpPitch = basePitch + interval + (toneIndex * 12);
            if (arpPitch <= 84) {
              arps.push({
                pitchMidi: arpPitch,
                startTimeSeconds: note.startTimeSeconds + (toneIndex * 0.06), // Faster arps
                durationSeconds: 0.2, // Slightly longer
                amplitude: 0.45, // Louder
                role: 'arp'
              });
            }
          });
        }
      });
    }
  });

  return arps;
}

// Generate pizzicato offbeats - MORE frequent (very Roblox)
function generatePizzicato(notes, duration) {
  const pizz = [];

  notes.forEach((note, index) => {
    if (index % 3 === 1) { // Every 3rd note (more frequent)
      pizz.push({
        pitchMidi: Math.max(48, Math.round(note.pitchMidi) - 12),
        startTimeSeconds: note.startTimeSeconds + 0.03, // Tighter timing
        durationSeconds: 0.06, // Shorter, snappier
        amplitude: 0.55, // Louder
        role: 'pizz'
      });
    }
  });

  return pizz;
}

// Generate square wave synth leads (C64 Roblox style)
function generateSquareSynth(phrases, duration) {
  const squares = [];

  phrases.forEach((phrase, pIndex) => {
    if (pIndex % 2 === 0) { // Every other phrase
      const pitches = phrase.map(n => Math.round(n.pitchMidi));
      const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;

      phrase.forEach((note, nIndex) => {
        if (nIndex % 2 === 0) {
          squares.push({
            pitchMidi: Math.round(avgPitch),
            startTimeSeconds: note.startTimeSeconds,
            durationSeconds: note.durationSeconds * 0.6,
            amplitude: 0.5,
            role: 'guitar' // Use guitar channel for square synth
          });
        }
      });
    }
  });

  return squares;
}

// Generate simple chord pad layers (very Roblox - sustained chords)
function generateChordPads(phrases, duration) {
  const pads = [];

  phrases.forEach((phrase, pIndex) => {
    const pitches = phrase.map(n => Math.round(n.pitchMidi));
    const chord = estimateChord(pitches);

    if (chord) {
      const chordTones = [0, 4, 7].map(interval => {
        if (chord.isMinor && interval === 4) return 3;
        return interval;
      });

      const basePitch = 48 + chord.root; // C3 as base

      // One sustained chord per phrase
      if (phrase.length > 0) {
        const firstNote = phrase[0];
        const lastNote = phrase[phrase.length - 1];
        const chordDuration = lastNote.startTimeSeconds + lastNote.durationSeconds - firstNote.startTimeSeconds;

        chordTones.forEach((interval) => {
          const padPitch = basePitch + interval;
          pads.push({
            pitchMidi: padPitch,
            startTimeSeconds: firstNote.startTimeSeconds,
            durationSeconds: chordDuration,
            amplitude: 0.35,
            role: 'pad'
          });
        });
      }
    }
  });

  return pads;
}

// Generate string ensemble answering phrases
function generateStrings(phrases, duration) {
  const strings = [];
  
  phrases.forEach((phrase, pIndex) => {
    // Strings answer on even phrases
    if (pIndex % 2 === 1) {
      const pitches = phrase.map(n => Math.round(n.pitchMidi));
      const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
      
      phrase.forEach((note, nIndex) => {
        if (nIndex % 2 === 0) {
          strings.push({
            pitchMidi: Math.round(avgPitch) - 12,
            startTimeSeconds: note.startTimeSeconds,
            durationSeconds: note.durationSeconds * 0.8,
            amplitude: 0.5,
            role: 'strings'
          });
        }
      });
    }
  });
  
  return strings;
}

// Generate horn section (phrase endings)
function generateHorn(phrases, duration) {
  const horns = [];
  
  phrases.forEach((phrase, pIndex) => {
    const lastNote = phrase[phrase.length - 1];
    if (lastNote && pIndex % 3 === 2) { // Every 3rd phrase
      horns.push({
        pitchMidi: Math.max(55, Math.round(lastNote.pitchMidi) - 5),
        startTimeSeconds: lastNote.startTimeSeconds,
        durationSeconds: Math.min(0.5, lastNote.durationSeconds),
        amplitude: 0.55,
        role: 'horn'
      });
    }
  });
  
  return horns;
}

// Generate flute/oboe answering
function generateWinds(phrases, duration) {
  const winds = [];
  
  phrases.forEach((phrase, pIndex) => {
    const pitches = phrase.map(n => Math.round(n.pitchMidi));
    const chord = estimateChord(pitches);
    
    if (chord && pIndex % 2 === 0) {
      const windPitch = 67 + chord.root; // G4 range
      
      phrase.forEach((note, nIndex) => {
        if (nIndex === Math.floor(phrase.length / 2)) {
          winds.push({
            pitchMidi: windPitch,
            startTimeSeconds: note.startTimeSeconds,
            durationSeconds: 0.3,
            amplitude: 0.4,
            role: Math.random() > 0.5 ? 'flute' : 'oboe'
          });
        }
      });
    }
  });
  
  return winds;
}

// Generate timpani (downbeats and cadence rolls)
function generateTimpani(duration, tempoBpm = 120) {
  const timpani = [];
  const beatSeconds = 60 / tempoBpm;
  const barSeconds = beatSeconds * 4;
  const numBars = Math.ceil(duration / barSeconds);
  
  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * barSeconds;
    
    // Downbeat
    timpani.push({
      pitchMidi: 45,
      startTimeSeconds: barStart,
      durationSeconds: 0.2,
      amplitude: 0.6,
      role: 'timpani'
    });
    
    // Short roll at phrase end (every 4 bars)
    if (bar % 4 === 3 && barStart + barSeconds < duration) {
      for (let i = 0; i < 3; i++) {
        timpani.push({
          pitchMidi: 45,
          startTimeSeconds: barStart + barSeconds - 0.3 + (i * 0.1),
          durationSeconds: 0.08,
          amplitude: 0.5 - (i * 0.1),
          role: 'timpani'
        });
      }
    }
  }
  
  return timpani;
}

// Generate trumpet (phrase endings only)
function generateTrumpet(phrases, duration) {
  const trumpets = [];
  
  phrases.forEach((phrase, pIndex) => {
    const lastNote = phrase[phrase.length - 1];
    if (lastNote && pIndex % 4 === 3) { // Every 4th phrase
      trumpets.push({
        pitchMidi: Math.max(60, Math.round(lastNote.pitchMidi)),
        startTimeSeconds: lastNote.startTimeSeconds,
        durationSeconds: Math.min(0.4, lastNote.durationSeconds),
        amplitude: 0.6,
        role: 'trumpet'
      });
    }
  });
  
  return trumpets;
}

// Add small timing delays for humanized feel - REDUCED for more MIDI feel
function humanizeTiming(notes) {
  const roleOffsets = {
    'bass': 0.008,  // Much tighter
    'cello': 0.005,
    'strings': 0.01,
    'horn': 0.012,
    'flute': 0.015,
    'oboe': 0.012,
    'clarinet': 0.01,
    'arp': 0.003,
    'pizz': 0.015,
    'trumpet': 0.018,
    'timpani': 0.002,
    'guitar': 0.004, // Square synth
  };

  return notes.map(note => {
    const offset = roleOffsets[note.role] || 0;
    const jitter = (Math.random() - 0.5) * 0.005; // Less jitter
    return {
      ...note,
      startTimeSeconds: Math.max(0, note.startTimeSeconds + offset + jitter)
    };
  });
}

function scoreMelodyNote(note, prevPitch, prevTime) {
  let score = (Number(note.amplitude) || 0.5) * 2.4 +
    Math.min(note.durationSeconds, 0.9) * 0.75;
  const pitch = note.pitchMidi;
  if (pitch >= 62 && pitch <= 81) score += 0.75;
  else if (pitch >= 57 && pitch <= 88) score += 0.25;
  else if (pitch > 88) score -= 0.9;

  if (prevPitch != null && prevTime != null) {
    const leap = Math.abs(pitch - prevPitch);
    const gap = note.startTimeSeconds - prevTime;
    if (gap <= 1.05) {
      if (leap === 0) score += 0.5;
      else if (leap <= 2) score += 0.6;
      else if (leap <= 5) score += 0.22;
      else if (leap > 7 && leap !== 12) score -= 0.3 * (leap - 7);
      else if (leap === 12) score -= 0.4;
    }
  }
  return score;
}

function extractMelody(notes) {
  const clusters = clusterNotes(notes);
  const melody = [];
  let previousPitch = null;
  let previousTime = null;
  clusters.forEach(cluster => {
    const candidates = cluster.notes.filter(note =>
      note.pitchMidi >= 48 && note.pitchMidi <= 93 && note.durationSeconds >= 0.055
    );
    if (!candidates.length) return;
    let best = null;
    let bestScore = -Infinity;
    candidates.forEach(note => {
      const score = scoreMelodyNote(note, previousPitch, previousTime);
      if (score > bestScore) {
        best = note;
        bestScore = score;
      }
    });
    if (!best) return;
    melody.push(best);
    previousPitch = best.pitchMidi;
    previousTime = best.startTimeSeconds;
  });
  return new Set(melody);
}

export function buildRobloxArrangement(rawNotes, duration) {
  // Classic Roblox orchestral arrangement with generated accompaniment
  const limit = Math.min(300, Number(duration) > 0 ? Number(duration) : 300);
  const source = cleanSource(rawNotes).filter(note => note.startTimeSeconds < limit);
  if (!source.length) return [];

  const melody = extractMelody(source);
  const phrases = detectPhrases(source);
  
  // Convert source notes to arrangement with role assignment
  const sourceArrangement = source.map((note, index) => {
    let role;
    if (melody.has(note)) role = 'vocals';
    else if (note.pitchMidi < 48) role = 'cello';
    else if (note.pitchMidi < 64) role = 'keys';
    else role = 'strings';

    const startTimeSeconds = note.startTimeSeconds;
    const durationSeconds = Math.max(0.035, Math.min(note.durationSeconds, limit - startTimeSeconds));
    const rawAmplitude = Number(note.amplitude);
    const amplitude = Number.isFinite(rawAmplitude)
      ? Math.max(0.02, Math.min(0.95, rawAmplitude))
      : 0.62;

    return {
      id: index + 1,
      role,
      pitchMidi: Math.round(note.pitchMidi),
      startTimeSeconds,
      durationSeconds,
      amplitude,
    };
  });

  // Generate orchestral accompaniment
  const bassLine = generateBassLine(phrases, duration);
  const drums = generateDrums(sourceArrangement, duration, 120);
  const harpArps = generateHarpArps(phrases, duration);
  const pizz = generatePizzicato(sourceArrangement, duration);
  const strings = generateStrings(phrases, duration);
  const horns = generateHorn(phrases, duration);
  const winds = generateWinds(phrases, duration);
  const timpani = generateTimpani(duration, 120);
  const trumpets = generateTrumpet(phrases, duration);
  const squareSynth = generateSquareSynth(phrases, duration);
  const chordPads = generateChordPads(phrases, duration);

  // Combine all notes
  const allNotes = [
    ...sourceArrangement,
    ...bassLine,
    ...drums,
    ...harpArps,
    ...pizz,
    ...strings,
    ...horns,
    ...winds,
    ...timpani,
    ...trumpets,
    ...squareSynth,
    ...chordPads
  ];

  // Apply humanized timing
  const humanized = humanizeTiming(allNotes);

  // Sort and assign final IDs
  return humanized
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi)
    .map((note, index) => ({ ...note, id: index + 1 }));
}

export function orchestraProgramsFor(notes) {
  return {
    drums: 0,
    bass: 43,
    guitar: 80,      // Square synth program
    vocals: 3,
    keys: 0,
    pad: 89,         // Pad program
    strings: 4,
    arp: 46,
    cello: 4,
    horn: 1,
    flute: 73,
    oboe: 68,
    clarinet: 71,
    timpani: 5,
    pizz: 45,
    trumpet: 2,
  };
}

// ULTRA Classic Roblox mix settings for maximum lo-fi crunch
export const ROBLOX_MIX_SETTINGS = {
  // Lower overall mix for that compressed vintage sound
  masterVolume: 0.88,

  // Role-specific volume balance (CC7) - LEAD WAY FORWARD
  roleVolume: {
    drums: 82,       // Louder drums
    bass: 110,       // MUCH louder bass (Roblox signature)
    guitar: 85,      // Louder square synth
    vocals: 118,     // Violin very forward
    keys: 55,        // Louder piano
    pad: 48,         // Louder pad
    strings: 75,     // Louder strings
    arp: 65,         // Louder arps
    cello: 88,       // Louder cello
    horn: 62,        // Louder horn
    flute: 72,       // Louder flute
    oboe: 60,        // Louder oboe
    clarinet: 58,    // Louder clarinet
    timpani: 80,     // Louder timpani
    pizz: 68,        // Louder pizz
    trumpet: 75,     // Louder trumpet
  },

  // Reverb levels (CC91) - LESS reverb (more dry, Roblox sound)
  reverb: {
    drums: 2,        // Very dry drums
    bass: 5,         // Dry bass
    guitar: 8,       // Dry synth
    vocals: 15,      // Less verb on lead
    keys: 10,
    pad: 25,
    strings: 30,
    arp: 20,
    cello: 18,
    horn: 25,
    flute: 22,
    oboe: 20,
    clarinet: 18,
    timpani: 10,
    pizz: 8,
    trumpet: 20,
  },

  // Pan positions (CC10) - WIDER stereo spread
  pan: {
    drums: 64,
    bass: 54,        // Bass more centered
    guitar: 30,      // Square synth left
    vocals: 70,      // Lead slightly right
    keys: 52,
    pad: 95,         // Pad far right
    strings: 75,     // Strings right
    arp: 110,        // Arps far right
    cello: 80,       // Cello right
    horn: 25,        // Horn far left
    flute: 105,      // Flute far right
    oboe: 85,        // Oboe right
    clarinet: 45,    // Clarinet left
    timpani: 64,
    pizz: 35,        // Pizz left
    trumpet: 15,     // Trumpet far left
  },

  // Chorus depth for added thickness (CC93) - MORE chorus
  chorus: {
    pad: 45,         // Heavy chorus on pad
    strings: 35,     // More chorus
    arp: 30,         // More chorus
    vocals: 18,      // Light chorus on lead
    guitar: 40,      // Heavy chorus on square synth
  },
};
