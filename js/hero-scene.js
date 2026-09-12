/* =============================================================
 * Huanfly · 首页 Hero 景观（仅 index.html）
 * 1. 时段天空：按主题与本地时间写入 .hero[data-daypart]，并推算太阳在弧线上的位置
 * 2. 视差：精细指针设备跟随指针，所有设备跟随滚动；远 / 中 / 近三层与云层位移不同
 * 3. 粒子：白天飘落叶与花瓣、夜晚草间萤火；指针快速移动会起一阵风
 * 角色交互独立于景观，由 oc-character.js 管理。
 * 渲染循环只在 Hero 可见且标签页前台运行；prefers-reduced-motion 下退化为静态插画，
 * 脚本失效时 HTML / CSS 本身就是一幅完整的静态插画。
 * ============================================================= */
(function () {
    'use strict';

    const hero = document.getElementById('hero');
    if (!hero) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const layers = {
        far: hero.querySelector('.hero-far'),
        mid: hero.querySelector('.hero-mid'),
        near: hero.querySelector('.hero-near'),
        clouds: hero.querySelector('.hero-clouds')
    };
    const scene = hero.querySelector('.hero-scene');

    let forcedDaypart = null;
    let daypart = null;
    let heroVisible = true;
    let heroHeight = hero.offsetHeight;
    let rafId = null;
    let lastTick = 0;

    /* ---------------- 时段与太阳 ---------------- */
    function hourOf(now) {
        return now.getHours() + now.getMinutes() / 60;
    }

    function computeDaypart(now) {
        if (forcedDaypart) return forcedDaypart;
        if (document.documentElement.getAttribute('data-theme') === 'dark') return 'night';
        const h = hourOf(now);
        if (h >= 5 && h < 7) return 'dawn';
        if (h >= 17 && h < 19.5) return 'dusk';
        return 'day';
    }

    // 6:00 自左侧山后升起，18:00 落回右侧山后；弧线整体偏右上，避开居中的正文
    function sunPosition(now, dp) {
        const h = hourOf(now);
        let t = (h - 6) / 12;
        if (dp === 'day' && (h < 5 || h >= 19.5)) t = 0.5;
        if (dp === 'dawn') t = 0.04;
        if (dp === 'dusk') t = 0.96;
        t = clamp(t, 0, 1);
        // 窄屏正文占满宽度，弧线再往右让开头像
        const narrow = window.innerWidth < 768;
        const x = narrow ? 76 + 18 * t : 66 + 26 * t;
        return { x, y: 46 - 34 * Math.sin(Math.PI * t) };
    }

    function applyDaypart() {
        const now = new Date();
        const dp = computeDaypart(now);
        const sun = sunPosition(now, dp);
        hero.style.setProperty('--sun-x', sun.x.toFixed(1) + '%');
        hero.style.setProperty('--sun-y', sun.y.toFixed(1) + '%');
        if (dp !== daypart) {
            daypart = dp;
            hero.dataset.daypart = dp;
            particles.setMode(dp === 'night' ? 'fireflies' : 'leaves');
        }
    }

    /* ---------------- 视差 ---------------- */
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
    let scrollOffset = 0;

    function setLayer(el, ampX, ampY, scrollFactor, scale) {
        if (!el) return;
        const x = pointer.x * ampX;
        const y = pointer.y * ampY + scrollOffset * scrollFactor;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)${scale ? ' scale(1.04)' : ''}`;
    }

    function updateParallax() {
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
        setLayer(layers.clouds, 10, 4, 0.22, false);
        setLayer(layers.far, 6, 3, 0.30, true);
        setLayer(layers.mid, 14, 6, 0.16, true);
        setLayer(layers.near, 24, 10, 0, true);
    }

    function resetParallax() {
        Object.values(layers).forEach((el) => {
            if (el) el.style.transform = '';
        });
    }

    /* ---------------- 粒子：落叶 / 萤火 ---------------- */
    const particles = (() => {
        const LEAF_COLORS = ['#7cba5e', '#a8d38a', '#f2b950', '#e8836f', '#d9a14a', '#8fd873'];
        const FIREFLY_COLORS = ['#f2e58a', '#8fd873', '#7ee3ec', '#f2c46e'];
        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let sceneHeight = 0;
        let dpr = 1;
        let mode = 'leaves';
        let items = [];
        let wind = 0;
        let windTarget = 0;

        function ensure() {
            if (canvas || !scene) return;
            canvas = document.createElement('canvas');
            canvas.className = 'hero-particles';
            canvas.setAttribute('aria-hidden', 'true');
            scene.appendChild(canvas);
            ctx = canvas.getContext('2d');
            resize();
        }

        function destroy() {
            if (!canvas) return;
            canvas.remove();
            canvas = null;
            ctx = null;
            items = [];
        }

        function resize() {
            if (!canvas) return;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = hero.clientWidth;
            height = hero.clientHeight;
            sceneHeight = layers.near ? layers.near.getBoundingClientRect().height : height * 0.4;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        }

        function seed() {
            const narrow = width < 768;
            const count = mode === 'leaves' ? (narrow ? 9 : 22) : (narrow ? 7 : 16);
            items = Array.from({ length: count }, () => spawn(true));
        }

        function spawn(initial) {
            if (mode === 'leaves') {
                return {
                    x: Math.random() * width,
                    y: initial ? Math.random() * height : -24,
                    size: 5 + Math.random() * 7,
                    vy: 0.35 + Math.random() * 0.55,
                    rot: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * 0.05,
                    phase: Math.random() * Math.PI * 2,
                    petal: Math.random() < 0.35,
                    alpha: 0.7 + Math.random() * 0.3,
                    color: pick(LEAF_COLORS)
                };
            }
            return {
                x: Math.random() * width,
                y: height * (0.42 + Math.random() * 0.52),
                r: 1.4 + Math.random() * 1.6,
                phase: Math.random() * Math.PI * 2,
                speed: 0.0005 + Math.random() * 0.0007,
                ax: 24 + Math.random() * 46,
                ay: 10 + Math.random() * 22,
                twinkle: 0.0012 + Math.random() * 0.0018,
                color: pick(FIREFLY_COLORS)
            };
        }

        function drawLeaf(p, alpha) {
            const s = p.size;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = alpha * p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            if (p.petal) {
                ctx.ellipse(0, 0, s * 0.55, s * 0.36, 0, 0, Math.PI * 2);
            } else {
                ctx.moveTo(-s, 0);
                ctx.quadraticCurveTo(0, -s * 0.62, s, 0);
                ctx.quadraticCurveTo(0, s * 0.62, -s, 0);
            }
            ctx.fill();
            if (!p.petal && s > 7) {
                ctx.strokeStyle = 'rgba(47, 54, 48, 0.16)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(-s * 0.75, 0);
                ctx.lineTo(s * 0.75, 0);
                ctx.stroke();
            }
            ctx.restore();
        }

        function tick(t, dt) {
            if (!ctx) return;
            const step = dt / 16.7;
            wind += (windTarget - wind) * 0.03;
            windTarget *= 0.985;
            ctx.clearRect(0, 0, width, height);

            if (mode === 'leaves') {
                const ambient = Math.sin(t * 0.0004) * 0.22;
                // 叶子落到前山附近就淡出，像掉进了草丛
                const groundY = height - sceneHeight * 0.5;
                const fadeSpan = Math.max(sceneHeight * 0.3, 20);
                for (let i = 0; i < items.length; i += 1) {
                    const p = items[i];
                    p.y += p.vy * step;
                    p.x += (Math.sin(t * 0.0011 + p.phase) * 0.35 + wind + ambient) * step;
                    p.rot += (p.vr + wind * 0.012) * step;
                    const alpha = p.y > groundY ? clamp(1 - (p.y - groundY) / fadeSpan, 0, 1) : 1;
                    if (alpha <= 0 || p.y > height + 30 || p.x < -40 || p.x > width + 40) {
                        items[i] = spawn(false);
                        continue;
                    }
                    drawLeaf(p, alpha);
                }
                return;
            }

            for (const p of items) {
                const x = p.x + Math.sin(t * p.speed + p.phase) * p.ax + wind * 6;
                const y = p.y + Math.sin(t * p.speed * 1.31 + p.phase * 2) * p.ay;
                const alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase * 3));
                const glow = ctx.createRadialGradient(x, y, 0, x, y, p.r * 6);
                glow.addColorStop(0, p.color);
                glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.globalAlpha = alpha * 0.35;
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(x, y, p.r * 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(x, y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        function gust(vx) {
            windTarget = clamp(windTarget + vx * 0.02, -2.4, 2.4);
        }

        function setMode(next) {
            if (next === mode) return;
            mode = next;
            if (canvas) seed();
        }

        return { ensure, destroy, resize, tick, gust, setMode };
    })();

    /* ---------------- 渲染循环 ---------------- */
    function shouldRun() {
        return heroVisible && !document.hidden && !motionQuery.matches;
    }

    function frame(t) {
        rafId = null;
        if (!shouldRun()) return;
        const dt = lastTick ? Math.min(t - lastTick, 64) : 16.7;
        lastTick = t;
        updateParallax();
        particles.tick(t, dt);
        rafId = requestAnimationFrame(frame);
    }

    function start() {
        if (!shouldRun()) return;
        particles.ensure();
        if (!rafId) {
            lastTick = 0;
            rafId = requestAnimationFrame(frame);
        }
    }

    function stop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    function handleMotionChange() {
        if (motionQuery.matches) {
            stop();
            particles.destroy();
            resetParallax();
        } else {
            start();
        }
    }

    /* ---------------- 事件接线 ---------------- */
    window.addEventListener('pointermove', (event) => {
        if (!finePointer.matches) return;
        pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
        if (Math.abs(event.movementX) > 18) particles.gust(event.movementX);
    }, { passive: true });

    window.addEventListener('scroll', () => {
        scrollOffset = clamp(window.scrollY, 0, heroHeight);
        if (!rafId && shouldRun()) start();
    }, { passive: true });

    window.addEventListener('resize', () => {
        heroHeight = hero.offsetHeight;
        particles.resize();
        applyDaypart();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else start();
    });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            heroVisible = entries.some((entry) => entry.isIntersecting);
            if (heroVisible) start(); else stop();
        }, { threshold: 0.02 }).observe(hero);
    }

    if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
        motionQuery.addListener(handleMotionChange);
    }

    new MutationObserver(applyDaypart).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
    setInterval(applyDaypart, 60000);

    applyDaypart();
    scrollOffset = clamp(window.scrollY, 0, heroHeight);
    start();

    // 供访客终端 / 诊断使用：手动切换时段；旧角色入口转发给独立的幻羽组件
    window.HeroScene = {
        setDaypart(dp) {
            forcedDaypart = ['dawn', 'day', 'dusk', 'night'].includes(dp) ? dp : null;
            applyDaypart();
        },
        get daypart() { return daypart; },
        poke() { return window.HuanYu?.interact('pat'); },
        say(text) { window.HuanYu?.say(text); }
    };
})();
