import { makeProject } from '@revideo/core';
import '../global.css';
import sandbox from '../scenes/sandbox.tsx';

export default makeProject({
    scenes: [sandbox],
    variables: { payload: '' },
    settings: {
        shared: { size: { x: 1920, y: 1080 }, background: '#080d19' },
        rendering: { fps: 60 }
    }
});
