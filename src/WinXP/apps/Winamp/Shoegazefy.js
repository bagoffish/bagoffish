import React, { useEffect, useRef, useState } from 'react';
import Webamp from 'webamp';
import { initialTracks } from './config';

const SKINS = [
  {
    name: 'Classic',
    url: 'https://archive.org/cors/winampskin_Zelda_Amp/Zelda-Amp.wsz',
  },
  {
    name: 'Green Dimension',
    url: 'https://archive.org/cors/winampskin_Green-Dimension-V2/Green-Dimension-V2.wsz',
  },
  {
    name: 'Mac OSX Aqua',
    url: 'https://archive.org/cors/winampskin_mac_os_x_1_5-aqua/mac_os_x_1_5-aqua.wsz',
  },
];

const buttonStyle = {
  background: 'linear-gradient(#4f4f4f, #171717)',
  border: '1px solid #8b8b8b',
  borderRightColor: '#111',
  borderBottomColor: '#111',
  color: '#ddd',
  fontFamily: 'Tahoma, Arial, sans-serif',
  fontSize: 11,
  padding: '4px 8px',
  cursor: 'pointer',
};

function writeWav(left, right, sampleRate) {
  const frames = Math.min(left.length, right.length);
  const buffer = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + frames * 4, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, frames * 4, true);

  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function createImpulse(context, seconds, decay) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

async function renderEffect(audioBuffer, type) {
  const sampleRate = audioBuffer.sampleRate;
  const context = new OfflineAudioContext(
    Math.max(2, audioBuffer.numberOfChannels),
    audioBuffer.length,
    sampleRate
  );
  const source = context.createBufferSource();
  source.buffer = audioBuffer;

  const input = context.createGain();
  const output = context.createGain();
  source.connect(input);
  input.connect(output);
  output.connect(context.destination);

  if (type === 'blur') {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 150;

    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4200;
    lowpass.Q.value = 0.7;

    const delay = context.createDelay(0.5);
    delay.delayTime.value = 0.19;
    const feedback = context.createGain();
    feedback.gain.value = 0.28;

    input.disconnect();
    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(output);
    lowpass.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(output);
    output.gain.value = 0.72;
  }

  if (type === 'distorted') {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 80;

    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 7600;

    const shaper = context.createWaveShaper();
    const curve = new Float32Array(8192);
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = Math.tanh(x * 4.8);
    }
    shaper.curve = curve;
    shaper.oversample = '4x';

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    const delay = context.createDelay(0.4);
    delay.delayTime.value = 0.11;
    const wet = context.createGain();
    wet.gain.value = 0.18;

    input.disconnect();
    input.connect(highpass);
    highpass.connect(shaper);
    shaper.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(output);
    compressor.connect(delay);
    delay.connect(wet);
    wet.connect(output);
    output.gain.value = 0.82;
  }

  if (type === 'wash') {
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1450;
    band.Q.value = 0.45;

    const shaper = context.createWaveShaper();
    const curve = new Float32Array(4096);
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = Math.tanh(x * 1.9);
    }
    shaper.curve = curve;

    const convolver = context.createConvolver();
    convolver.buffer = createImpulse(context, 1.7, 2.3);
    const wet = context.createGain();
    wet.gain.value = 0.62;

    const delay = context.createDelay(0.7);
    delay.delayTime.value = 0.31;
    const delayWet = context.createGain();
    delayWet.gain.value = 0.35;

    input.disconnect();
    input.connect(band);
    band.connect(shaper);
    shaper.connect(output);
    shaper.connect(convolver);
    convolver.connect(wet);
    wet.connect(output);
    shaper.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(output);
    output.gain.value = 0.78;
  }

  source.start(0);
  return context.startRendering();
}

function blobFromStem(stem) {
  return writeWav(stem.left, stem.right, 44100);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StemRow({ name, blob, url, onAdd }) {
  if (!blob || !url) return null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      gap: 5,
      alignItems: 'center',
      padding: '3px 0',
      borderBottom: '1px dotted #3b3b3b',
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => downloadBlob(blob, 'shoegazefy-' + name.toLowerCase().replace(/\\s+/g, '-') + '.wav')}
      >
        SAVE
      </button>
      <button type="button" style={buttonStyle} onClick={() => onAdd(blob, name)}>
        ADD
      </button>
      <audio src={url} controls style={{ gridColumn: '1 / -1', width: '100%', height: 24 }} />
    </div>
  );
}

function Shoegazefy({ onClose, onMinimize }) {
  const playerRef = useRef(null);
  const webamp = useRef(null);
  const objectUrls = useRef([]);
  const [sourceFile, setSourceFile] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [status, setStatus] = useState('DROP AUDIO OR CHOOSE A FILE');
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [stems, setStems] = useState([]);
  const [effectUrls, setEffectUrls] = useState([]);
  const [skinName, setSkinName] = useState('Classic');

  const rememberUrl = (url) => {
    objectUrls.current.push(url);
    return url;
  };

  useEffect(() => {
    const target = playerRef.current;
    if (!target) return undefined;

    if (Webamp.browserIsSupported && !Webamp.browserIsSupported()) {
      setStatus('WEBAMP IS NOT SUPPORTED BY THIS BROWSER');
      return undefined;
    }

    webamp.current = new Webamp({
      initialTracks,
      availableSkins: SKINS,
      enableMediaSession: true,
    });

    webamp.current.onClose(onClose);
    webamp.current.onMinimize(onMinimize);

    webamp.current
      .renderWhenReady(target)
      .catch((error) => setStatus('WEBAMP ERROR: ' + error.message));

    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
      if (webamp.current) {
        webamp.current.dispose();
        webamp.current = null;
      }
    };
  }, [onClose, onMinimize]);

  const loadAudio = async (file) => {
    if (!file || !file.type.startsWith('audio/')) {
      setStatus('PLEASE CHOOSE AN AUDIO FILE');
      return;
    }

    setSourceFile(file);
    setStems([]);
    setEffectUrls([]);
    setProgress(0);
    setStatus('DECODING ' + file.name.toUpperCase() + '...');

    try {
      const context = new AudioContext({ sampleRate: 44100 });
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      await context.close();
      setAudioBuffer(buffer);

      const url = rememberUrl(URL.createObjectURL(file));
      if (webamp.current) {
        webamp.current.setTracksToPlay([
          {
            blob: file,
            defaultName: file.name,
            metaData: { title: file.name, artist: 'Shoegazefy' },
          },
        ]);
        webamp.current.pause();
      }
      setStatus('READY — ' + Math.round(buffer.duration) + ' SEC / ' + buffer.sampleRate + ' HZ');
      return url;
    } catch (error) {
      setStatus('COULD NOT DECODE FILE: ' + error.message);
    }
    return null;
  };

  const onAudioChange = (event) => {
    loadAudio(event.target.files && event.target.files[0]);
  };

  const runAIStems = async () => {
    if (!audioBuffer) {
      setStatus('LOAD AUDIO FIRST');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setStatus('LOADING DEMUCS MODEL (~172 MB, FIRST RUN ONLY)...');

    try {
      const ort = await import('onnxruntime-web');
      const demucs = await import('demucs-web');
      ort.env.wasm.numThreads = Math.max(1, Math.min(8, navigator.hardwareConcurrency || 4));

      const processor = new demucs.DemucsProcessor({
        ort,
        onProgress: ({ progress }) => {
          setProgress(progress);
          setStatus('SEPARATING STEMS — ' + Math.round(progress * 100) + '%');
        },
        onDownloadProgress: (loaded, total) => {
          if (total) {
            setProgress(loaded / total);
            setStatus(
              'DOWNLOADING MODEL — ' +
                Math.round((loaded / total) * 100) +
                '%'
            );
          }
        },
      });

      await processor.loadModel(demucs.CONSTANTS.DEFAULT_MODEL_URL);
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
      const result = await processor.separate(left, right);

      const nextStems = ['vocals', 'drums', 'bass', 'other'].map((name) => {
        const blob = blobFromStem(result[name]);
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          blob,
          url: rememberUrl(URL.createObjectURL(blob)),
        };
      });

      setStems(nextStems);
      setProgress(1);
      setStatus('DONE — 4 AI STEMS READY');
    } catch (error) {
      console.error(error);
      setStatus(
        'AI SEPARATION FAILED — TRY SHOegaze FX INSTEAD'
      );
    } finally {
      setProcessing(false);
    }
  };

  const playProcessedInWinamp = (blob, name) => {\n    if (!webamp.current) {\n      setStatus('WINAMP IS NOT READY YET');\n      return;\n    }\n\n    webamp.current.setTracksToPlay([\n      {\n        blob,\n        defaultName: name + '.wav',\n        metaData: { title: name, artist: 'Shoegazefy' },\n      },\n    ]);\n    setStatus(name.toUpperCase() + ' PLAYING IN WINAMP');\n  };\n\n  const runEffects = async () => {
    if (!audioBuffer) {
      setStatus('LOAD AUDIO FIRST');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setStatus('RENDERING SHOegaze FX...');

    try {
      const effects = [
        ['Blurred', 'blur'],
        ['Distorted Guitar', 'distorted'],
        ['Dream Wash', 'wash'],
      ];
      const next = [];

      for (let i = 0; i < effects.length; i += 1) {
        setStatus('RENDERING ' + effects[i][0].toUpperCase() + '...');
        const rendered = await renderEffect(audioBuffer, effects[i][1]);
        const blob = writeWav(
          rendered.getChannelData(0),
          rendered.numberOfChannels > 1
            ? rendered.getChannelData(1)
            : rendered.getChannelData(0),
          rendered.sampleRate
        );
        next.push({
          name: effects[i][0],
          blob,
          url: rememberUrl(URL.createObjectURL(blob)),
        });
        setProgress((i + 1) / effects.length);
      }

      setEffectUrls(next);
      setStatus('DONE — SHOegaze FX READY');
    } catch (error) {
      console.error(error);
      setStatus('EFFECT RENDER FAILED: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const addToPlayer = (blob, name) => {
    if (!webamp.current) return;
    webamp.current.appendTracks([
      {
        blob,
        defaultName: name,
        metaData: { title: name, artist: 'Shoegazefy' },
      },
    ]);
    setStatus(name.toUpperCase() + ' ADDED TO PLAYLIST');
  };

  const loadSkin = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !webamp.current) return;
    const url = rememberUrl(URL.createObjectURL(file));
    webamp.current.setSkinFromUrl(url);
    setSkinName(file.name);
    setStatus('SKIN LOADED — ' + file.name.toUpperCase());
  };

  const choosePresetSkin = (event) => {
    const value = event.target.value;
    if (!value || !webamp.current) return;
    const skin = SKINS.find((item) => item.name === value);
    if (!skin) return;
    webamp.current.setSkinFromUrl(skin.url);
    setSkinName(skin.name);
    setStatus('SKIN LOADED — ' + skin.name.toUpperCase());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none' }}>
      <div
        ref={playerRef}
        style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }}
      />

      <section style={{
        position: 'fixed',
        top: 92,
        right: 18,
        width: 330,
        maxHeight: 'calc(100vh - 112px)',
        overflow: 'auto',
        pointerEvents: 'auto',
        color: '#d7d7d7',
        background: 'linear-gradient(#303030, #0d0d0d)',
        border: '2px solid #707070',
        boxShadow: '3px 3px 0 #000, inset 1px 1px #b0b0b0',
        fontFamily: 'Tahoma, Arial, sans-serif',
        fontSize: 11,
      }}>
        <div style={{
          padding: '4px 6px',
          color: '#fff',
          fontWeight: 'bold',
          letterSpacing: 1,
          background: 'linear-gradient(#4b4b4b, #111)',
          borderBottom: '1px solid #000',
        }}>
          SHOEGAZEFY // DSP LAB
        </div>

        <div style={{ padding: 8 }}>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files && event.dataTransfer.files[0];
              loadAudio(file);
            }}
            style={{
              border: '1px dashed #777',
              background: '#050505',
              padding: 10,
              textAlign: 'center',
              marginBottom: 7,
            }}
          >
            <div style={{ color: '#8bdcff', marginBottom: 5 }}>AUDIO INPUT</div>
            <div style={{ marginBottom: 7 }}>DROP MP3 / WAV / FLAC / OGG HERE</div>
            <label style={buttonStyle}>
              LOAD AUDIO
              <input
                type="file"
                accept="audio/*"
                onChange={onAudioChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div style={{
            background: '#090909',
            border: '1px inset #555',
            padding: 6,
            marginBottom: 7,
            color: '#9dff9d',
            minHeight: 16,
          }}>
            {status}
          </div>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            <button type="button" style={buttonStyle} disabled={processing} onClick={runAIStems}>
              AI SPLIT
            </button>
            <button type="button" style={buttonStyle} disabled={processing} onClick={runEffects}>
              SHOEGAZEFY
            </button>
            <button
              type="button"
              style={buttonStyle}
              disabled={processing || (!stems.length && !effectUrls.length)}
              onClick={() => {
                [...stems, ...effectUrls].forEach((stem) => downloadBlob(
                  stem.blob,
                  'shoegazefy-' + stem.name.toLowerCase().replace(/\\s+/g, '-') + '.wav'
                ));
              }}
            >
              SAVE ALL
            </button>
          </div>

          {(processing || progress > 0) && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ height: 7, background: '#000', border: '1px inset #555' }}>
                <div style={{
                  width: Math.round(progress * 100) + '%',
                  height: '100%',
                  background: '#5eff5e',
                }} />
              </div>
            </div>
          )}

          {stems.length > 0 && (
            <div style={{
              borderTop: '1px solid #555',
              paddingTop: 5,
              marginBottom: 8,
            }}>
              <div style={{ color: '#8bdcff', marginBottom: 4 }}>AI STEMS</div>
              {stems.map((stem) => (
                <StemRow key={stem.name} {...stem} onAdd={addToPlayer} />
              ))}
            </div>
          )}

          {effectUrls.length > 0 && (
            <div style={{
              borderTop: '1px solid #555',
              paddingTop: 5,
              marginBottom: 8,
            }}>
              <div style={{ color: '#ff9de1', marginBottom: 4 }}>SHOEGAZE FX</div>
              {effectUrls.map((stem) => (
                <StemRow key={stem.name} {...stem} onAdd={addToPlayer} />
              ))}
            </div>
          )}

          <div style={{
            borderTop: '1px solid #555',
            paddingTop: 6,
            display: 'flex',
            gap: 5,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <span style={{ color: '#aaa' }}>SKIN:</span>
            <select
              value={SKINS.some((skin) => skin.name === skinName) ? skinName : ''}
              onChange={choosePresetSkin}
              style={{ background: '#111', color: '#ddd', border: '1px solid #666', fontSize: 11 }}
            >
              <option value="">Preset...</option>
              {SKINS.map((skin) => <option key={skin.name} value={skin.name}>{skin.name}</option>)}
            </select>

            <label style={buttonStyle}>
              LOAD .WSZ
              <input
                type="file"
                accept=".wsz,.zip,application/zip"
                onChange={loadSkin}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div style={{ marginTop: 7, color: '#777', lineHeight: '14px' }}>
            AI SPLIT uses local browser inference for vocals / drums / bass / other.
            SHOEGAZEFY creates creative DSP layers: blurred, distorted guitar, and dream wash.
            Your audio is not uploaded by this app.
          </div>
        </div>
      </section>
    </div>
  );
}

export default Shoegazefy;
