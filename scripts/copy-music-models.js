const fs = require('fs');
const path = require('path');

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.readdirSync(source, { withFileTypes: true }).forEach(entry => {
    const src = path.join(source, entry.name);
    const dst = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  });
}

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const basicPitchModel = path.join(root, 'node_modules', '@spotify', 'basic-pitch', 'model');
const basicPitchDestination = path.join(publicDir, 'basic-pitch-model');
const processor = path.join(root, 'node_modules', 'spessasynth_lib', 'dist', 'spessasynth_processor.min.js');
const processorDestination = path.join(publicDir, 'spessasynth_processor.min.js');

if (!fs.existsSync(basicPitchModel)) {
  throw new Error('Basic Pitch model was not installed.');
}
if (!fs.existsSync(processor)) {
  throw new Error('SpessaSynth processor was not installed.');
}

copyDir(basicPitchModel, basicPitchDestination);
fs.copyFileSync(processor, processorDestination);
console.log('Copied Basic Pitch model and SpessaSynth processor to public/.');
