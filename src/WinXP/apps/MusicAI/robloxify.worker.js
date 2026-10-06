import * as tf from '@tensorflow/tfjs';
import { BasicPitch } from '@spotify/basic-pitch';

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

    await basicPitch.evaluateModel(
      audioBuffer,
      (frameBatch, onsetBatch, contourBatch) => {
        frames.push(...frameBatch);
        onsets.push(...onsetBatch);
        contours.push(...contourBatch);
      },
      value => {
        self.postMessage({
          type: 'progress',
          value: Math.max(0, Math.min(1, value)),
        });
      }
    );

    self.postMessage({ type: 'result', frames, onsets, contours });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error && error.message ? error.message : String(error),
    });
  }
};
