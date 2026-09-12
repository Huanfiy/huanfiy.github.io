import { CHARACTER, POSES, KEEPSAKES, ACTIONS, greeting, readCollection, actionFromTranscript } from './oc-world.js';
import { createVoiceChannel } from './oc-voice.js';

const instances = new WeakMap();
const icon = name => `<svg class="oc-icon" viewBox="0 0 64 64" aria-hidden="true"><use href="picture/oc/keepsakes.svg#${name}"/></svg>`;

export function mountCharacter(root) {
    if (!root) return null;
    if (instances.has(root)) return instances.get(root);
    const $ = selector => root.querySelector(selector);
    const character = $('[data-oc-character]');
    const portrait = $('[data-oc-portrait]');
    const speech = $('[data-oc-speech]');
    const mood = $('[data-oc-mood]');
    const notice = $('[data-oc-notice]');
    const book = $('[data-oc-book]');
    const voiceButton = $('[data-oc-voice]');
    const listenButton = $('[data-oc-listen]');
    const hero = root.closest('.hero');
    const events = new AbortController();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const timers = new Map();
    const images = new Map();
    let storage;
    try { storage = localStorage; } catch { /* Session-only when storage is unavailable. */ }
    let collected = readCollection(storage);
    let destroyed = false;
    let visible = true;
    let state = 'welcome';
    let version = 0;
    let imageVersion = 0;
    let opener = null;
    const counts = new Map();
    const voice = createVoiceChannel(value => {
        root.dataset.voice = value;
        listenButton.textContent = value === 'listening' ? '停止聆听' : '对小羽说话';
        listenButton.setAttribute('aria-pressed', String(value === 'listening'));
    });

    function on(target, type, handler, options = {}) {
        target.addEventListener(type, handler, { ...options, signal: events.signal });
    }
    function later(key, callback, delay) {
        clearTimeout(timers.get(key));
        timers.set(key, setTimeout(() => { timers.delete(key); if (!destroyed) callback(); }, delay));
    }
    function clearTimers() { timers.forEach(clearTimeout); timers.clear(); }
    function active() { return !destroyed && visible && !document.hidden; }
    function emit(type, detail) { root.dispatchEvent(new CustomEvent('oc:' + type, { bubbles: true, detail })); }

    function loadImage(pose) {
        if (images.has(pose)) return images.get(pose);
        const image = new Image();
        image.src = POSES[pose].src;
        const job = image.decode().then(() => image).catch(() => { images.delete(pose); return null; });
        images.set(pose, job);
        return job;
    }
    async function showPose(pose) {
        const ticket = ++imageVersion;
        const image = await loadImage(pose);
        if (destroyed || ticket !== imageVersion || !image) return;
        portrait.src = image.src;
        portrait.alt = POSES[pose].alt;
        root.dataset.pose = pose;
    }
    function setState(next, label) {
        state = next;
        root.dataset.state = next;
        mood.textContent = label;
        emit('state', { state: next, label });
    }
    function say(text, speak = false) {
        if (destroyed || typeof text !== 'string' || !text.trim()) return;
        const line = text.trim().slice(0, 240);
        speech.textContent = line;
        emit('speech', { text: line, character: CHARACTER.name });
        if (speak && active() && voice.enabled) void voice.speak({ text: line, character: CHARACTER });
    }
    function scheduleSleep() {
        if (!active() || book.open) return;
        later('sleep', () => {
            voice.stop();
            setState('sleep', '在星屿打个盹');
            showPose('sleep');
            say('呼……把好梦留给你。想我的时候，轻轻叫醒我就好。');
        }, 45000);
    }

    function renderCollection() {
        $('[data-oc-count]').textContent = `${collected.length} / ${KEEPSAKES.length}`;
        $('[data-oc-collection]').innerHTML = KEEPSAKES.map(item => {
            const owned = collected.includes(item.id);
            return `<article class="oc-keepsake${owned ? ' is-collected' : ''}">${icon(item.icon)}<div><h3>${item.title}</h3><p>${owned ? item.text : item.hint}</p><small>${owned ? '已珍藏' : '等待与你一起发现'}</small>${owned && item.href ? `<a href="${item.href}">${item.link} ↗</a>` : ''}</div></article>`;
        }).join('');
        $('[data-oc-memory]').textContent = storage ? '这些小小的相遇，只记在这个浏览器里。' : '这次相遇暂存在当前页面，离开后会消散。';
    }
    function collect(id) {
        if (collected.includes(id)) return;
        collected.push(id);
        try { storage?.setItem('huanyu.keepsakes.v1', JSON.stringify(collected)); } catch { storage = null; }
        renderCollection();
        notice.textContent = `收到了「${KEEPSAKES.find(item => item.id === id).title}」· 已放进星屿手记`;
        later('notice', () => { notice.textContent = ''; }, 5500);
        emit('collect', { id, count: collected.length });
    }
    function sparkle() {
        const layer = $('[data-oc-sparkles]');
        layer.replaceChildren();
        if (reduced.matches || !active()) return;
        for (let i = 0; i < 7; i++) {
            const star = document.createElement('span');
            star.textContent = i % 2 ? '✧' : '♡';
            star.style.setProperty('--i', i);
            layer.append(star);
        }
        later('sparkles', () => layer.replaceChildren(), 1400);
    }

    function interact(action) {
        if (destroyed || !Object.hasOwn(ACTIONS, action)) return false;
        const config = ACTIONS[action];
        const ticket = ++version;
        clearTimeout(timers.get('reset'));
        clearTimeout(timers.get('sleep'));
        voice.stop();
        const count = counts.get(action) || 0;
        counts.set(action, count + 1);
        setState(action, config.label);
        showPose(config.pose);
        say(config.lines[count % config.lines.length], true);
        collect(config.item);
        sparkle();
        later('reset', () => {
            if (ticket !== version || !active()) return;
            setState('welcome', '陪你慢慢探索');
            showPose('welcome');
            scheduleSleep();
        }, 6500);
        return true;
    }

    function selectTab(id) {
        root.querySelectorAll('[data-oc-tab]').forEach(tab => {
            const selected = tab.dataset.ocTab === id;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        root.querySelectorAll('[data-oc-panel]').forEach(panel => { panel.hidden = panel.dataset.ocPanel !== id; });
    }
    function openBook(button) {
        opener = button;
        clearTimeout(timers.get('sleep'));
        voice.stop();
        if (!book.open) book.showModal();
    }

    $('[data-oc-gallery]').innerHTML = Object.entries(POSES).map(([id, pose]) => `<button type="button" class="oc-pose-card" data-oc-preview="${id}"><img src="${pose.src}" alt="${pose.alt}" width="280" height="280" loading="lazy"><span>${pose.label}</span></button>`).join('');
    renderCollection();
    say(greeting(hero?.dataset.daypart, collected.includes('butterfly')));
    root.dataset.ready = 'true';
    character.disabled = false;
    root.querySelectorAll('[data-oc-action], [data-oc-open]').forEach(button => { button.disabled = false; });

    on(root, 'click', event => {
        const target = event.target.closest('button');
        if (!target || !root.contains(target)) return;
        if (target.hasAttribute('data-oc-character')) interact('pat');
        else if (target.dataset.ocAction) {
            if (book.open) book.close();
            interact(target.dataset.ocAction);
        }
        else if (target.hasAttribute('data-oc-open')) openBook(target);
        else if (target.hasAttribute('data-oc-close')) book.close();
        else if (target.dataset.ocTab) selectTab(target.dataset.ocTab);
        else if (target.dataset.ocPreview) {
            book.close();
            version += 1;
            clearTimeout(timers.get('reset'));
            const pose = target.dataset.ocPreview;
            voice.stop();
            setState(pose, POSES[pose].label);
            showPose(pose);
            say(pose === 'sleep' ? '唔……那就一起，做个软软的梦吧。' : '这是手记里的一小张我。你喜欢的话，就多陪你一会儿。');
            scheduleSleep();
        }
    });
    on(book, 'close', () => { opener?.focus(); scheduleSleep(); });
    on(book, 'click', event => {
        if (event.target !== book) return;
        const rect = book.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) book.close();
    });
    on($('[role="tablist"]'), 'keydown', event => {
        const tabs = [...root.querySelectorAll('[data-oc-tab]')];
        let index = tabs.indexOf(document.activeElement);
        if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        selectTab(tabs[index].dataset.ocTab);
        tabs[index].focus();
    });
    on(voiceButton, 'click', () => {
        const enabled = voice.setEnabled(!voice.enabled);
        voiceButton.setAttribute('aria-pressed', String(enabled));
        voiceButton.textContent = enabled ? '声音已开启' : '开启小羽的声音';
        listenButton.hidden = !enabled || !voice.canListen;
        if (enabled) say(speech.textContent, true);
    });
    on(listenButton, 'click', async () => {
        if (root.dataset.voice === 'listening') { voice.stop(); return; }
        const text = await voice.listen();
        if (!active() || !voice.enabled || typeof text !== 'string') return;
        const action = actionFromTranscript(text);
        if (action) interact(action);
        else say('我听见啦。可以试着说「抱抱」「甜牛奶」或「缝补梦境」。');
    });

    let lastPointer = 0;
    on(character, 'pointermove', event => {
        if (!active() || reduced.matches || !fine.matches || performance.now() - lastPointer < 48) return;
        lastPointer = performance.now();
        const rect = character.getBoundingClientRect();
        root.style.setProperty('--oc-lean', ((event.clientX - rect.left) / rect.width * 4 - 2).toFixed(2) + 'deg');
    }, { passive: true });
    on(character, 'pointerleave', () => root.style.setProperty('--oc-lean', '0deg'));
    on(root, 'pointerover', event => {
        const button = event.target.closest('[data-oc-action]');
        if (button) loadImage(ACTIONS[button.dataset.ocAction].pose);
    }, { passive: true });
    on(root, 'focusin', event => {
        clearTimeout(timers.get('sleep'));
        const action = event.target.dataset.ocAction;
        if (action) loadImage(ACTIONS[action].pose);
        scheduleSleep();
    });

    function syncActivity() {
        root.dataset.paused = String(!active());
        if (!active()) {
            version += 1;
            imageVersion += 1;
            clearTimers();
            voice.stop();
            $('[data-oc-sparkles]').replaceChildren();
            notice.textContent = '';
        } else {
            if (state !== 'sleep') { setState('welcome', '陪你慢慢探索'); showPose('welcome'); }
            else showPose('sleep');
            scheduleSleep();
        }
    }
    on(document, 'visibilitychange', syncActivity);
    on(window, 'pagehide', () => { visible = false; syncActivity(); });
    on(window, 'pageshow', () => { visible = true; syncActivity(); });
    on(reduced, 'change', () => { root.style.setProperty('--oc-lean', '0deg'); $('[data-oc-sparkles]').replaceChildren(); });
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        syncActivity();
    }, { threshold: 0.02 }) : null;
    observer?.observe(root);
    const themeObserver = hero ? new MutationObserver(() => {
        if (state === 'welcome') say(greeting(hero.dataset.daypart));
    }) : null;
    themeObserver?.observe(hero, { attributes: true, attributeFilter: ['data-daypart'] });
    scheduleSleep();

    const api = Object.freeze({
        interact,
        say: text => { if (!destroyed) { voice.stop(); say(text); } },
        getState: () => ({ state, collected: [...collected], voice: root.dataset.voice || 'idle', voiceAvailable: voice.available, paused: !active(), destroyed }),
        setVoiceProvider(provider) {
            if (destroyed) return;
            voice.setProvider(provider);
            voiceButton.hidden = !voice.available;
            voiceButton.textContent = '开启小羽的声音';
            voiceButton.setAttribute('aria-pressed', 'false');
            listenButton.hidden = true;
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            version += 1;
            imageVersion += 1;
            clearTimers();
            events.abort();
            observer?.disconnect();
            themeObserver?.disconnect();
            voice.destroy();
            images.clear();
            $('[data-oc-sparkles]').replaceChildren();
            notice.textContent = '';
            if (book.open) book.close();
            root.dataset.paused = 'true';
            delete root.dataset.ready;
            character.disabled = true;
            root.querySelectorAll('[data-oc-action], [data-oc-open]').forEach(button => { button.disabled = true; });
            voiceButton.hidden = true;
            listenButton.hidden = true;
            instances.delete(root);
        }
    });
    instances.set(root, api);
    return api;
}

window.HuanYu = mountCharacter(document.querySelector('[data-oc]'));
