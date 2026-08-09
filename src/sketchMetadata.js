export const sketchMetadata = {
  'number-1': {
    title: '#FractalsNo1',
    description: 'An exploration into generative animations inspired by fractals.',
    sketch: 'FractalsNo1.js',
  },
};

export function getAllSketches() {
  return Object.keys(sketchMetadata).map(id => ({
    id,
    ...sketchMetadata[id]
  }));
}
  
export function getSketchById(id) {
  return sketchMetadata[id] || null;
}
