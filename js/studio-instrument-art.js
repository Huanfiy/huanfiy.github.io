/* Instrument faceplates and readouts. No Three.js import, DOM lookup or clock;
 * the room supplies owned canvas textures and explicit display snapshots. */
export function createInstrumentArtwork(canvasTexture, layout) {
    const scopeScreen = canvasTexture(640, 360, () => {});
    const powerScreen = canvasTexture(512, 240, drawPowerSupply);
    const faces = canvasTexture(1024, 1024, ctx => drawFaceplates(ctx, layout));
    let lastDisplay = '';
    function updateScope({ waveform, frequency, running, time }) {
        const signature = `${waveform}:${frequency}:${running}:${time}`;
        if (signature === lastDisplay) return;
        lastDisplay = signature;
        drawScope(scopeScreen.ctx, scopeScreen.canvas.width, scopeScreen.canvas.height, { waveform, frequency, running, time });
        scopeScreen.texture.needsUpdate = true;
    }
    return { faces, scopeScreen, powerScreen, updateScope };
}

function drawPowerSupply(ctx, w, h) {
    ctx.fillStyle = '#102b2b'; ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#90aaa0'; ctx.font = '17px monospace';
    ctx.fillText('DC OUTPUT', 20, 28); ctx.fillStyle = '#a7eac8'; ctx.fillText('CV', w - 49, 28);
    ctx.fillStyle = '#b0eacb'; ctx.font = '60px monospace'; ctx.fillText('05.00', 20, 105);
    ctx.fillStyle = '#e8c58a'; ctx.fillText('0.000', 20, 183);
    ctx.font = '34px monospace'; ctx.fillText('A', w - 50, 182); ctx.fillStyle = '#b0eacb'; ctx.fillText('V', w - 50, 104);
    ctx.strokeStyle = '#31504a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, 122); ctx.lineTo(w - 20, 122); ctx.stroke();
    ctx.fillStyle = '#8ca79b'; ctx.font = '16px monospace'; ctx.fillText('30 V / 3 A   LIMIT 0.500 A', 20, h - 12);
}

// One atlas, two UV windows. The labels use the same panel bounds and control
// centres as the model, so moving a knob/connector cannot leave its legend behind.
function drawFaceplates(ctx, { scope, supply }) {
    function face(panel, draw) {
        const { width, height, y, atlas } = panel, bottom = y - height / 2;
        const [left, top, cw, ch] = atlas;
        ctx.save(); ctx.beginPath(); ctx.rect(left, top, cw, ch); ctx.clip();
        const X = x => left + (x / width + .5) * cw;
        const Y = y => top + (1 - (y - bottom) / height) * ch;
        const label = (text, x, y, size = 13, tint = '#42554b', align = 'center') => {
            ctx.font = `600 ${size}px monospace`; ctx.fillStyle = tint;
            ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, X(x), Y(y));
        };
        const line = (a, b, tint = '#a5b09b') => {
            ctx.strokeStyle = tint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke();
        };
        const ticks = ({ x, y, r }) => {
            for (let i = 0; i <= 10; i++) {
                const angle = (40 + i * 28) * Math.PI / 180;
                const r1 = r + .012, r2 = r1 + (i % 5 ? .004 : .008);
                line([x + Math.sin(angle) * r1, y + Math.cos(angle) * r1], [x + Math.sin(angle) * r2, y + Math.cos(angle) * r2], '#849582');
            }
        };
        const earth = (x, y) => {
            line([x, y + .013], [x, y]);
            for (let i = 0; i < 3; i++) line([x - .012 + i * .0035, y - i * .005], [x + .012 - i * .0035, y - i * .005]);
        };
        draw({ label, line, ticks, earth }); ctx.restore();
    }
    face(scope.panel, ({ label, line, ticks, earth }) => {
        label('HUANFLY', -.522, .728, 19, '#42554b', 'left');
        label('DSO-104  /  100 MHz · 1 GSa/s', .01, .728, 12);
        for (const { x, y, label: text } of scope.keys) label(text, x, y - .038, 10);
        scope.axes.forEach((axis, i) => {
            label(i ? 'HORIZONTAL' : 'VERTICAL', axis.x, axis.y + .166, 10);
            label('POSITION', axis.x, axis.y + .074, 9);
            ticks(axis); label(i ? 'TIME/DIV' : 'VOLTS/DIV', axis.x, axis.y - .080, 10);
        });
        line([.335, .343], [.621, .343]); label('TRIGGER', .485, .326, 11);
        ticks(scope.trigger); label('LEVEL', scope.trigger.x, scope.trigger.y - .057, 10);
        label('USB', -.558, .076, 10);
        scope.channels.forEach(({ x, y, ink }, i) => {
            label(`CH${i + 1}`, x, y + .066, 13, ink);
            label('1 MΩ', x, y - .043, 9);
        });
        label('PROBE COMP', .529, .171, 10); label('1 kHz', .489, .082, 9); earth(.572, .083);
    });
    face(supply.panel, ({ label, line, ticks, earth }) => {
        for (const axis of supply.axes) {
            label(axis.label, axis.x, axis.y + .092, 15); ticks(axis);
            label('PUSH / FINE', axis.x, axis.y - .093, 10);
        }
        label('HUANFLY  DC-305', -.367, .111, 14, '#42554b', 'left');
        label('REGULATED DC POWER', -.367, .085, 10, '#738471', 'left');
        supply.outputs.forEach(({ x, y, label: text }) => {
            if (text === 'earth') earth(x, y + .052);
            else label(text, x, y + .050, 20, text === '+' ? '#ad6650' : '#42554b');
        });
        line([.092, .083], [.478, .083]);
    });
}

function drawScope(ctx, w, h, { waveform, frequency, running, time }) {
    const yellow = '#eed18b', teal = '#8dd8c0';
    ctx.fillStyle = '#10282a'; ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = 'bold 16px monospace';
    ctx.fillStyle = running ? '#9bd4b4' : '#e1aa86'; ctx.fillText(running ? 'RUN' : 'STOP', 16, 26);
    ctx.fillStyle = '#b8cbbb'; ctx.font = '14px monospace'; ctx.fillText('T ↑ CH1  0.00 V', 100, 26);
    ctx.textAlign = 'right'; ctx.fillStyle = yellow;
    ctx.fillText(`${frequency.toFixed(2)} kHz`, w - 17, 26); ctx.textAlign = 'left';
    const left = 34, right = w - 18, top = 49, bottom = 279;
    const dx = (right - left) / 10, dy = (bottom - top) / 8;
    ctx.strokeStyle = '#2b4444'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const x = left + i * dx; ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let i = 0; i <= 8; i++) { const y = top + i * dy; ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
    const mid = (top + bottom) / 2;
    ctx.strokeStyle = '#4b6058'; ctx.beginPath();
    for (let i = 0; i <= 50; i++) { const x = left + i * dx / 5; ctx.moveTo(x, mid - 2); ctx.lineTo(x, mid + 2); }
    for (let i = 0; i <= 40; i++) { const y = top + i * dy / 5; ctx.moveTo(left + dx * 5 - 2, y); ctx.lineTo(left + dx * 5 + 2, y); }
    ctx.stroke();
    const marker = (y, tint, text) => {
        ctx.fillStyle = tint; ctx.beginPath(); ctx.moveTo(left - 9, y - 5); ctx.lineTo(left - 2, y); ctx.lineTo(left - 9, y + 5); ctx.fill();
        ctx.font = '12px monospace'; ctx.fillText(text, 9, y + 4);
    };
    marker(mid, yellow, '1'); marker(mid + dy * 2, teal, '2');
    ctx.fillStyle = yellow; ctx.beginPath(); ctx.moveTo(left + dx * 5 - 5, top - 8); ctx.lineTo(left + dx * 5 + 5, top - 8); ctx.lineTo(left + dx * 5, top - 1); ctx.fill();
    // Ten 100-us divisions span 1 ms: frequency in kHz equals the visible cycles.
    // Slow phase motion is illustrative, frozen by the room's capture clock.
    const phaseAt = x => (x - left) / (right - left) * Math.PI * 2 * frequency + time * 1.2;
    const wave = a => waveform === 'square' ? (Math.sin(a) >= 0 ? 1 : -1) : waveform === 'saw' ? 2 * ((a / (Math.PI * 2)) % 1) - 1 : Math.sin(a);
    for (let channel = 0; channel < 2; channel++) {
        ctx.strokeStyle = channel ? teal : yellow; ctx.lineWidth = channel ? 1.6 : 2.2; ctx.beginPath();
        for (let x = left; x <= right; x++) {
            const a = phaseAt(x);
            const y = channel ? mid + dy * 2 - Math.sin(a + .8) * dy * .65 : mid - wave(a) * dy * 1.65;
            x === left ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.font = '14px monospace'; ctx.fillStyle = yellow; ctx.fillText('1  1.00 V', 16, 307);
    ctx.fillStyle = teal; ctx.fillText('2  500 mV', 174, 307);
    ctx.fillStyle = '#c0cdb7'; ctx.fillText('M 100µs', 335, 307);
    ctx.textAlign = 'right'; ctx.fillText({ sine: 'SINE', square: 'PWM', saw: 'SAW' }[waveform], w - 18, 307); ctx.textAlign = 'left';
    ctx.fillStyle = '#7f9c91'; ctx.font = '13px monospace'; ctx.fillText('Vpp 3.30 V    DC / 10X    SAMPLE  1.00 GSa/s', 16, h - 17);
}
