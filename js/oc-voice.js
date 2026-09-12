/* 可替换的语音边界。默认无 provider、无音频、无麦克风请求。
 * provider.speak({ text, character, signal }) -> Promise，在播放完成时 resolve。
 * provider.listen?({ signal }) -> Promise<string>，一次识别；stop?() / dispose?() 清理。
 * provider 必须响应 AbortSignal；外部 Promise 即使不响应，超时也会释放 UI。
 */
export function createVoiceChannel(onState = () => {}, timeoutMs = 20000) {
    let provider = null;
    let active = null;
    let sequence = 0;
    let destroyed = false;
    let enabled = false;
    const safely = (target, method) => {
        try { Promise.resolve(target?.[method]?.()).catch(() => {}); } catch { /* Adapter cleanup must not break the character. */ }
    };

    function stop() {
        sequence += 1;
        active?.abort();
        active = null;
        safely(provider, 'stop');
        if (!destroyed) onState('idle');
    }

    async function run(method, payload) {
        stop();
        if (destroyed || !enabled || typeof provider?.[method] !== 'function') return null;
        const token = sequence;
        const controller = new AbortController();
        const adapter = provider;
        active = controller;
        let timer;
        const interrupted = new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
            timer = setTimeout(() => controller.abort(), timeoutMs);
        });
        onState(method === 'listen' ? 'listening' : 'speaking');
        try {
            const value = await Promise.race([
                Promise.resolve().then(() => controller.signal.aborted ? null : adapter[method]({ ...payload, signal: controller.signal })), interrupted
            ]);
            return token === sequence && !controller.signal.aborted ? value : null;
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
            if (token === sequence) {
                controller.abort();
                safely(adapter, 'stop');
                active = null;
                if (!destroyed) onState('idle');
            }
        }
    }

    return {
        setProvider(next) {
            if (destroyed) return;
            if (next !== null && typeof next?.speak !== 'function') throw new TypeError('Voice provider requires speak()');
            stop();
            if (provider !== next) safely(provider, 'dispose');
            provider = next;
            enabled = false; // 换 provider 后仍需访客主动启用。
        },
        setEnabled(value) { enabled = Boolean(value && provider && !destroyed); if (!enabled) stop(); return enabled; },
        get available() { return Boolean(provider) && !destroyed; },
        get canListen() { return typeof provider?.listen === 'function' && !destroyed; },
        get enabled() { return enabled; },
        speak(payload) { return run('speak', payload); },
        listen() { return run('listen', {}); },
        stop,
        destroy() {
            if (destroyed) return;
            stop();
            destroyed = true;
            safely(provider, 'dispose');
            provider = null;
            enabled = false;
        }
    };
}
