const FIREWORK_CONFIG = {
    burstParticleCount: 28,
    ringParticleCount: 10,
    maxParticles: 420,
    maxFlashes: 60,
    clickCooldownMs: 90,
    gravity: 0.045,
    drag: 0.975,
    lifeMin: 26,
    lifeMax: 44,
    speedMin: 1.7,
    speedMax: 4.5,
    ringSpeed: 2.1,
    centerFlashLife: 14,
    colors: ['#D62828', '#E63946', '#F77F00', '#FCBF49', '#F4D35E', '#FFE9A8']
};

function initFestivalClickEffect() {
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
    const pickColor = () => FIREWORK_CONFIG.colors[Math.floor(Math.random() * FIREWORK_CONFIG.colors.length)];

    function ensureCanvas() {
        if (canvas || prefersReducedMotion) return;
        canvas = document.createElement('canvas');
        canvas.className = 'firework-layer';
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
        const life = Math.floor(randomBetween(FIREWORK_CONFIG.lifeMin, FIREWORK_CONFIG.lifeMax));
        particles.push({
            x,
            y,
            prevX: x,
            prevY: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            drag: randomBetween(FIREWORK_CONFIG.drag - 0.02, FIREWORK_CONFIG.drag + 0.01),
            gravity: FIREWORK_CONFIG.gravity + randomBetween(-0.01, 0.01),
            life,
            maxLife: life,
            color,
            size: randomBetween(1.4, 2.8) * sizeScale
        });
    }

    function spawnFirework(x, y) {
        if (prefersReducedMotion) {
            createReducedMotionPulse(x, y);
            return;
        }

        ensureCanvas();
        if (!ctx) return;

        const now = performance.now();
        if (now - lastBurstAt < FIREWORK_CONFIG.clickCooldownMs) return;
        lastBurstAt = now;

        for (let i = 0; i < FIREWORK_CONFIG.burstParticleCount; i += 1) {
            const angle = randomBetween(0, Math.PI * 2);
            const speed = randomBetween(FIREWORK_CONFIG.speedMin, FIREWORK_CONFIG.speedMax);
            spawnParticle(x, y, speed, angle, pickColor(), 1);
        }

        for (let i = 0; i < FIREWORK_CONFIG.ringParticleCount; i += 1) {
            const angle = (Math.PI * 2 / FIREWORK_CONFIG.ringParticleCount) * i;
            const speed = FIREWORK_CONFIG.ringSpeed + randomBetween(-0.35, 0.35);
            spawnParticle(x, y, speed, angle, pickColor(), 1.2);
        }

        flashes.push({
            x,
            y,
            life: FIREWORK_CONFIG.centerFlashLife,
            maxLife: FIREWORK_CONFIG.centerFlashLife
        });

        if (particles.length > FIREWORK_CONFIG.maxParticles) {
            particles.splice(0, particles.length - FIREWORK_CONFIG.maxParticles);
        }
        if (flashes.length > FIREWORK_CONFIG.maxFlashes) {
            flashes.splice(0, flashes.length - FIREWORK_CONFIG.maxFlashes);
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
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = Math.max(particle.size * 0.7, 0.8);
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
            const radius = 8 + (1 - alpha) * 32;

            const gradient = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
            gradient.addColorStop(0, `rgba(255, 245, 190, ${0.7 * alpha})`);
            gradient.addColorStop(0.45, `rgba(255, 190, 80, ${0.4 * alpha})`);
            gradient.addColorStop(1, 'rgba(255, 120, 60, 0)');

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
        spawnFirework(event.clientX, event.clientY);
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

// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', () => {
    initFestivalClickEffect();

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
