import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { serveStatic } from './serve.ts';

test('serveStatic refuses a port that is in use and leaves its owner running', async () => {
    const owner = createServer();
    await new Promise<void>((resolve) => owner.listen(0, '127.0.0.1', resolve));
    const { port } = owner.address() as AddressInfo;
    try {
        await assert.rejects(serveStatic(mkdtempSync(join(tmpdir(), 'video-serve-')), port), {
            message: `Port ${port} is in use; stop whatever runs there or free it yourself`
        });
        assert.equal(owner.listening, true);
    } finally {
        await new Promise<void>((resolve) => owner.close(() => resolve()));
    }
});

test('serveStatic serves files and falls back to index.html', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-serve-'));
    writeFileSync(join(dir, 'index.html'), '<p>shell</p>');
    writeFileSync(join(dir, 'main.js'), 'console.log(1);');
    const server = await serveStatic(dir, 0);
    try {
        const js = await fetch(`${server.url}/main.js`);
        assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
        assert.equal(await js.text(), 'console.log(1);');
        assert.equal(await (await fetch(`${server.url}/?component=ButtonComponent`)).text(), '<p>shell</p>');
    } finally {
        await server.close();
    }
});
