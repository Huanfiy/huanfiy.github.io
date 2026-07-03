/* =========================================================
 * keyboard-algo.js — 键位练习纯算法引擎
 *
 * 无 DOM、无 localStorage、无隐式时钟：时间(now)、随机数(rng)、
 * 统计状态(statsMap/bigramMap)全部由调用方注入。
 * 浏览器：window.KeyboardAlgo；Node：module.exports（可 require 做参数仿真与测试）。
 * ========================================================= */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.KeyboardAlgo = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ===== 常量与参数 =====
    const BASE_SEQ_LEN = 25;
    const MAX_SEQ_LEN = 100;
    const MAX_PICK_SHARE = 0.35;   // 单键采样概率封顶，防止多重加成复合后被"狂刷"

    const WEIGHT_CONFIG = {
        errorFactor: 4.0,        // 长期(衰减)错误率权重
        latencyFactor: 1.9,      // 反应延迟权重（慢但准的键也要练）
        streakFactor: 1.35,      // 短期连错权重
        streakCap: 5,
        roundBoostFactor: 1.6,   // 本轮内常错键加成
        roundBoostCap: 7,
        confSamples: 6,          // 置信度饱和样本数（小样本回退到均匀探索）
        reviewBoost: 1.4,        // 到期复习基础加权
        reviewOverdueStep: 0.25, // 每逾期一轮的追加比例
        reviewBoostCap: 2.8
    };

    const STATS_MODEL = {
        errorAlpha: 0.18,        // 错误率 EWMA 平滑系数（越大越看重近期）
        latencyAlpha: 0.25,      // 延迟 EWMA 平滑系数
        latMaxValidMs: 5000,     // 超过此值视为分心，不计入延迟
        // 延迟弱度按键类别归一化：Shift 组合是两键动作、功能键要移出主键区，
        // 天然比字母慢，共用一条基线会被系统性高估弱度
        latencyBands: {
            letter: { floor: 260, ceil: 1100 },
            punct:  { floor: 320, ceil: 1400 },
            shift:  { floor: 420, ceil: 1700 },
            func:   { floor: 300, ceil: 1300 }
        }
    };

    const REINFORCE_CONFIG = {
        minGap: 3,
        maxGap: 8,
        maxPendingPerKey: 2,     // 同一键在未打区段内最多并存几次回灌
        maxAhead: 14             // 回灌不超过当前位置之后多少格
    };

    // 生成侧转移启发式：主动加权制造训练难点（同指连击 / 同手跨行）
    const TRANSITION_CONFIG = {
        sameFingerBoost: 0.55,
        rowJumpBoost: 0.35,
        rowJumpMin: 2
    };

    // 数据驱动转移(bigram)模型：按 pair 记录 EWMA 错误率与延迟
    const BIGRAM_CONFIG = {
        errorFactor: 2.2,
        latencyFactor: 1.2,
        confSamples: 3,          // pair 置信度饱和样本数
        maxEntries: 600          // 只保留最近出现的 pair，防存储膨胀
    };

    // 按轮次计数的间隔重复：出错后短间隔复习，清白通过则间隔倍增，达上限后毕业
    const REVIEW_CONFIG = {
        failGap: 1,
        growth: 2,
        maxGap: 16
    };

    const CONFUSION_CONFIG = {
        maxEntries: 6,           // 每键保留的误按来源数
        pruneAt: 10
    };

    // ===== 键池 =====
    const POOLS = {
        homeRow:    ['a','s','d','f','g','h','j','k','l',';',"'"],
        topRow:     ['q','w','e','r','t','y','u','i','o','p','[',']','\\'],
        bottomRow:  ['z','x','c','v','b','n','m',',','.','/'],
        numberRow:  ['`','1','2','3','4','5','6','7','8','9','0','-','='],
        shiftCombo: [
            '~','!','@','#','$','%','^','&','*','(',')','_','+',
            '{','}','|',':','"','<','>','?',
            ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
        ],
        funcKeys:   ['Tab','CapsLock','Shift','Control','Alt','Enter','Backspace',' ']
    };

    function getAllKeys() {
        return [
            ...POOLS.homeRow, ...POOLS.topRow, ...POOLS.bottomRow,
            ...POOLS.numberRow, ...POOLS.shiftCombo, ...POOLS.funcKeys
        ];
    }

    function getModePool(m) {
        if (m === 'allKeys') return Array.from(new Set(getAllKeys()));
        return POOLS[m] || POOLS.homeRow;
    }

    // Shift 符号 → 基础键
    const SHIFT_BASE = {
        '~':'`','!':'1','@':'2','#':'3','$':'4','%':'5',
        '^':'6','&':'7','*':'8','(':'9',')':'0','_':'-',
        '+':'=','{':'[','}':']','|':'\\',':':';','"':"'",
        '<':',','>':'.','?':'/'
    };

    // ===== 物理布局（含指法分区，供页面渲染与转移建模共用）=====
    // [dataKey, label, shiftLabel, fingerClass, widthClass]
    const KB_ROWS = [
        [ // Number row
            ['`','`','~','f-lp',''],['1','1','!','f-lp',''],['2','2','@','f-lr',''],
            ['3','3','#','f-lm',''],['4','4','$','f-li',''],['5','5','%','f-li',''],
            ['6','6','^','f-ri',''],['7','7','&','f-ri',''],['8','8','*','f-rm',''],
            ['9','9','(','f-rr',''],['0','0',')','f-rp',''],['-','-','_','f-rp',''],
            ['=','=','+','f-rp',''],['Backspace','Back','','f-rp','w2']
        ],
        [ // Top row
            ['Tab','Tab','','f-lp','w1'],['q','Q','','f-lp',''],['w','W','','f-lr',''],
            ['e','E','','f-lm',''],['r','R','','f-li',''],['t','T','','f-li',''],
            ['y','Y','','f-ri',''],['u','U','','f-ri',''],['i','I','','f-rm',''],
            ['o','O','','f-rr',''],['p','P','','f-rp',''],['[','[','{','f-rp',''],
            [']',']','}','f-rp',''],['\\','\\','|','f-rp','w1']
        ],
        [ // Home row
            ['CapsLock','Caps','','f-lp','w2'],['a','A','','f-lp',''],['s','S','','f-lr',''],
            ['d','D','','f-lm',''],['f','F','','f-li',''],['g','G','','f-li',''],
            ['h','H','','f-ri',''],['j','J','','f-ri',''],['k','K','','f-rm',''],
            ['l','L','','f-rr',''],[';',';',':','f-rp',''],["'","'",'"','f-rp',''],
            ['Enter','Enter','','f-rp','w2']
        ],
        [ // Bottom row
            ['Shift','Shift','','f-lp','w2'],['z','Z','','f-lp',''],['x','X','','f-lr',''],
            ['c','C','','f-lm',''],['v','V','','f-li',''],['b','B','','f-li',''],
            ['n','N','','f-ri',''],['m','M','','f-ri',''],[',',',','<','f-rm',''],
            ['.','.','>' ,'f-rr',''],['/','/','?','f-rp',''],['Shift','Shift','','f-rp','w2']
        ],
        [ // Bottom controls
            ['Control','Ctrl','','f-lp','w3'],['Meta','Win','','f-lp','w3'],
            ['Alt','Alt','','f-th','w3'],[' ','Space','','f-th','space-key'],
            ['Alt','Alt','','f-th','w3'],['Meta','Win','','f-rp','w3'],
            ['Control','Ctrl','','f-rp','w3']
        ]
    ];

    // 由 KB_ROWS 派生：键 → 指法分区 / 行号（同键多实例取首个，如 Shift 取左手）
    const FINGER_OF = {};
    const ROW_OF = {};
    KB_ROWS.forEach((row, rowIdx) => {
        row.forEach(([dk, , , fc]) => {
            if (!(dk in FINGER_OF)) FINGER_OF[dk] = fc;
            if (!(dk in ROW_OF)) ROW_OF[dk] = rowIdx;
        });
    });

    // ===== 通用工具 =====
    function toFiniteNumber(v, fallback = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    }

    function clamp(v, min, max) {
        return Math.min(max, Math.max(min, v));
    }

    // ===== 键分类与指法 =====
    function baseKeyOf(key) {
        if (typeof key !== 'string' || !key) return key;
        if (key.length === 1 && key >= 'A' && key <= 'Z') return key.toLowerCase();
        return SHIFT_BASE[key] || key;
    }

    function keyClassOf(key) {
        if (typeof key !== 'string' || !key) return 'punct';
        if (key === ' ' || key.length > 1) return 'func';
        if (key >= 'a' && key <= 'z') return 'letter';
        if (key >= 'A' && key <= 'Z') return 'shift';
        if (SHIFT_BASE[key]) return 'shift';
        return 'punct';
    }

    function latencyBandOf(key) {
        return STATS_MODEL.latencyBands[keyClassOf(key)] || STATS_MODEL.latencyBands.punct;
    }

    function fingerOf(key) {
        return FINGER_OF[baseKeyOf(key)] || null;
    }

    function rowOf(key) {
        const base = baseKeyOf(key);
        return (base in ROW_OF) ? ROW_OF[base] : null;
    }

    function handOf(finger) {
        if (!finger || finger === 'f-th') return null;
        return finger[2] === 'l' ? 'L' : 'R';
    }

    // ===== 单键统计模型 =====
    function normalizeConfusions(raw) {
        const out = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
        Object.entries(raw).forEach(([k, v]) => {
            const n = Math.max(0, Math.floor(toFiniteNumber(v, 0)));
            if (k && n > 0) out[k] = n;
        });
        return out;
    }

    function normalizeKeyStats(raw) {
        const item = (raw && typeof raw === 'object') ? raw : {};
        const toNum = v => Number.isFinite(Number(v)) ? Number(v) : 0;
        const total = Math.max(0, Math.floor(toNum(item.total)));
        const errors = Math.max(0, Math.floor(toNum(item.errors)));
        // emaError: 衰减错误率。旧数据缺该字段时用历史均值回填，迁移无突变。
        const hasEma = Number.isFinite(Number(item.emaError));
        const emaError = clamp(hasEma ? toNum(item.emaError) : (total > 0 ? errors / total : 0), 0, 1);
        return {
            total,
            errors,
            streakWrong: Math.max(0, Math.floor(toNum(item.streakWrong))),
            reinforceDebt: Math.max(0, toNum(item.reinforceDebt)),  // 旧字段，保留以兼容导入识别
            lastSeenAt: Math.max(0, Math.floor(toNum(item.lastSeenAt))),
            emaError,
            emaLatency: Math.max(0, toNum(item.emaLatency)),        // 正确按键的平滑反应时延(ms)
            confusions: normalizeConfusions(item.confusions),       // 误按来源计数 { pressedKey: n }
            reviewGap: Math.max(0, Math.floor(toNum(item.reviewGap))),   // 间隔重复：当前复习间隔(轮)
            dueRound: Math.max(0, Math.floor(toNum(item.dueRound)))      // 间隔重复：到期轮次(0=未排期)
        };
    }

    function errorRateOf(item) {
        return item.total > 0 ? item.errors / item.total : 0;
    }

    // 置信度：样本越多越接近 1；小样本回退到均匀探索，避免按错一次就被狂刷
    function confidenceOf(item) {
        return clamp(item.total / WEIGHT_CONFIG.confSamples, 0, 1);
    }

    // 延迟弱度 0-1：越慢越接近 1（按键类别归一化；无有效延迟样本时为 0）
    function latencyScoreOf(item, key) {
        if (!(item.emaLatency > 0)) return 0;
        const band = latencyBandOf(key);
        return clamp((item.emaLatency - band.floor) / (band.ceil - band.floor), 0, 1);
    }

    // 掌握度 0-100：又快又准才高分；样本不足返回 null
    function masteryOf(item, key) {
        if (item.total < 3) return null;
        const accPart = 1 - clamp(item.emaError, 0, 1);
        const speedPart = 1 - latencyScoreOf(item, key);
        return Math.round(clamp(accPart * (0.65 + 0.35 * speedPart), 0, 1) * 100);
    }

    // 主导混淆键：该键最常被误按成什么（样本≥2 且占比≥40% 才有结论）
    function topConfusionOf(item) {
        const entries = Object.entries(item.confusions || {});
        if (!entries.length) return null;
        let sum = 0;
        let best = null;
        entries.forEach(([k, n]) => {
            sum += n;
            if (!best || n > best.count) best = { key: k, count: n };
        });
        if (!best || best.count < 2 || best.count / sum < 0.4) return null;
        return { key: best.key, count: best.count, share: best.count / sum };
    }

    function addConfusion(item, pressed) {
        item.confusions[pressed] = (item.confusions[pressed] || 0) + 1;
        const entries = Object.entries(item.confusions);
        if (entries.length > CONFUSION_CONFIG.pruneAt) {
            entries.sort((a, b) => b[1] - a[1]);
            item.confusions = {};
            entries.slice(0, CONFUSION_CONFIG.maxEntries).forEach(([k, n]) => {
                item.confusions[k] = n;
            });
        }
    }

    // 记录一次尝试（纯内存操作，落盘由调用方负责）
    function recordAttempt(statsMap, key, opts) {
        const { ok, pressed = null, latencyMs = null, now } = opts;
        const item = normalizeKeyStats(statsMap[key]);
        item.total++;
        item.lastSeenAt = now;

        // 衰减错误率：每次击键都更新，让权重跟踪"当前水平"而非历史包袱
        const ae = STATS_MODEL.errorAlpha;
        item.emaError = clamp(ae * (ok ? 0 : 1) + (1 - ae) * item.emaError, 0, 1);

        if (!ok) {
            item.errors++;
            item.streakWrong = Math.min(12, item.streakWrong + 1);
            if (pressed && pressed !== key) addConfusion(item, pressed);
        } else {
            item.streakWrong = 0;
            const lat = Number(latencyMs);
            if (Number.isFinite(lat) && lat > 0 && lat <= STATS_MODEL.latMaxValidMs) {
                const al = STATS_MODEL.latencyAlpha;
                item.emaLatency = item.emaLatency > 0
                    ? al * lat + (1 - al) * item.emaLatency
                    : lat;
            }
        }

        statsMap[key] = item;
        return item;
    }

    // ===== 转移(bigram)模型 =====
    const BIGRAM_SEP = '\t';   // 键名不含制表符，可安全作为 pair 分隔符

    function bigramIdOf(prevKey, key) {
        return prevKey + BIGRAM_SEP + key;
    }

    function normalizeBigramStats(raw) {
        const item = (raw && typeof raw === 'object') ? raw : {};
        return {
            total: Math.max(0, Math.floor(toFiniteNumber(item.total, 0))),
            emaError: clamp(toFiniteNumber(item.emaError, 0), 0, 1),
            emaLatency: Math.max(0, toFiniteNumber(item.emaLatency, 0)),
            lastSeenAt: Math.max(0, Math.floor(toFiniteNumber(item.lastSeenAt, 0)))
        };
    }

    // 记录一次转移尝试。cleanLatency 从上一键命中起算，本身就是转移时延
    function recordBigramAttempt(bigramMap, prevKey, key, opts) {
        const { ok, latencyMs = null, now } = opts;
        const id = bigramIdOf(prevKey, key);
        const item = normalizeBigramStats(bigramMap[id]);
        item.total++;
        item.lastSeenAt = now;
        const ae = STATS_MODEL.errorAlpha;
        item.emaError = clamp(ae * (ok ? 0 : 1) + (1 - ae) * item.emaError, 0, 1);
        if (ok) {
            const lat = Number(latencyMs);
            if (Number.isFinite(lat) && lat > 0 && lat <= STATS_MODEL.latMaxValidMs) {
                const al = STATS_MODEL.latencyAlpha;
                item.emaLatency = item.emaLatency > 0
                    ? al * lat + (1 - al) * item.emaLatency
                    : lat;
            }
        }
        bigramMap[id] = item;
        return item;
    }

    // 超出容量时按 lastSeenAt 淘汰最旧的 pair
    function pruneBigramMap(bigramMap, maxEntries = BIGRAM_CONFIG.maxEntries) {
        const ids = Object.keys(bigramMap);
        if (ids.length <= maxEntries) return bigramMap;
        ids
            .map(id => [id, normalizeBigramStats(bigramMap[id]).lastSeenAt])
            .sort((a, b) => a[1] - b[1])
            .slice(0, ids.length - maxEntries)
            .forEach(([id]) => { delete bigramMap[id]; });
        return bigramMap;
    }

    function bigramConfidenceOf(item) {
        return clamp(item.total / BIGRAM_CONFIG.confSamples, 0, 1);
    }

    // 数据驱动转移弱度：该 pair 实测错误率/延迟带来的加权
    function bigramWeaknessTerm(prevKey, key, bigramMap) {
        if (!prevKey || !bigramMap) return 0;
        const raw = bigramMap[bigramIdOf(prevKey, key)];
        if (!raw) return 0;
        const item = normalizeBigramStats(raw);
        const conf = bigramConfidenceOf(item);
        if (conf <= 0) return 0;
        let latScore = 0;
        if (item.emaLatency > 0) {
            const band = latencyBandOf(key);
            latScore = clamp((item.emaLatency - band.floor) / (band.ceil - band.floor), 0, 1);
        }
        return item.emaError * conf * BIGRAM_CONFIG.errorFactor
             + latScore * conf * BIGRAM_CONFIG.latencyFactor;
    }

    // 生成侧启发式：同指连击 / 同手大跨行是真实打字难点，主动制造训练机会
    function transitionBoost(prevKey, key) {
        if (!prevKey || prevKey === key) return 0;
        const f1 = fingerOf(prevKey);
        const f2 = fingerOf(key);
        if (!f1 || !f2) return 0;
        let boost = 0;
        if (f1 === f2 && f1 !== 'f-th') boost += TRANSITION_CONFIG.sameFingerBoost;
        const h1 = handOf(f1);
        const h2 = handOf(f2);
        if (h1 && h1 === h2) {
            const r1 = rowOf(prevKey);
            const r2 = rowOf(key);
            if (r1 !== null && r2 !== null && Math.abs(r1 - r2) >= TRANSITION_CONFIG.rowJumpMin) {
                boost += TRANSITION_CONFIG.rowJumpBoost;
            }
        }
        return boost;
    }

    // ===== 间隔重复（按轮次计数）=====
    function reviewBoostOf(item, roundNumber) {
        if (!Number.isFinite(roundNumber)) return 0;
        if (!(item.dueRound > 0) || roundNumber < item.dueRound) return 0;
        const overdue = roundNumber - item.dueRound;
        return Math.min(
            WEIGHT_CONFIG.reviewBoostCap,
            WEIGHT_CONFIG.reviewBoost * (1 + overdue * WEIGHT_CONFIG.reviewOverdueStep)
        );
    }

    // 轮次结束时更新复习排期。passedKeys: [{ key, hadError }]，同键可多次出现
    function applyReviewSchedule(statsMap, roundNumber, passedKeys) {
        const outcome = {};
        (passedKeys || []).forEach(({ key, hadError }) => {
            if (!outcome[key]) outcome[key] = { errored: false };
            if (hadError) outcome[key].errored = true;
        });
        Object.entries(outcome).forEach(([key, o]) => {
            const item = normalizeKeyStats(statsMap[key]);
            if (o.errored) {
                item.reviewGap = REVIEW_CONFIG.failGap;
                item.dueRound = roundNumber + REVIEW_CONFIG.failGap;
            } else if (item.dueRound > 0) {
                if (item.reviewGap >= REVIEW_CONFIG.maxGap) {
                    // 毕业：长间隔后仍清白通过，退出复习计划
                    item.reviewGap = 0;
                    item.dueRound = 0;
                } else {
                    item.reviewGap = Math.min(REVIEW_CONFIG.maxGap, Math.max(1, item.reviewGap) * REVIEW_CONFIG.growth);
                    item.dueRound = roundNumber + item.reviewGap;
                }
            }
            statsMap[key] = item;
        });
        return statsMap;
    }

    // ===== 采样与序列生成 =====
    function recencyFactor(lastSeenAt, now) {
        if (!lastSeenAt) return 0.2;
        const age = now - lastSeenAt;
        if (age < 60 * 1000) return 1;
        if (age < 5 * 60 * 1000) return 0.7;
        if (age < 30 * 60 * 1000) return 0.45;
        return 0.25;
    }

    // ctx: { now, prevKey?, bigramMap?, roundMistakeByKey?, roundNumber? }
    function weightForKey(key, statsMap, ctx) {
        const item = normalizeKeyStats(statsMap[key]);
        const conf = confidenceOf(item);
        const recent = recencyFactor(item.lastSeenAt, ctx.now);
        // 小样本时 conf 低 -> 误差/延迟项趋零，权重≈基线 1（均匀探索新键）
        const errorTerm = item.emaError * conf * WEIGHT_CONFIG.errorFactor;
        const latencyTerm = latencyScoreOf(item, key) * conf * WEIGHT_CONFIG.latencyFactor;
        const shortTerm = Math.min(item.streakWrong, WEIGHT_CONFIG.streakCap) * WEIGHT_CONFIG.streakFactor * recent;
        const roundBoost = Math.min(
            WEIGHT_CONFIG.roundBoostCap,
            ((ctx.roundMistakeByKey && ctx.roundMistakeByKey[key]) || 0) * WEIGHT_CONFIG.roundBoostFactor
        );
        const reviewTerm = reviewBoostOf(item, ctx.roundNumber);
        const transitionTerm = transitionBoost(ctx.prevKey, key);
        const bigramTerm = bigramWeaknessTerm(ctx.prevKey, key, ctx.bigramMap);
        return 1 + errorTerm + latencyTerm + shortTerm + roundBoost + reviewTerm + transitionTerm + bigramTerm;
    }

    function pickWeighted(pool, statsMap, ctx, rng = Math.random) {
        const items = pool.map(key => {
            let w = weightForKey(key, statsMap, ctx);
            if (ctx.prevKey && key === ctx.prevKey) w *= 0.82;
            return { key, w: Math.max(0.1, w) };
        });
        let total = items.reduce((sum, it) => sum + it.w, 0);
        // 单键概率封顶：w/(w+rest) <= MAX_PICK_SHARE
        if (items.length > 1 && 1 / items.length < MAX_PICK_SHARE) {
            const ratio = MAX_PICK_SHARE / (1 - MAX_PICK_SHARE);
            items.forEach(it => {
                const cap = ratio * (total - it.w);
                if (it.w > cap) {
                    total += cap - it.w;
                    it.w = cap;
                }
            });
        }
        let r = rng() * total;
        for (const it of items) {
            r -= it.w;
            if (r <= 0) return it.key;
        }
        return items[items.length - 1].key;
    }

    // 序列元素为对象 { key, reinforced }，使回灌标记在 splice 后仍稳定跟随元素
    function makeSeqItem(key, reinforced = false) {
        return { key, reinforced };
    }

    // 仅向尾部追加（mutates seq），prev 取序列尾部保证转移上下文连续
    function extendSeq(seq, pool, statsMap, ctx, wanted, rng = Math.random) {
        const target = Math.min(MAX_SEQ_LEN, wanted);
        const local = Object.assign({}, ctx);
        local.prevKey = seq.length ? seq[seq.length - 1].key : (ctx.prevKey || null);
        while (seq.length < target) {
            const nextKey = pickWeighted(pool, statsMap, local, rng);
            seq.push(makeSeqItem(nextKey));
            local.prevKey = nextKey;
        }
        return seq;
    }

    function genSeq(pool, statsMap, ctx, length = BASE_SEQ_LEN, rng = Math.random) {
        return extendSeq([], pool, statsMap, ctx, length, rng);
    }

    function computeGrowthStep(mistakes) {
        return 1 + Math.min(2, Math.floor(mistakes / 8));
    }

    // 统计当前位置之后、尚未打到的区段里某键已有的回灌数量
    function pendingReinforceCount(seq, idx, key) {
        let n = 0;
        for (let i = idx + 1; i < seq.length; i++) {
            if (seq[i].reinforced && seq[i].key === key) n++;
        }
        return n;
    }

    // 出错即在近距离窗口内就地 splice 插入回灌键（mutates seq），返回插入数量
    function insertReinforce(seq, idx, key, currentTargetMistakes, rng = Math.random) {
        const insertCount = Math.min(2, 1 + Math.floor(currentTargetMistakes / 2));
        let inserted = 0;
        for (let n = 0; n < insertCount; n++) {
            if (seq.length >= MAX_SEQ_LEN) break;
            if (pendingReinforceCount(seq, idx, key) >= REINFORCE_CONFIG.maxPendingPerKey) break;

            const gap = REINFORCE_CONFIG.minGap +
                Math.floor(rng() * (REINFORCE_CONFIG.maxGap - REINFORCE_CONFIG.minGap + 1));
            let pos = Math.min(idx + gap + n * 2, idx + REINFORCE_CONFIG.maxAhead, seq.length);
            if (pos < idx + 1) pos = idx + 1;

            // 避免与相邻键相同造成连续同键
            if (seq[pos - 1] && seq[pos - 1].key === key) pos++;
            if (pos < seq.length && seq[pos].key === key) pos++;
            pos = Math.min(pos, seq.length);

            seq.splice(pos, 0, makeSeqItem(key, true));
            inserted++;
        }
        return inserted;
    }

    // ===== 进步统计模型 =====
    function averageFromArray(values) {
        if (!Array.isArray(values) || !values.length) return null;
        return values.reduce((acc, n) => acc + n, 0) / values.length;
    }

    function medianOf(values) {
        if (!Array.isArray(values) || !values.length) return null;
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
        return sorted[mid];
    }

    function emaSeries(values, period = 7) {
        if (!Array.isArray(values) || !values.length) return [];
        const p = Math.max(2, Math.floor(period));
        const alpha = 2 / (p + 1);
        const out = [values[0]];
        for (let i = 1; i < values.length; i++) {
            out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
        }
        return out;
    }

    // 有效键/分：kpm × 准确率²，惩罚"快而不准"
    function effectiveKpmOf(item) {
        const acc = clamp(toFiniteNumber(item.accuracy, 0), 0, 100) / 100;
        const kpm = Math.max(0, toFiniteNumber(item.kpm, 0));
        return kpm * acc * acc;
    }

    function buildProgressModel(history, baselineOverride = null) {
        if (!history.length) return null;
        const effective = history.map(effectiveKpmOf);
        const baseSeed = effective.slice(0, Math.min(10, effective.length)).filter(v => v > 0);
        // Fall back to the median of all positive sessions before the hard 1 floor,
        // so an unusable early sample can't collapse the baseline and inflate the index.
        const baseRaw = medianOf(baseSeed) || medianOf(effective.filter(v => v > 0)) || effective[0] || 1;
        // 注意不能用 toFiniteNumber(null, baseRaw)：Number(null)===0 是有限值，
        // 会把"无覆盖值"错判成基线 0，导致基线恒为 1、指数失去"100=起点"语义
        const override = Number(baselineOverride);
        const baselineEffectiveKpm = Math.max(1, (baselineOverride !== null && baselineOverride !== undefined && Number.isFinite(override) && override > 0) ? override : baseRaw);
        const indexRaw = effective.map(v => Math.max(0, (v / baselineEffectiveKpm) * 100));
        const indexEma = emaSeries(indexRaw, 7);
        const accEma = emaSeries(history.map(item => item.accuracy), 7);
        const kpmEma = emaSeries(history.map(item => item.kpm), 7);
        return {
            history,
            effective,
            baselineEffectiveKpm,
            indexRaw,
            indexEma,
            accEma,
            kpmEma
        };
    }

    function compareRecent(values, preferredWindow = 7) {
        if (!Array.isArray(values) || values.length < 4) return null;
        const win = Math.min(preferredWindow, Math.floor(values.length / 2));
        if (win < 2) return null;
        const recent = averageFromArray(values.slice(-win));
        const prev = averageFromArray(values.slice(-(win * 2), -win));
        if (recent === null || prev === null) return null;
        return { recent, prev };
    }

    function computeStability(effectiveSeries) {
        if (!effectiveSeries.length) return null;
        const mean = averageFromArray(effectiveSeries);
        if (!mean || mean <= 0) return { score: 100, label: '稳定' };
        const variance = effectiveSeries.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / effectiveSeries.length;
        const std = Math.sqrt(variance);
        const cv = std / mean;
        const score = clamp(Math.round((1 - Math.min(cv, 0.45) / 0.45) * 100), 0, 100);
        const label = score >= 80 ? '稳定' : (score >= 60 ? '可控' : '波动偏大');
        return { score, label };
    }

    // ===== 导出 =====
    return {
        // 常量
        BASE_SEQ_LEN, MAX_SEQ_LEN, MAX_PICK_SHARE,
        WEIGHT_CONFIG, STATS_MODEL, REINFORCE_CONFIG,
        TRANSITION_CONFIG, BIGRAM_CONFIG, REVIEW_CONFIG, CONFUSION_CONFIG,
        POOLS, KB_ROWS, SHIFT_BASE, BIGRAM_SEP,
        // 工具
        toFiniteNumber, clamp,
        getAllKeys, getModePool,
        baseKeyOf, keyClassOf, latencyBandOf, fingerOf, rowOf, handOf,
        // 单键模型
        normalizeKeyStats, errorRateOf, confidenceOf, latencyScoreOf,
        masteryOf, topConfusionOf, recordAttempt,
        // 转移模型
        bigramIdOf, normalizeBigramStats, recordBigramAttempt,
        pruneBigramMap, bigramWeaknessTerm, transitionBoost,
        // 间隔重复
        reviewBoostOf, applyReviewSchedule,
        // 采样与序列
        recencyFactor, weightForKey, pickWeighted,
        makeSeqItem, genSeq, extendSeq,
        computeGrowthStep, pendingReinforceCount, insertReinforce,
        // 进步统计
        averageFromArray, medianOf, emaSeries, effectiveKpmOf,
        buildProgressModel, compareRecent, computeStability
    };
});
