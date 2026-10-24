import { makeProject } from '@revideo/core';
import '../global.css';
import release from '../scenes/release.tsx';

export default makeProject({
    scenes: [release],
    variables: { payload: '' },
    settings: {
        shared: { size: { x: 1920, y: 1080 }, background: '#080d19' },
        rendering: { fps: 60 }
    }
});
