const test = require('node:test');
const assert = require('node:assert/strict');
const world = import('../js/oc-world.js');
const voice = import('../js/oc-voice.js');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('collection tolerates damaged, unavailable and untrusted storage', async () => {
    const { readCollection } = await world;
    for (const value of ['{broken', '{}', 'null', '42']) assert.deepEqual(readCollection({ getItem: () => value }), []);
    assert.deepEqual(readCollection({ getItem: () => { throw Error('blocked'); } }), []);
    assert.deepEqual(readCollection(undefined), []);
    assert.deepEqual(readCollection({ getItem: () => '["cloud","cloud","<script>","bell",null,{}]' }), ['cloud', 'bell']);
});

test('offline actions reference real poses, assets and collectibles', async () => {
    const { ACTIONS, POSES, KEEPSAKES, greeting, actionFromTranscript } = await world;
    const { existsSync } = require('node:fs');
    const { resolve } = require('node:path');
    for (const action of Object.values(ACTIONS)) {
        assert.ok(POSES[action.pose]);
        assert.ok(KEEPSAKES.some(item => item.id === action.item));
        assert.ok(action.lines.length && action.lines.every(line => typeof line === 'string' && line.length));
    }
    for (const pose of Object.values(POSES)) assert.ok(existsSync(resolve(__dirname, '..', pose.src)), pose.src);
    for (const part of ['dawn', 'day', 'dusk', 'night', null]) assert.ok(greeting(part).length);
    assert.equal(actionFromTranscript('给我抱抱'), 'hug');
    assert.equal(actionFromTranscript('打开 https://example.com'), null);
    assert.equal(actionFromTranscript(null), null);
});

test('all shared footers use the same sleeping portrait without homepage overrides', async () => {
    const { readFileSync, existsSync } = require('node:fs');
    const { resolve, dirname } = require('node:path');
    const { POSES } = await world;
    const root = resolve(__dirname, '..');
    const stylesheet = resolve(root, 'css/style.css');
    const css = readFileSync(stylesheet, 'utf8');
    const footer = css.match(/\nfooter::after\s*\{([^}]+)\}/)?.[1];
    assert.ok(footer, 'Shared footer decoration exists');
    const source = footer.match(/url\("([^"]+)"\)/)?.[1];
    assert.ok(source, 'Footer loads a self-hosted asset');
    const asset = resolve(dirname(stylesheet), source);
    assert.equal(asset, resolve(root, POSES.sleep.src));
    assert.ok(existsSync(asset));
    assert.match(footer, /width:\s*112px/);
    assert.match(footer, /height:\s*90px/);
    assert.match(footer, /top:\s*-70px/);
    assert.match(footer, /pointer-events:\s*none/);
    assert.equal((css.match(/footer::after/g) || []).length, 1, 'No theme-specific cat replacement');
    assert.doesNotMatch(readFileSync(resolve(root, 'css/oc.css'), 'utf8'), /footer::after|\.oc-footer/);
    for (const file of ['index.html', 'blog.html', 'tool.html', 'about.html', 'tools/downloads.html', 'tools/visualizations.html', 'tools/keyboard.html', 'tools/buy.html']) {
        const html = readFileSync(resolve(root, file), 'utf8');
        assert.match(html, /<footer>/, file);
        assert.doesNotMatch(html, /class="oc-footer"/, 'No duplicate decoration: ' + file);
        const href = html.match(/href="([^"]*css\/style\.css)"/)?.[1];
        assert.ok(href, file);
        assert.equal(resolve(root, dirname(file), href), stylesheet, file);
    }
});

test('voice remains inert until explicitly enabled and supports playback-only adapters', async () => {
    const { createVoiceChannel } = await voice;
    let calls = 0;
    const channel = createVoiceChannel();
    assert.equal(channel.available, false);
    await channel.speak({ text: 'hello' });
    channel.setProvider({ speak: async () => { calls++; return 'done'; } });
    await channel.speak({ text: 'hello' });
    assert.equal(calls, 0);
    assert.equal(channel.canListen, false);
    channel.setEnabled(true);
    assert.equal(await channel.speak({ text: 'hello' }), 'done');
    assert.equal(calls, 1);
    assert.equal(await channel.listen(), null);
    channel.destroy();
});

test('new speech cancels old speech without letting old cleanup stop the new playback', async () => {
    const { createVoiceChannel } = await voice;
    const requests = [];
    let stops = 0;
    const states = [];
    const channel = createVoiceChannel(state => states.push(state));
    channel.setProvider({ speak: args => new Promise(resolve => requests.push({ ...args, resolve })), stop: () => stops++ });
    channel.setEnabled(true);
    const first = channel.speak({ text: 'first' });
    await tick();
    const second = channel.speak({ text: 'second' });
    await tick();
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(requests[1].signal.aborted, false);
    const stopsAfterReplace = stops;
    requests[0].resolve('late first');
    assert.equal(await first, null);
    assert.equal(stops, stopsAfterReplace);
    requests[1].resolve('second');
    assert.equal(await second, 'second');
    assert.equal(states.at(-1), 'idle');
    channel.destroy();
});

test('voice recovers from timeout, rejection and synchronous cancellation', async () => {
    const { createVoiceChannel } = await voice;
    const states = [];
    const channel = createVoiceChannel(state => states.push(state), 15);
    let signal;
    channel.setProvider({ speak: args => { signal = args.signal; return new Promise(() => {}); } });
    channel.setEnabled(true);
    assert.equal(await channel.speak({ text: 'timeout' }), null);
    assert.equal(signal.aborted, true);
    assert.equal(states.at(-1), 'idle');
    channel.setProvider({ speak: () => { throw Error('offline'); } });
    channel.setEnabled(true);
    assert.equal(await channel.speak({ text: 'error' }), null);
    let calls = 0;
    channel.setProvider({ speak: () => calls++ });
    channel.setEnabled(true);
    const pending = channel.speak({ text: 'cancel before start' });
    channel.stop();
    assert.equal(await pending, null);
    assert.equal(calls, 0);
    channel.destroy();
});

test('provider replacement cancels listening, revokes enablement and disposes once', async () => {
    const { createVoiceChannel } = await voice;
    let disposed = 0;
    let signal;
    const channel = createVoiceChannel();
    channel.setProvider({ speak: async () => {}, listen: args => { signal = args.signal; return new Promise(() => {}); }, dispose: () => disposed++ });
    channel.setEnabled(true);
    const listening = channel.listen();
    await tick();
    channel.setProvider(null);
    assert.equal(signal.aborted, true);
    assert.equal(await listening, null);
    assert.equal(channel.enabled, false);
    assert.equal(channel.available, false);
    channel.destroy(); channel.destroy();
    assert.equal(disposed, 1);
});
