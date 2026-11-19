import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('GET /api/health mengembalikan status ok', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  } finally {
    server.close();
  }
});
