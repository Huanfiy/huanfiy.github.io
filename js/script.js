/* =============================================================
 * Huanfly · 手绘森林主题交互
 * 1. 点击灵气迸发（绿/青色粒子）
 * 2. 全屏漂浮萤火灵气（缓慢上浮的发光点）
 * 3. 主题切换 / 移动端菜单 / 平滑滚动
 * ============================================================= */

const SPIRIT_BURST_CONFIG = {
    burstParticleCount: 18,
    ringParticleCount: 8,
    maxParticles: 300,
    maxFlashes: 40,
    clickCooldownMs: 90,
    gravity: -0.012,   // 灵气轻微上浮
    drag: 0.965,
    lifeMin: 28,
    lifeMax: 50,
    speedMin: 1.2,
    speedMax: 3.4,
    ringSpeed: 1.8,
    centerFlashLife: 14,
    colors: ['#6ab04c', '#8fd873', '#4fc4cf', '#7ee3ec', '#b8f0f5', '#f2c46e']
};

function initSpiritBurstEffect() {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;
    let lastBurstAt = 0;

    let canvas = null;
    let ctx = null;
    let rafId = null;
    let dpr = 1;
    const particles = [];
    const flashes = [];

    const randomBetween = (min, max) => min + Math.random() * (max - min);
    const pickColor = () => SPIRIT_BURST_CONFIG.colors[Math.floor(Math.random() * SPIRIT_BURST_CONFIG.colors.length)];

    function ensureCanvas() {
        if (canvas || prefersReducedMotion) return;
        canvas = document.createElement('canvas');
        canvas.className = 'burst-layer';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resizeCanvas();
    }

    function removeCanvas() {
        if (!canvas) return;
        cancelAnimationFrame(rafId);
        rafId = null;
        particles.length = 0;
        flashes.length = 0;
        canvas.remove();
        canvas = null;
        ctx = null;
    }

    function resizeCanvas() {
        if (!canvas || !ctx) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createReducedMotionPulse(x, y) {
        const pulse = document.createElement('span');
        pulse.className = 'reduced-motion-click';
        pulse.style.left = x + 'px';
        pulse.style.top = y + 'px';
        document.body.appendChild(pulse);
        pulse.addEventListener('animationend', () => pulse.remove(), { once: true });
    }

    function spawnParticle(x, y, speed, angle, color, sizeScale = 1) {
        const life = Math.floor(randomBetween(SPIRIT_BURST_CONFIG.lifeMin, SPIRIT_BURST_CONFIG.lifeMax));
        particles.push({
            x,
            y,
            prevX: x,
            prevY: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            drag: randomBetween(SPIRIT_BURST_CONFIG.drag - 0.02, SPIRIT_BURST_CONFIG.drag + 0.01),
            gravity: SPIRIT_BURST_CONFIG.gravity + randomBetween(-0.008, 0.008),
            life,
            maxLife: life,
            color,
            size: randomBetween(1.4, 2.6) * sizeScale
        });
    }

    function spawnBurst(x, y) {
        if (prefersReducedMotion) {
            createReducedMotionPulse(x, y);
            return;
        }

        ensureCanvas();
        if (!ctx) return;

        const now = performance.now();
        if (now - lastBurstAt < SPIRIT_BURST_CONFIG.clickCooldownMs) return;
        lastBurstAt = now;

        for (let i = 0; i < SPIRIT_BURST_CONFIG.burstParticleCount; i += 1) {
            const angle = randomBetween(0, Math.PI * 2);
            const speed = randomBetween(SPIRIT_BURST_CONFIG.speedMin, SPIRIT_BURST_CONFIG.speedMax);
            spawnParticle(x, y, speed, angle, pickColor(), 1);
        }

        for (let i = 0; i < SPIRIT_BURST_CONFIG.ringParticleCount; i += 1) {
            const angle = (Math.PI * 2 / SPIRIT_BURST_CONFIG.ringParticleCount) * i;
            const speed = SPIRIT_BURST_CONFIG.ringSpeed + randomBetween(-0.3, 0.3);
            spawnParticle(x, y, speed, angle, pickColor(), 1.2);
        }

        flashes.push({
            x,
            y,
            life: SPIRIT_BURST_CONFIG.centerFlashLife,
            maxLife: SPIRIT_BURST_CONFIG.centerFlashLife
        });

        if (particles.length > SPIRIT_BURST_CONFIG.maxParticles) {
            particles.splice(0, particles.length - SPIRIT_BURST_CONFIG.maxParticles);
        }
        if (flashes.length > SPIRIT_BURST_CONFIG.maxFlashes) {
            flashes.splice(0, flashes.length - SPIRIT_BURST_CONFIG.maxFlashes);
        }

        if (!rafId) {
            rafId = requestAnimationFrame(tick);
        }
    }

    function tick() {
        if (!ctx || !canvas) {
            rafId = null;
            return;
        }

        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.globalCompositeOperation = 'lighter';

        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i];
            particle.prevX = particle.x;
            particle.prevY = particle.y;

            particle.vx *= particle.drag;
            particle.vy = particle.vy * particle.drag + particle.gravity;
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 1;

            const alpha = Math.max(particle.life / particle.maxLife, 0);
            ctx.globalAlpha = alpha * 0.9;
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = Math.max(particle.size * 0.6, 0.8);
            ctx.beginPath();
            ctx.moveTo(particle.prevX, particle.prevY);
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();

            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();

            if (particle.life <= 0 || alpha <= 0) {
                particles.splice(i, 1);
            }
        }

        for (let i = flashes.length - 1; i >= 0; i -= 1) {
            const flash = flashes[i];
            flash.life -= 1;
            const alpha = Math.max(flash.life / flash.maxLife, 0);
            const radius = 6 + (1 - alpha) * 26;

            const gradient = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
            gradient.addColorStop(0, `rgba(216, 255, 226, ${0.55 * alpha})`);
            gradient.addColorStop(0.45, `rgba(126, 227, 236, ${0.3 * alpha})`);
            gradient.addColorStop(1, 'rgba(106, 176, 76, 0)');

            ctx.globalAlpha = 1;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (flash.life <= 0) {
                flashes.splice(i, 1);
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        if (particles.length > 0 || flashes.length > 0) {
            rafId = requestAnimationFrame(tick);
        } else {
            rafId = null;
        }
    }

    function handlePointerDown(event) {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        spawnBurst(event.clientX, event.clientY);
    }

    function handleMotionChange(event) {
        prefersReducedMotion = event.matches;
        if (prefersReducedMotion) {
            removeCanvas();
        }
    }

    if (!prefersReducedMotion) {
        ensureCanvas();
    }

    window.addEventListener('resize', resizeCanvas, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown);

    if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
        motionQuery.addListener(handleMotionChange);
    }
}

/* =============================================================
 * 漂浮萤火灵气：缓慢上浮、左右摇曳的发光点
 * ============================================================= */
function initAmbientSpirits() {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    const COLORS = ['#8fd873', '#7ee3ec', '#b8f0f5', '#f2c46e'];
    const canvas = document.createElement('canvas');
    canvas.className = 'spirit-layer';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let dpr = 1;
    let width = 0;
    let height = 0;
    let rafId = null;
    let spirits = [];

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
    }

    function seed() {
        const count = width < 768 ? 10 : 20;
        spirits = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 1 + Math.random() * 2.2,
            rise: 0.12 + Math.random() * 0.22,
            swayAmp: 16 + Math.random() * 28,
            swaySpeed: 0.0006 + Math.random() * 0.0009,
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.0012 + Math.random() * 0.0018,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        }));
    }

    function tick(t) {
        ctx.clearRect(0, 0, width, height);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const baseAlpha = isDark ? 0.55 : 0.32;

        for (const s of spirits) {
            s.y -= s.rise;
            if (s.y < -10) {
                s.y = height + 10;
                s.x = Math.random() * width;
            }
            const x = s.x + Math.sin(t * s.swaySpeed + s.phase) * s.swayAmp;
            const twinkle = 0.6 + 0.4 * Math.sin(t * s.twinkleSpeed + s.phase * 2);
            const alpha = baseAlpha * twinkle;

            const glow = ctx.createRadialGradient(x, s.y, 0, x, s.y, s.r * 5);
            glow.addColorStop(0, s.color);
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.globalAlpha = alpha * 0.35;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, s.y, s.r * 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = alpha;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        rafId = requestAnimationFrame(tick);
    }

    function start() {
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function stop() {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    function destroy() {
        stop();
        canvas.remove();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stop();
        } else if (!motionQuery.matches) {
            start();
        }
    });

    const onMotionChange = (event) => {
        if (event.matches) destroy();
    };
    if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', onMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
        motionQuery.addListener(onMotionChange);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    start();
}

/* =============================================================
 * 基础交互：主题切换 / 移动端菜单 / 平滑滚动
 * ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initSpiritBurstEffect();
    initAmbientSpirits();

    // Theme Toggle Logic
    const themeToggles = document.querySelectorAll('.theme-toggle');

    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcons('dark');
    }

    themeToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcons(newTheme);
        });
    });

    function updateThemeIcons(theme) {
        themeToggles.forEach(toggle => {
            const icon = toggle.querySelector('i');
            if (icon) {
                if (theme === 'dark') {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                } else {
                    icon.classList.remove('fa-sun');
                    icon.classList.add('fa-moon');
                }
            }
        });
    }

    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');

            // Toggle icon between bars and times (X)
            const icon = menuToggle.querySelector('i');
            if (icon.classList.contains('fa-bars')) {
                icon.classList.replace('fa-bars', 'fa-times');
            } else {
                icon.classList.replace('fa-times', 'fa-bars');
            }
        });
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navLinks && navLinks.classList.contains('active')) {
            if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
                navLinks.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.classList.replace('fa-times', 'fa-bars');
            }
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
                // Close menu if open
                if (navLinks && navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    const icon = menuToggle.querySelector('i');
                    icon.classList.replace('fa-times', 'fa-bars');
                }
            }
        });
    });
});
