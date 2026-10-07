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
const basicPitchModel = path.join(
  root,
  'node_modules',
  '@spotify',
  'basic-pitch',
  'model'
);
const basicPitchDestination = path.join(publicDir, 'basic-pitch-model');
const processorCandidates = [
  path.join(
    root,
    'node_modules',
    'spessasynth_lib',
    'dist',
    'spessasynth_processor.min.js'
  ),
  path.join(publicDir, 'spessasynth_processor.min.js'),
];
const processorDestination = path.join(publicDir, 'spessasynth_processor.min.js');

let copied = 0;

if (fs.existsSync(basicPitchModel)) {
  copyDir(basicPitchModel, basicPitchDestination);
  console.log('Copied Basic Pitch model to public/basic-pitch-model');
  copied += 1;
} else if (fs.existsSync(path.join(basicPitchDestination, 'model.json'))) {
  console.log('Basic Pitch model already present in public/; skipping copy');
} else {
  console.warn(
    'Warning: Basic Pitch model not found in node_modules. Using existing public/ assets if any.'
  );
}

const processor = processorCandidates.find(p => fs.existsSync(p));
if (processor && path.resolve(processor) !== path.resolve(processorDestination)) {
  fs.copyFileSync(processor, processorDestination);
  console.log('Copied SpessaSynth processor to public/');
  copied += 1;
} else if (fs.existsSync(processorDestination)) {
  console.log('SpessaSynth processor already present in public/; skipping copy');
} else {
  console.warn(
    'Warning: SpessaSynth processor not found. Playback may fail until dependencies install cleanly.'
  );
}

// Never fail the install/build — public/ already ships these assets in git.
console.log('copy-music-models finished (copied ' + copied + ' item(s)).');
process.exit(0);
