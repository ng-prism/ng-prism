import { makeProject } from '@revideo/core';
import '../global.css';
import tour from '../scenes/tour/tour.tsx';

export default makeProject({
    scenes: [tour],
    variables: { payload: '' },
    settings: {
        shared: { size: { x: 1920, y: 1080 }, background: '#080d19' },
        rendering: { fps: 60 }
    }
});
