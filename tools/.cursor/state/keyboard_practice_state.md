# 键盘练习工具状态文档

> 最后更新：2026-07-03
> 适用范围：`tools/keyboard.html` + `tools/keyboard-algo.js`（+ `tools/keyboard-algo.test.js`）

## 1. 设计原则

- 刻意练习优先：错误不能被“滑过去”，必须纠正后再推进。
- 反馈闭环清晰：用户要知道目标键是什么、自己按了什么、为什么错。
- 强化应有体感：常错键需要在短期内更高频出现，而不是只做弱概率偏置。
- 节奏自然可持续：强化明显但不过激，避免连续刷同一键造成挫败。
- 数据可解释：统计指标和训练行为要一致，避免“看起来进步但实际逃错”。

## 2. 训练目标

- 提高盲打准确率与按键定位稳定性。
- 缩短“出错 -> 识别错误 -> 纠正”的反馈回路。
- 通过短期强化和长期统计联动，持续压低个人弱键错误率。

## 3. 架构（2026-07-03 重构后）

- **`tools/keyboard-algo.js`**：纯算法引擎（UMD）。无 DOM / 无 localStorage / 无隐式时钟，
  时间(`now`)、随机数(`rng`)、状态(`statsMap`/`bigramMap`)全部由调用方注入。
  浏览器挂 `window.KeyboardAlgo`，node 可直接 `require` 做仿真与测试。
- **`tools/keyboard.html`**：页面控制层（渲染 / 输入 / localStorage 存储），通过 `Algo.*` 调用引擎。
- **`tools/keyboard-algo.test.js`**：`node tools/keyboard-algo.test.js` 运行；
  25 项 = 单元测试（权重单调性、置信度门控、封顶、回灌、复习排期、bigram、混淆、进步模型）
  + 60 轮虚拟打字者仿真（验证弱键曝光提升、掌握后强化退坡、无单键曝光失控、错误率收敛）。
  参数调整（`WEIGHT_CONFIG` 等）应先跑仿真再上线。

## 4. 当前实现（已落地）

### 4.1 模式策略

- 模式选择器（基础行/上行/下行/数字行/Shift 组合/功能键/全键混合），所有模式统一进入智能采样与强化流程。

### 4.2 推进规则

- 命中目标键：`idx++`；未命中：停留当前目标直到打对。
- 准确率按“尝试次数”计；**KPM 按净推进数（passedKeys）计**，快速乱按不再推高键/分。

### 4.3 错误反馈

- 当前目标大键：错误时红色放大并保持；下方目标键 `target-wrong` 高亮；实际按键 `wrong-press` 跳动。
- 错按时记录混淆对（target -> pressed，`confusions` 字段，每键留 top 6），
  弱键面板显示主导混淆（“常误 X”，样本≥2 且占比≥40% 才输出）。
- CapsLock 开启时显示提示条（`getModifierState('CapsLock')`，keydown/keyup 双向刷新）。

### 4.4 强化引擎（单键掌握度 + 转移建模 + 间隔重复）

权重 = 1 + 错误项 + 延迟项 + 连错项 + 本轮加成 + 复习到期项 + 转移启发项 + bigram 实测项：

- **EWMA 错误率**（`errorAlpha`）：跟踪当前水平而非历史包袱。
- **反应延迟**（`emaLatency`）：**按键类别归一化**（letter/punct/shift/func 各自 floor/ceil，
  见 `STATS_MODEL.latencyBands`），Shift 组合/功能键天然慢，不再被系统性高估弱度。
- **置信度门控**（`confSamples`）：小样本回退均匀探索。
- **间隔重复**（`REVIEW_CONFIG`，按轮次计数）：出错 -> 下一轮到期；到期后清白通过 -> 间隔 2/4/8/16 倍增；
  16 轮间隔后仍清白 -> 毕业退出排期。到期键获得 `reviewBoost` 加权（逾期递增、封顶）。
- **转移启发式**（`TRANSITION_CONFIG`）：同指连击 +0.55、同手跨行≥2 +0.35，
  指法/行号数据由 `KB_ROWS` 派生，主动制造真实打字难点的训练机会。
- **bigram 实测模型**（`BIGRAM_CONFIG`）：按 pair 记录 EWMA 错误率/延迟
  （cleanLatency 从上一键命中起算，本身就是转移时延），弱转移对在采样时加权；
  存量上限 600 条，按 `lastSeenAt` 淘汰最旧。
- **采样概率封顶**（`MAX_PICK_SHARE = 0.35`）：单键采样份额封顶，防多重加成复合后被狂刷。
- **即时回灌**：错误键近距离窗口内 `splice` 就地插入，不重排未来序列（同前版）。
- **掌握度指标**：`masteryOf(item, key)` = 准确率 × 速度（0-100，类别归一化），样本不足返回 null。

### 4.5 轮次长度策略

- 基线 25 键；出错按阶梯加码（`computeGrowthStep`），封顶 100 键；无错通关保持 25。

### 4.6 数据持久化（schema v2）

- `keyboard_practice_stats` 现为包装结构 `{ version: 2, keys, bigrams, roundCounter }`；
  读取时自动迁移 v1（无 version 的扁平 map），`emaError` 缺失用历史均值回填。
- 内存缓存 + 防抖落盘（800ms）+ 关键节点（轮次结束/beforeunload/切后台）。
- **会话历史同样走内存缓存**（`sessionCache`），不再每次渲染整盘 `JSON.parse`。
- 导出 `schemaVersion: 2`（含 `bigramStats`、`engineMeta.roundCounter`）；
  导入兼容 v1/v2 导出与裸 localStorage 结构，写入失败自动回滚。
- 会话历史上限 `MAX_STORED_SESSIONS = 2000`。

### 4.7 口径与主题一致性

- 热力图与弱键面板统一用 `emaError`（已掌握的键不再因终身错误率常年标红）。
- 趋势图 SVG 配色走 CSS 变量（`.tc-*` 类），亮/暗主题自动适配，主线用 `--primary-color`。
- 练习激活时放行 Ctrl/Meta 组合快捷键（目标是修饰键时除外），F5/Ctrl+C 恢复可用。

### 4.8 已修复的历史 bug

- `buildProgressModel` 基线 bug：`toFiniteNumber(null, baseRaw)` 因 `Number(null)===0` 恒返回 0，
  基线被钉死在 1，进步指数实为 effectiveKpm×100 的膨胀值，“100=起点”语义从未生效。
  2026-07-03 修复；旧会话数据无需迁移，指数会自然回落到以早期练习为基线的正确量纲。

## 5. 当前关键参数（实现侧，均在 keyboard-algo.js 顶部）

- 轮次：`BASE_SEQ_LEN = 25`，`MAX_SEQ_LEN = 100`
- 采样：`WEIGHT_CONFIG`（含 `reviewBoost*`）、`MAX_PICK_SHARE = 0.35`
- 统计：`STATS_MODEL`（`errorAlpha`、`latencyAlpha`、`latMaxValidMs`、`latencyBands` 四类）
- 回灌：`REINFORCE_CONFIG`（`minGap/maxGap/maxPendingPerKey/maxAhead`）
- 转移：`TRANSITION_CONFIG`、`BIGRAM_CONFIG`
- 复习：`REVIEW_CONFIG`（`failGap=1`、`growth=2`、`maxGap=16`）
- 混淆：`CONFUSION_CONFIG`；会话上限 `MAX_STORED_SESSIONS = 2000`

> 参数为当前手感版本；调参前先跑 `node tools/keyboard-algo.test.js` 的仿真段看曝光份额与收敛。

## 6. 后续可选优化

- 完成弹层展示“本轮回灌命中效果”，提升训练可解释性。
- 回灌强度档位（标准/增强），兼顾新手与高阶用户手感。
- bigram 模型进阶：用混淆对数据驱动定向组卷（如 h/j 混淆时刻意生成交替序列）。
- 弱键面板点击直达“弱键冲刺”微型轮次（top-3 弱键 10 键速刷）。
