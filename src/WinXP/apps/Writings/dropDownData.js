const writings = [
  "Chrysalis of Light",
  "Rising from Ashes",
  "If I Forget",
  "The Edge of Meaning",
  "Sweetness of the Grave",
  "After You",
  "Echoes Between Us",
  "I Ought to Be Thy Adam",
  "Some thoughts",
  "I don't think you can get away with it for long",
  "Talking about love",
  "After reading 920London",
  "After reading Your Wings My Wings",
  "Untitled",
  "Goodnight",
];

const File = [
  {
    type: 'item',
    disable: true,
    text: 'New',
  },
  {
    type: 'item',
    disable: true,
    text: 'Open...',
  },
  {
    type: 'item',
    disable: true,
    text: 'Save',
  },
  {
    type: 'item',
    disable: true,
    text: 'Save As...',
  },
  {
    type: 'separator',
  },
  {
    type: 'menu',
    text: 'Files',
    position: { left: '100%', top: '-5px' },
    items: writings.map(writing => ({
      type: 'item',
      text: writing,
    })),
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Exit',
  },
];
const Edit = [
  {
    type: 'item',
    disable: true,
    text: 'Undo...',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    disable: true,
    text: 'Cut',
  },
  {
    type: 'item',
    disable: true,
    text: 'Copy',
  },
  {
    type: 'item',
    disable: true,
    text: 'Paste',
  },
  {
    type: 'item',
    disable: true,
    text: 'Delete',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    disable: true,
    text: 'Find...',
  },
  {
    type: 'item',
    disable: true,
    text: 'Find Next',
  },
  {
    type: 'item',
    disable: true,
    text: 'Replace...',
  },
  {
    type: 'item',
    disable: true,
    text: 'Go To...',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    disable: true,
    text: 'Select All',
  },
  {
    type: 'item',
    text: 'Time/Date',
  },
];
const Format = [
  {
    type: 'item',
    text: 'Word Wrap',
  },
  {
    type: 'item',
    disable: true,
    text: 'Font...',
  },
];
const View = [
  {
    type: 'item',
    disable: true,
    text: 'Status Bar',
  },
];
const Help = [
  {
    type: 'item',
    disable: true,
    text: 'Help Topics',
  },
  {
    type: 'item',
    disable: true,
    text: 'About Notepad',
  },
];
export default { File, Edit, Format, View, Help };
