// CRA/webpack workers resolve chunks relative to the worker URL under
// /static/js/, which produces broken /static/js/static/js/*.chunk.js paths.
// Force absolute site root so importScripts finds the real chunks.
try {
  // eslint-disable-next-line no-undef
  __webpack_public_path__ = self.location.origin + '/';
} catch (e) {
  /* ignore if not a webpack build */
}

import * as tf from '@tensorflow/tfjs';
import {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
  BasicPitch,
} from '@spotify/basic-pitch';

const MODEL_URL = '/basic-pitch-model/model.json';

let basicPitchPromise = null;

async function getBasicPitch() {
  if (!basicPitchPromise) {
    basicPitchPromise = (async () => {
      await tf.setBackend('cpu');
      await tf.ready();
      const model = await tf.loadGraphModel(MODEL_URL);
      return new BasicPitch(model);
    })();
  }
  return basicPitchPromise;
}

function makeAudioBuffer(samples, sampleRate) {
  const data = samples instanceof Float32Array ? samples : new Float32Array(samples);
  return {
    sampleRate,
    length: data.length,
    duration: data.length / sampleRate,
    numberOfChannels: 1,
    getChannelData() {
      return data;
    },
  };
}

self.onmessage = async event => {
  const message = event.data || {};
  if (message.type !== 'transcribe') return;

  try {
    const audioBuffer = makeAudioBuffer(message.samples, message.sampleRate);
    const basicPitch = await getBasicPitch();
    const frames = [];
    const onsets = [];
    const contours = [];
    let lastProgressPost = 0;
    let processedFrames = 0;

    await basicPitch.evaluateModel(
      audioBuffer,
      (frameBatch, onsetBatch, contourBatch) => {
        frames.push(...frameBatch);
        onsets.push(...onsetBatch);
        contours.push(...contourBatch);
        processedFrames += frameBatch.length;

        // Basic Pitch 1.0.1 expects a third PercentCallback argument.
        // Frame batches are used only as a fallback progress estimate.
        const estimatedFrames = Math.max(1, Math.ceil(audioBuffer.duration * 86));
        const progress = Math.max(0, Math.min(0.99, processedFrames / estimatedFrames));
        if (progress >= 1 || progress - lastProgressPost >= 0.02) {
          lastProgressPost = progress;
          self.postMessage({ type: 'progress', value: progress });
        }
      },
      (progress) => {
        self.postMessage({
          type: 'progress',
          value: Math.max(0, Math.min(1, Number(progress) || 0)),
        });
      }
    );
    self.postMessage({ type: 'progress', value: 1 });

    const notes = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        outputToNotesPoly(frames, onsets, 0.34, 0.42, 8)
      )
    );

    self.postMessage({ type: 'result', notes });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error && error.message ? error.message : String(error),
    });
  }
};
