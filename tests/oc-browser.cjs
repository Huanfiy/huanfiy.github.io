/* Start ./run.sh test 8081 first. Uses an existing Puppeteer installation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const origin = process.env.OC_TEST_URL || 'http://localhost:8081';
const output = process.env.OC_TEST_OUTPUT || path.resolve(__dirname, '../tmp/oc-review');
fs.mkdirSync(output, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const problems = [];
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
async function ready(page) {
    await page.goto(origin, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => window.HuanYu && document.querySelector('[data-oc]').dataset.ready);
    await page.evaluate(() => document.querySelector('[data-oc-portrait]').decode());
}
async function pose(page, id) {
    await page.waitForFunction(id => {
        const root = document.querySelector('[data-oc]');
        const image = root.querySelector('[data-oc-portrait]');
        return root.dataset.pose === id && image.complete && image.naturalWidth === 768;
    }, {}, id);
}
async function layout(page) {
    const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        controls: [...document.querySelectorAll('.oc-actions button')].map(button => {
            const rect = button.getBoundingClientRect();
            return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth;
        })
    }));
    check(!result.overflow, 'No horizontal overflow');
    check(result.controls.every(Boolean), 'All action targets fit and are at least 44 px');
}
(async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        page.on('pageerror', error => problems.push(error.message));
        page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) problems.push(response.status() + ' ' + response.url()); });
        await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
        await page.evaluateOnNewDocument(() => {
            localStorage.setItem('theme', 'light');
            if (!sessionStorage.getItem('oc-test-seeded')) {
                localStorage.setItem('huanyu.keepsakes.v1', '{invalid');
                sessionStorage.setItem('oc-test-seeded', 'yes');
            }
        });
        await ready(page);
        await layout(page);
        check(await page.evaluate(() => !document.querySelector('#hero-cat') && !window.HuanYu.getState().voiceAvailable), 'Old mascot removed and voice defaults off');
        await pause(700);
        await page.screenshot({ path: path.join(output, 'desktop.png') });
        await page.focus('[data-oc-character]');
        await page.keyboard.press('Enter');
        await pose(page, 'hug');
        await page.keyboard.press('Space');
        check(await page.evaluate(() => window.HuanYu.getState().collected.length === 1), 'Keyboard character action collects once');
        for (const [action, image] of [['hug', 'hug'], ['milk', 'milk'], ['magic', 'magic'], ['read', 'read']]) {
            await page.click(`[data-oc-action="${action}"]`);
            await pose(page, image);
            check(await page.evaluate(action => window.HuanYu.getState().state === action, action), 'Action ' + action);
        }
        await page.click('[data-oc-open]');
        check(await page.evaluate(() => document.querySelector('[data-oc-book]').open && document.activeElement.matches('[data-oc-close]')), 'Dialog opens with close control focused');
        await page.click('[data-oc-action="circuit"]');
        await pose(page, 'read');
        check(await page.evaluate(() => window.HuanYu.getState().collected.length === 6 && !document.querySelector('[data-oc-book]').open), 'World interaction discovers sixth collectible');
        await page.click('[data-oc-open]');
        await page.focus('[data-oc-tab="profile"]');
        await page.keyboard.press('ArrowRight');
        check(await page.evaluate(() => document.activeElement.dataset.ocTab === 'collection' && !document.querySelector('[data-oc-panel="collection"]').hidden), 'Arrow keys switch accessible tabs');
        await page.screenshot({ path: path.join(output, 'collection.png') });
        await page.keyboard.press('End');
        await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('[data-oc-gallery] img')].map(image => image.decode())); });
        await page.screenshot({ path: path.join(output, 'gallery.png') });
        await page.click('[data-oc-preview="sleep"]');
        await pose(page, 'sleep');
        await page.click('[data-oc-character]');
        await pose(page, 'hug');
        await page.click('[data-oc-open]');
        await page.keyboard.press('Escape');
        check(await page.evaluate(() => !document.querySelector('[data-oc-book]').open && document.activeElement.matches('[data-oc-open]')), 'Escape restores focus');
        await ready(page);
        check(await page.evaluate(() => window.HuanYu.getState().collected.length === 6 && document.querySelector('[data-oc-speech]').textContent.includes('回来')), 'Collection and returning greeting survive reload');
        await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
        await page.waitForFunction(() => document.querySelector('#hero').dataset.daypart === 'night');
        await page.screenshot({ path: path.join(output, 'dark.png') });

        await page.evaluate(() => {
            window.ocVoiceCalls = [];
            window.HuanYu.setVoiceProvider({
                speak: ({ text, signal }) => new Promise(resolve => window.ocVoiceCalls.push({ text, signal, resolve })),
                listen: async () => '给我抱抱', stop() {}, dispose() {}
            });
        });
        check(await page.evaluate(() => window.ocVoiceCalls.length === 0 && !document.querySelector('[data-oc-voice]').hidden && document.querySelector('[data-oc-listen]').hidden), 'Installing adapter does not activate audio or microphone');
        await page.click('[data-oc-voice]');
        await page.waitForFunction(() => window.ocVoiceCalls.length === 1);
        await page.click('[data-oc-listen]');
        await page.waitForFunction(() => window.HuanYu.getState().state === 'hug' && window.ocVoiceCalls.length >= 2);
        check(await page.evaluate(() => window.ocVoiceCalls[0].signal.aborted), 'Listen interrupts existing voice and maps transcript to local action');
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
        await page.waitForFunction(() => window.HuanYu.getState().paused);
        check(await page.evaluate(() => window.ocVoiceCalls.at(-1).signal.aborted && document.querySelector('[data-oc]').dataset.paused === 'true'), 'Offscreen stops audio and animation');
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForFunction(() => !window.HuanYu.getState().paused);
        await page.evaluate(() => {
            const before = window.HuanYu;
            before.destroy(); before.destroy();
            window.ocDestroyedResult = before.interact('hug');
        });
        check(await page.evaluate(() => window.ocDestroyedResult === false && document.querySelector('[data-oc-character]').disabled && document.querySelector('[data-oc-voice]').hidden), 'Destroy is idempotent and disables interaction');
        await page.evaluate(async () => {
            const { mountCharacter } = await import('./js/oc-character.js');
            const root = document.querySelector('[data-oc]');
            window.HuanYu = mountCharacter(root);
            window.ocSameInstance = mountCharacter(root) === window.HuanYu;
            window.ocStateEvents = 0;
            root.addEventListener('oc:state', () => window.ocStateEvents++);
        });
        await pause(100);
        await page.evaluate(() => { window.ocStateEvents = 0; });
        await page.click('[data-oc-character]');
        check(await page.evaluate(() => window.ocSameInstance && window.ocStateEvents === 1), 'Remount adds one controller and no duplicate event listeners');

        const mobile = await browser.newPage();
        mobile.on('pageerror', error => problems.push(error.message));
        await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await mobile.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await ready(mobile);
        await layout(mobile);
        await mobile.evaluate(() => document.documentElement.dataset.theme = 'light');
        for (const element of await mobile.$$('[data-reveal]')) {
            await element.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await pause(100);
        }
        await mobile.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await pause(150);
        await mobile.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        await mobile.tap('[data-oc-action="magic"]');
        await pose(mobile, 'magic');
        check(await mobile.evaluate(() => getComputedStyle(document.querySelector('[data-oc-portrait]')).animationName === 'none' && !document.querySelector('[data-oc-sparkles]').childElementCount), 'Reduced motion preserves touch actions without animation');
        await mobile.tap('[data-oc-open]');
        await mobile.tap('[data-oc-tab="gallery"]');
        await mobile.evaluate(async () => { await Promise.all([...document.querySelectorAll('[data-oc-gallery] img')].map(image => image.decode())); });
        await mobile.screenshot({ path: path.join(output, 'mobile-gallery.png') });
        check(await mobile.evaluate(() => {
            const rect = document.querySelector('[data-oc-book]').getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth && rect.height <= innerHeight;
        }), 'Mobile dialog fits viewport');
        await mobile.close();

        const raceContext = await browser.createBrowserContext();
        const race = await raceContext.newPage();
        await race.setRequestInterception(true);
        race.on('request', request => {
            if (request.url().endsWith('/milk.webp')) setTimeout(() => request.continue().catch(() => {}), 800);
            else if (request.url().endsWith('/read.webp')) request.abort().catch(() => {});
            else request.continue().catch(() => {});
        });
        await ready(race);
        await race.evaluate(() => { window.HuanYu.interact('milk'); window.HuanYu.interact('magic'); });
        await pose(race, 'magic');
        await pause(1000);
        check(await race.evaluate(() => document.querySelector('[data-oc]').dataset.pose === 'magic'), 'Late old image cannot replace newest action');
        await race.evaluate(() => window.HuanYu.interact('read'));
        await pause(300);
        check(await race.evaluate(() => document.querySelector('[data-oc-portrait]').naturalWidth > 0 && document.querySelector('[data-oc]').dataset.pose === 'magic' && window.HuanYu.getState().state === 'read'), 'Asset failure retains a decoded portrait and working text interaction');
        await raceContext.close();

        const fallback = await browser.newPage();
        await fallback.setJavaScriptEnabled(false);
        await fallback.goto(origin, { waitUntil: 'networkidle2' });
        check(await fallback.$eval('[data-oc-portrait]', image => image.complete && image.naturalWidth > 0), 'No-JS keeps character illustration');
        check(await fallback.$eval('[data-oc-character]', button => button.disabled), 'No-JS does not offer broken action');
        await fallback.close();

        const blocked = await browser.newPage();
        await blocked.evaluateOnNewDocument(() => {
            Object.defineProperty(window, 'localStorage', { get() { throw Error('disabled'); } });
            const original = window.setTimeout;
            window.setTimeout = (fn, ms, ...args) => original(fn, ms === 45000 ? 150 : ms, ...args);
        });
        blocked.on('pageerror', error => problems.push(error.message));
        await ready(blocked);
        await blocked.waitForFunction(() => window.HuanYu.getState().state === 'sleep');
        await pose(blocked, 'sleep');
        await blocked.click('[data-oc-character]');
        check(await blocked.evaluate(() => window.HuanYu.getState().state === 'pat' && window.HuanYu.getState().collected.length === 1), 'Idle sleep wakes and storage denial falls back to session');
        await blocked.close();
        check(problems.length === 0, problems.join('\n'));
        console.log(`OC browser: ${checks} checks passed; screenshots: ${output}`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
