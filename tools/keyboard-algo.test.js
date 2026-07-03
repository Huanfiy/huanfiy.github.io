/* =========================================================
 * keyboard-algo.test.js — 算法引擎单测 + 练习过程仿真
 * 运行：node tools/keyboard-algo.test.js
 * 无外部依赖（node 内置 assert）。
 * ========================================================= */
'use strict';

const assert = require('assert');
const Algo = require('./keyboard-algo.js');

// 确定性随机数（mulberry32），保证测试可复现
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const NOW = 1750000000000;
let passed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ok - ${name}`);
    } catch (err) {
        console.error(`FAIL - ${name}`);
        console.error(err && err.message ? `       ${err.message}` : err);
        process.exitCode = 1;
    }
}

console.log('== 单元测试 ==');

test('normalizeKeyStats: v1 数据 emaError 用历史均值回填，新字段有默认值', () => {
    const item = Algo.normalizeKeyStats({ total: 10, errors: 4 });
    assert.strictEqual(item.total, 10);
    assert.strictEqual(item.errors, 4);
    assert.ok(Math.abs(item.emaError - 0.4) < 1e-9);
    assert.deepStrictEqual(item.confusions, {});
    assert.strictEqual(item.reviewGap, 0);
    assert.strictEqual(item.dueRound, 0);
});

test('keyClassOf: 键类别划分', () => {
    assert.strictEqual(Algo.keyClassOf('a'), 'letter');
    assert.strictEqual(Algo.keyClassOf('A'), 'shift');
    assert.strictEqual(Algo.keyClassOf('!'), 'shift');
    assert.strictEqual(Algo.keyClassOf('5'), 'punct');
    assert.strictEqual(Algo.keyClassOf(';'), 'punct');
    assert.strictEqual(Algo.keyClassOf(' '), 'func');
    assert.strictEqual(Algo.keyClassOf('Enter'), 'func');
});

test('latencyScoreOf: 同延迟按键类别归一化（字母基线严于 Shift 组合）', () => {
    const item = Algo.normalizeKeyStats({ total: 10, emaLatency: 900 });
    const letterScore = Algo.latencyScoreOf(item, 'a');
    const shiftScore = Algo.latencyScoreOf(item, 'A');
    assert.ok(letterScore > shiftScore, `letter=${letterScore} shift=${shiftScore}`);
    assert.ok(letterScore > 0.7 && shiftScore < 0.45);
});

test('fingerOf/rowOf: 指法与行号派生（含 Shift 符号回落基础键）', () => {
    assert.strictEqual(Algo.fingerOf('f'), 'f-li');
    assert.strictEqual(Algo.fingerOf('!'), 'f-lp');   // '!' -> '1'
    assert.strictEqual(Algo.fingerOf('J'), 'f-ri');
    assert.strictEqual(Algo.rowOf('q'), 1);
    assert.strictEqual(Algo.rowOf('z'), 3);
});

test('transitionBoost: 同指连击/同手跨行加权，跨手为 0', () => {
    assert.ok(Math.abs(Algo.transitionBoost('f', 'g') - Algo.TRANSITION_CONFIG.sameFingerBoost) < 1e-9);
    assert.strictEqual(Algo.transitionBoost('f', 'j'), 0);
    const qz = Algo.transitionBoost('q', 'z');   // 同指 + 跨行2
    assert.ok(Math.abs(qz - (Algo.TRANSITION_CONFIG.sameFingerBoost + Algo.TRANSITION_CONFIG.rowJumpBoost)) < 1e-9);
    assert.strictEqual(Algo.transitionBoost(' ', 'b'), 0);   // 拇指不参与
    assert.strictEqual(Algo.transitionBoost('f', 'f'), 0);   // 同键不加权
});

test('confidence 门控: 新键按错一次权重仍接近基线，成熟弱键权重显著更高', () => {
    const stats = {
        fresh: { total: 1, errors: 1, emaError: 0.18, streakWrong: 1 },
        weak: { total: 50, errors: 25, emaError: 0.5, emaLatency: 900 }
    };
    const ctx = { now: NOW };
    const freshW = Algo.weightForKey('fresh', stats, ctx);
    const weakW = Algo.weightForKey('weak', stats, ctx);
    assert.ok(freshW < 2, `freshW=${freshW}`);
    assert.ok(weakW > freshW * 2, `weakW=${weakW} freshW=${freshW}`);
});

test('weightForKey: emaError 单调性', () => {
    const ctx = { now: NOW };
    const low = Algo.weightForKey('a', { a: { total: 20, emaError: 0.1 } }, ctx);
    const high = Algo.weightForKey('a', { a: { total: 20, emaError: 0.4 } }, ctx);
    assert.ok(high > low);
});

test('pickWeighted: 极端弱键采样份额被封顶在 MAX_PICK_SHARE 附近', () => {
    const rng = mulberry32(7);
    const pool = Algo.getModePool('homeRow');
    const stats = {
        j: { total: 100, errors: 80, emaError: 1, emaLatency: 2000, streakWrong: 12, lastSeenAt: NOW, dueRound: 1, reviewGap: 1 }
    };
    const ctx = { now: NOW, roundMistakeByKey: { j: 10 }, roundNumber: 5 };
    const draws = 20000;
    let hits = 0;
    for (let i = 0; i < draws; i++) {
        if (Algo.pickWeighted(pool, stats, ctx, rng) === 'j') hits++;
    }
    const share = hits / draws;
    assert.ok(share <= Algo.MAX_PICK_SHARE + 0.02, `share=${share}`);
    assert.ok(share >= Algo.MAX_PICK_SHARE - 0.06, `share=${share}（应贴近封顶值）`);
});

test('insertReinforce: 回灌数量受 maxPendingPerKey 限制，位置在窗口内', () => {
    const rng = mulberry32(11);
    const seq = Array.from({ length: 25 }, () => Algo.makeSeqItem('a'));
    const inserted = Algo.insertReinforce(seq, 0, 'f', 3, rng);
    assert.strictEqual(inserted, 2);
    assert.strictEqual(Algo.pendingReinforceCount(seq, 0, 'f'), 2);
    seq.forEach((it, i) => {
        if (it.reinforced) assert.ok(i >= 1 && i <= Algo.REINFORCE_CONFIG.maxAhead + 2, `pos=${i}`);
    });
    // pending 已满，再插入无效
    assert.strictEqual(Algo.insertReinforce(seq, 0, 'f', 5, rng), 0);
});

test('applyReviewSchedule: 出错短间隔，清白通过间隔倍增，达上限后毕业', () => {
    const stats = {};
    Algo.applyReviewSchedule(stats, 5, [{ key: 'a', hadError: true }, { key: 'b', hadError: false }]);
    assert.strictEqual(stats.a.reviewGap, 1);
    assert.strictEqual(stats.a.dueRound, 6);
    assert.strictEqual(stats.b.dueRound, 0);   // 从未出错不排期

    let round = 6;
    const gaps = [];
    for (let i = 0; i < 6 && stats.a.dueRound > 0; i++) {
        round = Math.max(round, stats.a.dueRound);
        Algo.applyReviewSchedule(stats, round, [{ key: 'a', hadError: false }]);
        gaps.push(stats.a.reviewGap);
    }
    assert.deepStrictEqual(gaps, [2, 4, 8, 16, 0]);   // 最后一次毕业清零
    assert.strictEqual(stats.a.dueRound, 0);
});

test('reviewBoostOf: 未到期为 0，逾期递增且封顶', () => {
    const item = Algo.normalizeKeyStats({ dueRound: 5, reviewGap: 2 });
    assert.strictEqual(Algo.reviewBoostOf(item, 4), 0);
    assert.ok(Math.abs(Algo.reviewBoostOf(item, 5) - Algo.WEIGHT_CONFIG.reviewBoost) < 1e-9);
    assert.strictEqual(Algo.reviewBoostOf(item, 50), Algo.WEIGHT_CONFIG.reviewBoostCap);
});

test('bigram: 记录错误后该转移对权重上升', () => {
    const bigrams = {};
    for (let i = 0; i < 4; i++) {
        Algo.recordBigramAttempt(bigrams, 'h', 'j', { ok: false, now: NOW + i });
    }
    const stats = { j: { total: 20, emaError: 0.05 } };
    const base = Algo.weightForKey('j', stats, { now: NOW, prevKey: 'h' });
    const boosted = Algo.weightForKey('j', stats, { now: NOW, prevKey: 'h', bigramMap: bigrams });
    assert.ok(boosted > base, `boosted=${boosted} base=${base}`);
    assert.ok(Algo.bigramWeaknessTerm('h', 'j', bigrams) > 1);
});

test('pruneBigramMap: 超容量按 lastSeenAt 淘汰最旧', () => {
    const map = {};
    for (let i = 0; i < 700; i++) {
        map[`k${i}\tk${i + 1}`] = { total: 1, lastSeenAt: NOW + i };
    }
    Algo.pruneBigramMap(map);
    const ids = Object.keys(map);
    assert.strictEqual(ids.length, Algo.BIGRAM_CONFIG.maxEntries);
    assert.ok(!map['k0\tk1'] && map['k699\tk700']);
});

test('recordAttempt: 混淆对记录与延迟有效性过滤', () => {
    const stats = {};
    Algo.recordAttempt(stats, 'h', { ok: false, pressed: 'j', now: NOW });
    assert.strictEqual(stats.h.confusions.j, 1);
    assert.strictEqual(stats.h.streakWrong, 1);
    Algo.recordAttempt(stats, 'h', { ok: true, latencyMs: 5001, now: NOW });   // 分心样本不计
    assert.strictEqual(stats.h.emaLatency, 0);
    Algo.recordAttempt(stats, 'h', { ok: true, latencyMs: 800, now: NOW });
    assert.strictEqual(stats.h.emaLatency, 800);
    assert.strictEqual(stats.h.streakWrong, 0);
});

test('topConfusionOf: 样本≥2 且占比≥40% 才输出主导混淆', () => {
    assert.strictEqual(Algo.topConfusionOf(Algo.normalizeKeyStats({ confusions: { j: 3, k: 1 } })).key, 'j');
    assert.strictEqual(Algo.topConfusionOf(Algo.normalizeKeyStats({ confusions: { j: 1 } })), null);
    assert.strictEqual(Algo.topConfusionOf(Algo.normalizeKeyStats({ confusions: { j: 2, k: 2, l: 2 } })), null);
});

test('masteryOf: 快且准得高分，样本不足返回 null', () => {
    assert.strictEqual(Algo.masteryOf(Algo.normalizeKeyStats({ total: 2 }), 'a'), null);
    const good = Algo.masteryOf(Algo.normalizeKeyStats({ total: 20, emaError: 0.02, emaLatency: 300 }), 'a');
    assert.ok(good > 90, `mastery=${good}`);
});

test('computeGrowthStep: 阶梯加码 1/2/3', () => {
    assert.strictEqual(Algo.computeGrowthStep(1), 1);
    assert.strictEqual(Algo.computeGrowthStep(8), 2);
    assert.strictEqual(Algo.computeGrowthStep(16), 3);
    assert.strictEqual(Algo.computeGrowthStep(100), 3);
});

test('genSeq/extendSeq: 长度与键池约束', () => {
    const rng = mulberry32(3);
    const pool = Algo.getModePool('homeRow');
    const seq = Algo.genSeq(pool, {}, { now: NOW }, 25, rng);
    assert.strictEqual(seq.length, 25);
    seq.forEach(it => assert.ok(pool.includes(it.key)));
    Algo.extendSeq(seq, pool, {}, { now: NOW }, 500, rng);
    assert.strictEqual(seq.length, Algo.MAX_SEQ_LEN);
});

test('buildProgressModel: 早期废样本不塌陷基线', () => {
    const history = [{ accuracy: 0, kpm: 0 }];
    for (let i = 0; i < 30; i++) history.push({ accuracy: 95, kpm: 120 });
    const model = Algo.buildProgressModel(history);
    assert.ok(model.baselineEffectiveKpm > 50, `baseline=${model.baselineEffectiveKpm}`);
    assert.ok(model.indexEma[model.indexEma.length - 1] > 80);
});

// ===== 练习过程仿真 =====
// 虚拟打字者：弱键真实错误率高、随练习指数衰减；验证引擎
// 1) 弱键曝光高于均匀采样  2) 单键曝光不失控  3) 弱键 emaError 随训练下降
console.log('\n== 仿真（homeRow，60 轮，虚拟打字者）==');

function simulate({ rounds = 60, seed = 42 } = {}) {
    const rng = mulberry32(seed);
    const pool = Algo.getModePool('homeRow');
    const stats = {};
    const bigrams = {};
    let roundCounter = 0;
    let now = NOW;

    const baseError = {};
    pool.forEach(k => { baseError[k] = 0.03; });
    baseError.j = 0.35;
    baseError[';'] = 0.25;
    const latencyOf = k => (k === ';' ? 900 : 420) + rng() * 120;
    const practiced = {};
    const exposure = {};
    const exposureEarly = {};   // 前 10 轮（弱键尚未掌握阶段）
    const EARLY_ROUNDS = 10;

    for (let r = 0; r < rounds; r++) {
        const roundMistakeByKey = {};
        const ctx = () => ({ now, bigramMap: bigrams, roundMistakeByKey, roundNumber: roundCounter + 1 });
        let roundTargetLen = Algo.BASE_SEQ_LEN;
        let roundMistakes = 0;
        const seq = Algo.genSeq(pool, stats, ctx(), roundTargetLen, rng);
        const passedKeys = [];
        let idx = 0;
        let prevTarget = null;

        while (idx < seq.length) {
            const target = seq[idx].key;
            exposure[target] = (exposure[target] || 0) + 1;
            if (r < EARLY_ROUNDS) exposureEarly[target] = (exposureEarly[target] || 0) + 1;
            let mistakes = 0;
            for (;;) {
                now += 500;
                const p = Math.max(0.02, baseError[target] * Math.exp(-(practiced[target] || 0) / 40));
                const ok = rng() >= p;
                const latency = (ok && mistakes === 0) ? latencyOf(target) : null;
                Algo.recordAttempt(stats, target, { ok, pressed: ok ? target : 'x', latencyMs: latency, now });
                if (prevTarget) Algo.recordBigramAttempt(bigrams, prevTarget, target, { ok, latencyMs: latency, now });
                if (ok) break;
                mistakes++;
                roundMistakes++;
                roundMistakeByKey[target] = (roundMistakeByKey[target] || 0) + 1;
                roundTargetLen = Math.min(Algo.MAX_SEQ_LEN, roundTargetLen + Algo.computeGrowthStep(roundMistakes));
                Algo.extendSeq(seq, pool, stats, ctx(), Math.max(Algo.BASE_SEQ_LEN, roundTargetLen), rng);
                Algo.insertReinforce(seq, idx, target, mistakes, rng);
            }
            practiced[target] = (practiced[target] || 0) + 1;
            passedKeys.push({ key: target, hadError: mistakes > 0 });
            prevTarget = target;
            idx++;
        }

        roundCounter++;
        Algo.applyReviewSchedule(stats, roundCounter, passedKeys);
        Algo.pruneBigramMap(bigrams);
    }

    return { pool, stats, bigrams, exposure, exposureEarly, roundCounter };
}

const sim = simulate();
const totalExposure = Object.values(sim.exposure).reduce((a, b) => a + b, 0);
const totalEarly = Object.values(sim.exposureEarly).reduce((a, b) => a + b, 0);
const uniformShare = 1 / sim.pool.length;

console.log('  key | 前10轮份额 | 全程份额 | 末期emaError | 掌握度');
sim.pool.forEach(k => {
    const early = (sim.exposureEarly[k] || 0) / totalEarly;
    const share = (sim.exposure[k] || 0) / totalExposure;
    const item = Algo.normalizeKeyStats(sim.stats[k]);
    const mastery = Algo.masteryOf(item, k);
    console.log(`  ${k.padEnd(3)} | ${(early * 100).toFixed(1).padStart(8)}% | ${(share * 100).toFixed(1).padStart(6)}% | ${item.emaError.toFixed(3).padStart(10)} | ${String(mastery).padStart(4)}`);
});

test('仿真: 弱键 j 在未掌握阶段（前10轮）曝光显著高于均匀采样', () => {
    const share = sim.exposureEarly.j / totalEarly;
    assert.ok(share > uniformShare * 1.3, `early share=${(share * 100).toFixed(1)}% uniform=${(uniformShare * 100).toFixed(1)}%`);
});

test('仿真: 弱键掌握后强化退坡（全程份额低于未掌握阶段）', () => {
    const early = sim.exposureEarly.j / totalEarly;
    const overall = sim.exposure.j / totalExposure;
    assert.ok(overall < early, `early=${(early * 100).toFixed(1)}% overall=${(overall * 100).toFixed(1)}%`);
});

test('仿真: 无单键曝光失控（含回灌后 < 45%）', () => {
    sim.pool.forEach(k => {
        const share = (sim.exposure[k] || 0) / totalExposure;
        assert.ok(share < 0.45, `${k} share=${(share * 100).toFixed(1)}%`);
    });
});

test('仿真: 弱键 j 的 emaError 训练后收敛到低水平', () => {
    const item = Algo.normalizeKeyStats(sim.stats.j);
    assert.ok(item.emaError < 0.15, `emaError=${item.emaError.toFixed(3)}`);
});

test('仿真: 慢键 ; 被延迟项识别（曝光高于普通键）', () => {
    const slowShare = sim.exposure[';'] / totalExposure;
    const normalShare = sim.exposure.d / totalExposure;
    assert.ok(slowShare > normalShare, `; share=${(slowShare * 100).toFixed(1)}% d share=${(normalShare * 100).toFixed(1)}%`);
});

test('仿真: bigram 存量受上限约束，轮次计数正确', () => {
    assert.ok(Object.keys(sim.bigrams).length <= Algo.BIGRAM_CONFIG.maxEntries);
    assert.strictEqual(sim.roundCounter, 60);
});

console.log(`\n${passed} 项通过${process.exitCode ? '，存在失败项' : '，全部通过'}`);
