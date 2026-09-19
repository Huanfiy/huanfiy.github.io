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
async function openBook(page) {
    if (await page.$eval('[data-oc-bubble]', bubble => bubble.hidden)) await page.click('[data-oc-character]');
    await page.click('[data-oc-open]');
}
async function layout(page) {
    const result = await page.evaluate(() => {
        const root = document.querySelector('[data-oc]');
        const rect = root.getBoundingClientRect();
        const intro = document.querySelector('.hero-content').getBoundingClientRect();
        const hero = document.querySelector('#hero').getBoundingClientRect();
        const bubble = document.querySelector('[data-oc-bubble]');
        const bubbleRect = bubble.getBoundingClientRect();
        const buttons = [...document.querySelectorAll('.hero-actions a')];
        const actions = buttons.map(button => button.getBoundingClientRect());
        const avatar = document.querySelector('.hero-avatar');
        return {
            introRestored: avatar?.parentElement.matches('.hero-content') && getComputedStyle(avatar).width === '128px' && getComputedStyle(avatar.querySelector('img')).height === '128px' && getComputedStyle(avatar, '::before').width === '56px' && getComputedStyle(avatar, '::after').width === '56px' && !document.querySelector('.home-byline, .home-intro'),
            introTypography: getComputedStyle(document.querySelector('.hero-content')).paddingTop === '48px' && getComputedStyle(document.querySelector('.hero-sub')).fontSize === '18.4px' && getComputedStyle(document.querySelector('.hero-kicker')).fontSize === '15.2px' && getComputedStyle(document.querySelector('.hero-actions')).gap === '19.2px',
            introCopy: buttons.map(button => button.textContent).join('|') === '开始探索|了解更多' && document.querySelector('.hero-sub').innerHTML === '一名热衷于技术分享与科技制作的探索者。<br>在这里记录学习，分享生活，构建有趣的世界。',
            overflow: document.documentElement.scrollWidth > innerWidth,
            compact: rect.width >= 44 && rect.width <= 180 && rect.height <= 180,
            corner: getComputedStyle(root).position === 'absolute' && rect.left >= innerWidth / 2 && rect.right <= innerWidth && rect.bottom <= hero.bottom && rect.top >= intro.bottom,
            noPanel: !document.querySelector('.oc-actions, .oc-meta, .oc-aura, .oc-world-label') && !root.closest('.hero-content'),
            bubbleFits: bubble.hidden || (bubbleRect.left >= 0 && bubbleRect.right <= innerWidth && bubbleRect.top >= hero.top && bubbleRect.bottom <= hero.bottom),
            noOverlap: bubble.hidden || actions.every(button => bubbleRect.bottom <= button.top || bubbleRect.top >= button.bottom || bubbleRect.right <= button.left || bubbleRect.left >= button.right)
        };
    });
    check(result.introRestored && result.introTypography && result.introCopy, 'Original centered introduction, taped avatar, typography and copy are preserved');
    check(!result.overflow, 'No horizontal overflow');
    check(result.compact && result.corner, 'Compact character sits in lower-right forest, outside intro layout');
    check(result.noPanel, 'No permanent action panel or decorative character frame');
    check(result.bubbleFits && result.noOverlap, 'Speech fits Hero without covering main actions');
}
async function footerLayouts(browser) {
    const page = await browser.newPage();
    page.on('pageerror', error => problems.push(error.message));
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) problems.push(response.status() + ' ' + response.url()); });
    for (const route of ['index.html', 'blog.html', 'tool.html', 'about.html', 'tools/downloads.html', 'tools/visualizations.html', 'tools/keyboard.html', 'tools/buy.html']) {
        await page.goto(`${origin}/${route}`, { waitUntil: 'networkidle2' });
        for (const width of [1440, 390]) {
            await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
            for (const theme of ['light', 'dark']) {
                const result = await page.evaluate(async theme => {
                    document.documentElement.dataset.theme = theme;
                    const footer = document.querySelector('footer');
                    footer.scrollIntoView({ block: 'end', behavior: 'instant' });
                    const style = getComputedStyle(footer, '::after');
                    const source = style.backgroundImage.match(/^url\("?([^"\)]+)"?\)$/)?.[1];
                    const image = new Image();
                    image.src = source || '';
                    await image.decode();
                    const rect = footer.getBoundingClientRect();
                    const right = rect.right - parseFloat(style.right);
                    const left = right - parseFloat(style.width);
                    const top = rect.top + parseFloat(style.top);
                    return {
                        samePortrait: new URL(image.src).pathname.endsWith('/picture/oc/sleep.webp') && image.naturalWidth === 768 && style.content === '""' && style.backgroundSize === 'contain',
                        samePlacement: style.width === '112px' && style.height === '90px' && style.top === '-70px' && style.position === 'absolute',
                        fits: left >= 0 && right <= innerWidth && top >= 0 && top + 90 <= innerHeight,
                        decorativeOnly: style.pointerEvents === 'none' && !document.querySelector('.oc-footer') && (document.querySelector('[data-oc]') || !window.HuanYu)
                    };
                }, theme);
                check(result.samePortrait && result.samePlacement, `${route}: same sleeping Xiao Yu in ${theme} at ${width}px`);
                check(result.fits && result.decorativeOnly, `${route}: footer decoration fits and does not add interaction`);
                if (!route.startsWith('tools/')) {
                    await pause(500); // Wait for theme colors and scroll-reveal painting before visual review.
                    await page.screenshot({ path: path.join(output, `footer-${route.replace('.html', '')}-${width}-${theme}.png`) });
                }
            }
        }
    }
    await page.close();
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
        await page.evaluate(() => window.HuanYu.say(''));
        check(await page.$eval('[data-oc-bubble]', bubble => bubble.hidden && bubble.getBoundingClientRect().height === 0), 'Empty speech has no visible panel or layout footprint');
        await pause(700);
        await page.screenshot({ path: path.join(output, 'desktop.png') });
        await page.focus('[data-oc-character]');
        await page.keyboard.press('Enter');
        await pose(page, 'hug');
        await page.keyboard.press('Space');
        check(await page.evaluate(() => window.HuanYu.getState().collected.length === 2 && window.HuanYu.getState().state === 'hug'), 'Enter and Space activate successive character interactions');
        for (const [action, image] of [['milk', 'milk'], ['magic', 'magic'], ['read', 'read'], ['pat', 'hug']]) {
            await page.click('[data-oc-character]');
            await pose(page, image);
            check(await page.evaluate(action => window.HuanYu.getState().state === action && !document.querySelector('[data-oc-bubble]').hidden, action), 'Character click cycles to ' + action + ' with speech');
        }
        check(await page.evaluate(() => window.HuanYu.getState().collected.length === 5), 'Repeated actions do not duplicate collectibles');
        await layout(page);
        await page.screenshot({ path: path.join(output, 'desktop-speech.png') });
        await openBook(page);
        check(await page.evaluate(() => document.querySelector('[data-oc-book]').open && document.activeElement.matches('[data-oc-close]')), 'Dialog opens with close control focused');
        await page.click('[data-oc-action="circuit"]');
        await pose(page, 'read');
        check(await page.evaluate(() => window.HuanYu.getState().collected.length === 6 && !document.querySelector('[data-oc-book]').open), 'World interaction discovers sixth collectible');
        await openBook(page);
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
        await openBook(page);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('[data-oc-book]').open && document.activeElement.matches('[data-oc-character]'));
        check(await page.$eval('[data-oc-bubble]', bubble => bubble.hidden), 'Escape restores focus to character, not hidden book link');
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
        await openBook(page);
        await page.click('[data-oc-tab="profile"]');
        await page.click('[data-oc-voice]');
        await page.waitForFunction(() => window.ocVoiceCalls.length === 1);
        await page.click('[data-oc-listen]');
        await page.waitForFunction(() => window.HuanYu.getState().state === 'hug' && window.ocVoiceCalls.length >= 2);
        check(await page.evaluate(() => window.ocVoiceCalls[0].signal.aborted), 'Listen interrupts existing voice and maps transcript to local action');
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
        await page.waitForFunction(() => window.HuanYu.getState().paused);
        check(await page.evaluate(() => window.ocVoiceCalls.at(-1).signal.aborted && document.querySelector('[data-oc]').dataset.paused === 'true' && document.querySelector('[data-oc-bubble]').hidden), 'Offscreen stops audio and animation and clears speech');
        await page.evaluate(() => window.HuanYu.say('不可见时不留下常驻气泡'));
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForFunction(() => !window.HuanYu.getState().paused);
        check(await page.$eval('[data-oc-bubble]', bubble => bubble.hidden), 'Returning onscreen does not resurrect stale speech');
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
        await mobile.evaluate(() => window.HuanYu.say(''));
        await mobile.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        for (let i = 0; i < 4; i++) await mobile.tap('[data-oc-character]');
        await pose(mobile, 'magic');
        check(await mobile.evaluate(() => getComputedStyle(document.querySelector('[data-oc-portrait]')).animationName === 'none' && getComputedStyle(document.querySelector('.hero-avatar')).animationName === 'none' && !document.querySelector('[data-oc-sparkles]').childElementCount), 'Reduced motion preserves touch actions without character or avatar animation');
        await layout(mobile);
        await mobile.screenshot({ path: path.join(output, 'mobile-speech.png') });
        for (const width of [320, 768]) {
            await mobile.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
            await mobile.evaluate(() => window.HuanYu.say('小羽的长句子。'.repeat(40)));
            await layout(mobile);
        }
        await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
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
        check(await fallback.$eval('[data-oc-bubble]', bubble => bubble.hidden && !bubble.textContent.includes('你好')), 'No-JS leaves no permanent speech panel');
        check(await fallback.$eval('footer', footer => getComputedStyle(footer, '::after').backgroundImage.includes('/picture/oc/sleep.webp')), 'Sleeping footer portrait does not depend on JavaScript');
        await fallback.close();

        const transient = await browser.newPage();
        transient.on('pageerror', error => problems.push(error.message));
        await transient.setViewport({ width: 1351, height: 900 });
        await ready(transient);
        const bounds = await transient.$eval('#hero', hero => hero.getBoundingClientRect().height);
        await transient.evaluate(() => window.HuanYu.say('第一句'));
        await pause(4200);
        await transient.evaluate(() => window.HuanYu.say('第二句'));
        await pause(1200);
        check(await transient.$eval('[data-oc-bubble]', bubble => !bubble.hidden && bubble.textContent.includes('第二句')), 'New speech replaces old text and resets dismissal timer');
        await transient.waitForFunction(() => document.querySelector('[data-oc-bubble]').hidden);
        check(await transient.$eval('#hero', hero => hero.getBoundingClientRect().height) === bounds, 'Auto-dismiss never changes Hero height');
        await transient.click('[data-oc-character]');
        await transient.focus('[data-oc-open]');
        await pause(5500);
        check(await transient.$eval('[data-oc-bubble]', bubble => !bubble.hidden), 'Focused speech link does not disappear on timeout');
        await transient.focus('[data-oc-character]');
        await transient.waitForFunction(() => document.querySelector('[data-oc-bubble]').hidden);
        await transient.evaluate(() => window.HuanYu.say('<img src=x onerror=alert(1)>'));
        check(await transient.$eval('[data-oc-speech]', speech => !speech.children.length && speech.textContent.startsWith('<img')), 'Speech renders text, never HTML');
        await transient.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        check(await transient.$eval('[data-oc-bubble]', bubble => bubble.hidden), 'Page hide clears pending speech');
        await transient.evaluate(() => window.dispatchEvent(new Event('pageshow')));
        check(await transient.$eval('[data-oc-bubble]', bubble => bubble.hidden), 'Page show does not restore an expired bubble');
        for (const [width, height] of [[769, 768], [1024, 768], [1280, 720], [1920, 1080], [2560, 1440]]) {
            await transient.setViewport({ width, height });
            await transient.evaluate(() => window.HuanYu.say('小羽的长句子。'.repeat(40)));
            await layout(transient);
        }
        await transient.click('[data-oc-character]');
        await transient.evaluate(() => window.HuanYu.destroy());
        check(await transient.$eval('[data-oc-bubble]', bubble => bubble.hidden), 'Destroy hides active speech');
        await transient.close();

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
        await footerLayouts(browser);
        check(problems.length === 0, problems.join('\n'));
        console.log(`OC browser: ${checks} checks passed; screenshots: ${output}`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
