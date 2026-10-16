import test from 'node:test';
import assert from 'node:assert/strict';
import { createGooglePhotoAccess } from './googlePhotoSync.js';

function setup(request = () => {}) {
  let config;
  let requests = 0;
  const access = createGooglePhotoAccess({ initTokenClient: options => {
    config = options;
    return { requestAccessToken: () => { requests++; request(); } };
  } }, 'client-id', 'faculty@school.edu');
  return { access, get config() { return config; }, get requests() { return requests; } };
}

test('menu starts authorization immediately, deduplicates clicks, and reuses an unexpired token', async () => {
  const sync = setup();
  const first = sync.access();
  assert.equal(sync.requests, 1);
  assert.equal(sync.config.hint, 'faculty@school.edu');
  assert.equal(sync.config.prompt, '');
  assert.equal(sync.access(), first);
  sync.config.callback({ access_token: 'token', expires_in: 3600 });
  assert.equal(await first, 'token');
  assert.equal(await sync.access(), 'token');
  assert.equal(sync.requests, 1);
});

test('cancellation and denied permission reject cleanly and permit another attempt', async () => {
  const sync = setup();
  const cancelled = sync.access();
  sync.config.error_callback({ type: 'popup_closed' });
  await assert.rejects(cancelled, /cancelled/);
  const denied = sync.access();
  sync.config.callback({ error: 'access_denied' });
  await assert.rejects(denied, /not granted/);
  const retried = sync.access();
  sync.config.callback({ access_token: 'new-token', expires_in: 3600 });
  assert.equal(await retried, 'new-token');
  assert.equal(sync.requests, 3);
});

test('expired tokens request new permission and blocked popups release the pending operation', async () => {
  const sync = setup();
  const first = sync.access();
  sync.config.callback({ access_token: 'expired', expires_in: 0 });
  await first;
  const next = sync.access();
  sync.config.error_callback({ type: 'popup_failed_to_open' });
  await assert.rejects(next, /Allow popups/);
  assert.equal(sync.requests, 2);
  const broken = setup(() => { throw new Error('blocked'); });
  await assert.rejects(broken.access(), /Could not start/);
  await assert.rejects(broken.access(), /Could not start/);
  assert.equal(broken.requests, 2);
});
