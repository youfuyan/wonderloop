# 文档 1/3：内容管线 Prompt 套件 v1.0

<!-- 原文内容逐行保留，仅补回原文标题并标记分类。 -->

> 按"内容优先"路径，先交付这份——用它跑出 2 集样片验证内容水准，达标后再输出文档 2（CLAUDE.md + Schema）和文档 3（Phase 1 任务分解）。
> 本文档中定义的 **Episode JSON 结构就是内容契约**，文档 2 的数据库 schema 将直接与它对齐。

---

## 0. 管线总览与文件结构

```
content/
├── topics.yaml              # 选题库（人工维护，每条绑定事实来源）
├── question-bank.yaml       # 100 题高频"为什么"清单（Prompt C 产出）
├── prompts/
│   ├── generator.md         # Prompt A
│   ├── reviewer.md          # Prompt B
│   └── question-bank.md     # Prompt C
├── drafts/                  # Layer 1 输出：{topic_id}.draft.json
├── reviews/                 # Layer 2 输出：{topic_id}.review.json
├── approved/                # Layer 4 人工批准后：{topic_id}.final.json
├── audio/                   # TTS 输出：{topic_id}.{lang}.mp3
└── scripts/
    ├── generate.ts          # 调 Prompt A
    ├── review.ts            # 调 Prompt B + Router 分流
    ├── review-ui/           # 本地审核界面（Vite 单页即可）
    ├── tts.ts               # Azure TTS，SSML 处理
    └── publish.ts           # 上传音频 + 写入数据库
```

数据流：`topics.yaml → generate → drafts/ → review → reviews/ →（Router 分流）→ 人工终审 → approved/ → tts → audio/ → publish`

---

## 1. Episode 内容 JSON Schema（内容契约）

这是整个产品最重要的数据结构。播放器的暂停点、问题卡、回顾功能全部由它驱动。

```jsonc
{
  "topic_id": "animals-bird-powerline",
  "version": 1,
  "age_band": "5-8",
  "category": "animals",           // 8 大类别之一
  "title": {
    "en": "Why Don't Birds Get Shocked on Power Lines?",
    "zh": "为什么小鸟站在电线上不会触电？"
  },

  // ── 知识大纲：中英版本共同的"事实骨架"，双语一致性以此为准 ──
  "knowledge_outline": [
    "电流总是走电阻最小的路径",
    "小鸟两脚站在同一根电线上，两脚之间几乎没有电压差",
    "如果同时接触两根线或电线与地面，就会形成回路而触电"
  ],

  // ── 事实断言清单：每条必须有来源，Reviewer 逐条核对 ──
  "fact_claims": [
    {
      "claim": "鸟两脚间电位差极小，电流不经过鸟身",
      "source_url": "https://...",
      "source_note": "来源中的支撑段落摘录"
    }
  ],

  // ── 六环节，播放器按顺序渲染；pause_after=true 时音频停止并弹问题卡 ──
  "segments": [
    {
      "type": "hook",
      "pause_after": false,
      "script": {
        "en": "If touching a power line is dangerous, why do birds sit on them all day... and nothing happens?",
        "zh": "摸电线很危险，可小鸟每天站在电线上，为什么一点事都没有呢？"
      }
    },
    {
      "type": "predict",
      "pause_after": true,
      "question": {
        "en": "What do you think? Is it because...",
        "zh": "你猜猜看，是因为……"
      },
      "options": [
        { "id": "a", "en": "Birds' feet are electricity-proof", "zh": "小鸟的脚不怕电" },
        { "id": "b", "en": "The electricity doesn't go through the bird", "zh": "电根本没有穿过小鸟的身体" },
        { "id": "c", "en": "Power lines turn off when birds land", "zh": "小鸟一落上去，电线就断电了" }
      ],
      "no_wrong_answer_note": {   // 播放器展示给家长的引导语
        "en": "Any guess is a good guess — don't correct yet!",
        "zh": "怎么猜都可以，先别急着纠正！"
      }
    },
    {
      "type": "story",
      "pause_after": false,
      "script": { "en": "…(300-450 words)…", "zh": "……（400–600字）……" }
    },
    {
      "type": "think",
      "pause_after": true,
      "question": {
        "en": "What if the bird had one foot on the wire and one foot on the pole?",
        "zh": "如果小鸟一只脚站在电线上，另一只脚碰到了电线杆，会怎么样？"
      },
      "answer_guidance": {        // 给家长看的参考答案，不播出
        "en": "...", "zh": "..."
      }
    },
    {
      "type": "teach_back",
      "pause_after": true,
      "prompt": {
        "en": "Now tell your grown-up in ONE sentence: why is the bird safe?",
        "zh": "现在用一句话告诉爸爸妈妈：小鸟为什么没事？"
      }
    },
    {
      "type": "new_question",
      "pause_after": true,
      "prompt": {
        "en": "What else do you wonder about electricity?",
        "zh": "关于电，你还想知道什么呢？"
      }
    }
  ],

  // ── 次日回顾（20–30 秒），插入到下一集开头 ──
  "recall_question": {
    "en": "Yesterday we met a bird on a power line. Why didn't it get shocked?",
    "zh": "还记得昨天电线上的小鸟吗？它为什么没有触电呀？",
    "answer_hint": { "en": "...", "zh": "..." }
  },

  // ── 双语桥：Bilingual 模式下故事结尾播报的核心词对照 ──
  "bilingual_bridge": [
    { "en": "electricity", "zh": "电", "pinyin": "diàn" },
    { "en": "power line", "zh": "电线", "pinyin": "diàn xiàn" },
    { "en": "safe", "zh": "安全", "pinyin": "ān quán" }
  ],

  // ── 元数据 ──
  "sensitivity": "none",          // none | low | high（high 强制完整人审）
  "estimated_duration_sec": { "en": 330, "zh": 360 }
}
```

**三种语言模式的组装规则**（播放器逻辑，写入文档 2）：
- `English`：全英文 segments
- `中文`：全中文 segments
- `Bilingual`：主语言 story + 结尾 bilingual_bridge + 问题卡双语显示（音频只生成 en/zh 两版，Bilingual 是前端组装，**不需要第三版音频**——控制 TTS 成本的关键决策）

---

## 2. topics.yaml 选题条目格式

```yaml
- topic_id: animals-bird-powerline
  category: animals
  question_zh: 为什么小鸟站在电线上不会触电？
  question_en: Why don't birds get shocked on power lines?
  age_band: "5-8"
  sensitivity: none          # 电安全话题 → story 中必须含安全提醒，见 Generator 约束
  sources:                   # ⚠️ 必填，至少 2 条；无来源的选题不允许进入生成
    - url: https://...
      note: 电流路径原理
    - url: https://...
      note: 鸟类与输电线路的科普说明
  bilingual_hook: null       # 语言文化类选题填写双语切入点，其他类可空
  status: ready              # ready | generated | published | rejected
```

---

## 3. Prompt A — Generator（生成器）

> 模型建议：Claude Sonnet 级别起步（成本 ~$0.1/集），样片阶段可用 Opus 级别对比质量差异再定。温度 0.7。

```markdown
# SYSTEM

你是 WonderLoop 的首席儿童音频编剧。WonderLoop 是面向北美华人家庭 5–8 岁孩子的
每日双语好奇心节目。每集 5–8 分钟，由家长陪孩子一起收听，音频会在指定位置暂停，
由家长向孩子提问。

## 你的写作铁律

**受众与语言**
1. 听众是 5–8 岁孩子，词汇和句式必须匹配：英文对标 CEFR A1–A2 / 美国 K-2 朗读水平；
   中文对标国内一二年级口语。单句不超过 15 个英文单词 / 20 个汉字。
2. 中文版和英文版是**两次独立创作**，共享同一份 knowledge_outline，
   禁止逐句翻译。中文要有中文的语感（叠词、语气词、儿歌式节奏），
   英文要有英文的语感。两版知识点必须完全等价。
3. 专业术语最多引入 1–2 个，且必须立即用生活比喻解释
   （如"电流就像水流，总挑最好走的路"）。

**知识与事实**
4. 你只能使用下方 SOURCES 中提供的事实。禁止补充来源之外的具体数字、
   年份、纪录。每条写进故事的事实断言，都要登记到 fact_claims 并标注来源。
5. 简化可以，歪曲不行。如果准确解释超出 5–8 岁理解力，宁可说
   "等你长大一点我们再深入聊"，也不编造错误模型。

**教学设计**
6. Hook 必须制造认知冲突（"明明……为什么却……"），禁止直接给答案。
7. Predict 的三个选项中：一个是常见儿童迷思（misconception），
   一个是正确方向，一个是有趣但明显好玩的干扰项。选错不批评。
8. Think 问题必须是**迁移应用题**（换一个情境），禁止"你记住了吗"式复述题。
9. Story 中安排 1 个角色和 1 个贯穿的生活比喻，用对话推进，不用讲课腔。

**安全**
10. 禁止：恐吓性描述、死亡/暴力细节、任何可能引发模仿危险的内容。
    涉及安全话题（电、火、水、交通）时，story 结尾必须自然带出一句
    面向孩子的安全提醒，语气温和不吓人。
11. 文化中立：例子要让北美华人家庭有共鸣（早餐、超市、公园、祖父母），
    避免刻板印象。

## 输出格式
只输出一个 JSON 对象，严格遵循 Episode Schema（见下方 SCHEMA）。
不要输出任何 JSON 之外的文字。

# USER

## TOPIC
{topics.yaml 中该条目的完整内容}

## SOURCES
{每条来源的抓取正文或人工摘录，2000 字以内/条}

## SCHEMA
{第 1 节的 JSON Schema，含字段说明}
```

---

## 4. Prompt B — Adversarial Reviewer（对抗审核）

> **必须用与 Generator 不同的模型或至少独立的会话**，温度 0.2。它的任务是"挑毛病"，不是"给面子"。

```markdown
# SYSTEM

你是一位极其挑剔的儿童教育内容审核专家，同时具备科学事实核查员、
儿童发展心理学家和双语教育者三重身份。你的工作是阻止不合格内容
到达 5–8 岁孩子面前。你宁可误杀，不可放过。

对下方 EPISODE 逐项审核，输出结构化 JSON 报告。

## 审核维度（各 0–10 分）

1. **factual（事实性）**：将 story 和 fact_claims 中的每条断言与 SOURCES 逐条比对。
   - 发现任何 SOURCES 无法支撑的具体断言 → 该维度 ≤ 5，并逐条列入 line_issues
   - 简化导致的科学性错误（错误心智模型）→ ≤ 3

2. **age_fit（适龄性）**：抽查最难的 5 个句子。超长句、抽象概念未配比喻、
   词汇超纲 → 逐条标注。

3. **safety（安全性）**：恐吓、暴力、可模仿危险行为、敏感话题
   （死亡/疾病/战争/宗教/身体隐私）。任何命中 → 直接 0–3 分并标 critical flag。
   安全类话题缺失安全提醒 → ≤ 6。

4. **pedagogy（教学质量）**：
   - Predict 选项是否含真实的儿童迷思？
   - Think 是否为迁移题而非复述题？
   - Hook 是否制造了认知冲突？
   任一不满足 → 逐项扣分并说明。

5. **bilingual_parity（双语一致性）**：对照 knowledge_outline，检查中英版本
   知识点是否等价、有无一方遗漏或多出断言、中文是否有翻译腔
   （逐句直译痕迹）、bilingual_bridge 词条的中英是否准确对应。

## 输出格式（只输出 JSON）

{
  "scores": { "factual": 0, "age_fit": 0, "safety": 0, "pedagogy": 0, "bilingual_parity": 0 },
  "critical_flags": ["..."],
  "line_issues": [
    {
      "segment": "story",
      "lang": "zh",
      "quote": "有问题的原句",
      "issue_type": "factual | age_fit | safety | pedagogy | bilingual",
      "issue": "问题描述",
      "suggested_fix": "建议改写"
    }
  ],
  "summary_for_human": "给人工终审者的 3 句话摘要：最需要看的问题是什么"
}

# USER

## EPISODE
{draft JSON}

## SOURCES
{与 Generator 相同的来源材料}
```

---

## 5. Router 分流规则（`review.ts` 中的确定性逻辑）

```
IF critical_flags 非空                          → REJECT（弃稿或退回重生成）
ELSE IF sensitivity == "high"（来自 topics.yaml）→ FULL_REVIEW（强制人工逐项）
ELSE IF 所有维度 ≥ 8 且 safety == 10            → FAST_TRACK
ELSE                                            → FULL_REVIEW
```

- **FAST_TRACK**：审核 UI 只呈现 `summary_for_human` + 随机抽 2 个 segment 供你通读，目标 3–5 分钟/集。
- **FULL_REVIEW**：呈现全部 line_issues，每条支持"接受建议修复 / 手动改写 / 忽略"，改完可一键重跑 Reviewer 复检。
- 无论哪条通道，**"批准发布"按钮永远只能由人点击**。每次批准写入 `approved_by + approved_at`，这是你对家长的信任承诺，也是未来出问题时的追溯记录。

阈值先用上表跑首批 20 集，统计 FAST_TRACK 命中率：低于 50% 说明 Generator prompt 需要修，而不是放松阈值。

---

## 6. Prompt C — 100 题高频"为什么"清单生成任务

> 这是给 Claude Code 的一次性任务，产出 `question-bank.yaml`。

```markdown
# TASK: 生成 WonderLoop 100 题候选清单

## 背景
WonderLoop 面向北美华人家庭 5–8 岁孩子，每日一集双语好奇心音频。
需要 100 个经过交叉验证的高频儿童"为什么"问题作为首年选题池。

## 方法（按顺序执行）

1. **竞品选题采集**：整理以下节目的历史选题（各取 50+ 条）：
   But Why (VPR)、Brains On、Wow in the World、Tumble Science Podcast。
   这些是已被市场验证有儿童需求的问题。

2. **家长社区信号**：从 Reddit (r/Parenting, r/ScienceParents)、
   小红书"孩子问倒我了"类话题中提取真实儿童提问 30+ 条。

3. **课标对照**：对照 NGSS K-2 学科核心概念（DCI）与国内小学低段科学课标，
   标注每个问题覆盖的概念，确保 100 题整体覆盖面均衡。

4. **去重、评分与筛选**：每题按以下维度 1–5 打分，加权排序取前 100：
   - frequency：多来源命中次数（权重 3）
   - wonder_value：认知冲突强度，"明明…为什么却…"（权重 3）
   - explainability：能否用 5–8 岁语言无损简化（权重 2）
   - daily_life：北美华人家庭日常场景相关度（权重 2）
   - bilingual_bonus：是否具有双语/双文化独特视角（权重 1，
     但确保"语言文化"类不少于 10 题）

## 输出格式：question-bank.yaml

- rank: 1
  question_zh: "..."
  question_en: "..."
  category: animals | body | nature | space | food | machines | feelings | language_culture
  age_band: "5-6" | "6-8" | "5-8"
  sensitivity: none | low | high
  score_breakdown: { frequency: 5, wonder_value: 4, ... }
  suggested_sources: ["候选来源 URL 或类型建议"]
  misconception: "孩子对此最常见的错误认识（用于 Predict 选项设计）"

## 分布约束
- 8 大类别每类 ≥ 8 题；language_culture ≥ 10 题
- sensitivity: high 的题目 ≤ 10 题
- 每题的 misconception 字段不允许留空——没有已知迷思的题目优先级降级
```

---

## 7. TTS 处理规范（`tts.ts` 约束，写给 Claude Code）

1. **分段生成**：每个 segment 单独生成一个音频片段，`publish.ts` 拼接成整集并记录每个 segment 的起止时间戳——**暂停点时间戳由拼接过程精确计算，不靠人工标注**。
2. Azure 音色配置：
   - 中文/双语桥：`zh-CN-XiaoxiaoMultilingualNeural`（同音色可读英文词，双语桥无缝）
   - 英文版：同系列多语言音色或 `en-US-Ava` 系，样片阶段 A/B 两个候选让测试家庭盲选
3. SSML 规则：故事语速 `rate="-8%"`（儿童听力节奏）；问题句后加 `<break time="600ms"/>`；专有名词用 `<phoneme>` 兜底
4. `bilingual_bridge` 的 pinyin 字段仅用于家长端问题卡显示，不进 TTS
5. 输出 mp3 64kbps mono（口播足够，单集 ~2.5MB）
6. 缓存：对 `(text, voice, ssml_config)` 做 hash，改稿只重新生成变动的 segment

---

## 8. 样片执行指令（本文档验收方式）

给 Claude Code 的第一个任务卡：

```
任务：跑通内容管线，产出 2 集完整样片

1. 建立 content/ 目录结构（第 0 节）
2. 按第 2 节格式为以下两题建立 topics.yaml 条目并检索绑定来源：
   - animals-bird-powerline（为什么小鸟站电线上不触电）→ 常规题，测常规质量
   - language-two-languages（为什么我们家说两种话）→ 差异化题，测独有价值
3. 实现 scripts/generate.ts：读 topics.yaml → 调 Prompt A → 输出 drafts/
4. 实现 scripts/review.ts：调 Prompt B → Router 分流 → 输出 reviews/
5. 实现最简 review-ui（可以先是终端交互式 CLI，不必是网页）
6. 实现 scripts/tts.ts（Azure，按第 7 节规范）
7. 交付：2 集的 final.json + 每集 en/zh 两版 mp3 + Reviewer 报告

验收标准：
- [ ] 人工终审两集耗时合计 ≤ 15 分钟
- [ ] fact_claims 每条可点开来源验证
- [ ] 音频给 2-3 个真实家庭试听，孩子愿意听完且能回答 Predict 问题
- [ ] 双语题的中文版没有翻译腔（找一位家长盲评）
```

**这一步的家庭试听结果，是整个项目最早、最便宜的生死信号。** 如果孩子听不完 5 分钟样片，问题出在内容配方上，改 prompt 比改代码便宜一百倍。

