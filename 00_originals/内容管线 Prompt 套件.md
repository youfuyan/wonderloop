User: 请从一个专业的独立开发者的角度，分析这个创意，制定一个可以让codex或者claudecode运行的project计划，最终成品需要可以有网页版和ios版，提供free trail和付费。在这之前先从plan角度出发，生成一个完整计划和需要我确认的问题
User: fileNode wonder_loop_idea.md
Model: # WonderLoop（好奇循环）— 独立开发者视角的项目计划

以下我会分四部分：①独立开发者视角的创意分析与关键取舍；②产品与技术方案；③可交给 Codex / Claude Code 执行的分阶段项目计划；④**在动手前必须由你确认的问题清单**。

---

## 一、独立开发者视角的冷静分析

原文档的商业分析很完整，但从"一个人 + AI coding agent"的执行角度，有几个必须先想清楚的现实约束：

### 1.1 这个项目对独立开发者的真实难度

| 维度 | 难度 | 说明 |
|---|---|---|
| 技术实现 | ★★☆☆☆ | 音频播放 + 问答 + 订阅，都是成熟模式，AI agent 完全能写 |
| 内容生产 | ★★★★☆ | 每日一集、需要人工审核的儿童内容，是**持续运营成本**，不是一次性开发 |
| 合规（COPPA / Apple Kids） | ★★★★☆ | 面向 13 岁以下儿童是 App Store 审核的高危区，独立开发者最容易死在这里 |
| 冷启动获客 | ★★★★☆ | 与代码无关，但决定项目生死 |

**核心结论：这个项目最大的风险不在代码，在于内容管线和合规。** 所以计划里我会把"内容管线"当成和产品同等重要的工程模块来设计，并给出一个绕开 Apple Kids Category 最严审核的产品定位选项（见待确认问题 Q2）。

### 1.2 一个关键的定位建议（会显著影响架构）

原方案是"孩子使用、家长购买"。但从合规和审核角度，我强烈建议第一版定位为：

> **"给家长用的亲子工具"**——账户、操作、订阅全部由家长完成，孩子只是"和家长一起听"。产品不收集任何儿童数据，不上架 Apple Kids Category。

这样做的好处：
- 避开 COPPA 中"直接向儿童收集信息"的最重的合规义务（仍需注意，但风险面大幅缩小）
- 不进 Kids Category，App Store 审核难度接近普通订阅类 App
- 不做语音识别、不存孩子录音——"Teach it back"环节由家长口头引导，App 只记录家长点选的完成状态

这与原文档第八节的精神一致，只是我把它变成明确的产品定位，而不只是隐私措施。

### 1.3 范围裁剪：第一版砍掉什么

原文档的 MVP 已经克制，我再砍一刀，适配单人开发节奏：

**做**：每日一集音频（预生成、人工审核）、播放中的暂停提问点、选择题/开放题（家长代答或点选）、昨日 20 秒回顾、好奇心日历、每周家长摘要邮件、免费试用 + 订阅。

**第一版不做**：孩子语音输入、实时 AI 对话、个性化难度调节、双语切换（可作为 Phase 2）、原生 Android、任何社交功能。

---

## 二、产品与技术方案

### 2.1 技术栈（为 AI coding agent 优化选择）

选型原则：**主流、文档丰富、类型安全、单一语言栈**——这些是 Codex/Claude Code 产出质量最高的组合。

| 层 | 选择 | 理由 |
|---|---|---|
| Web 前端 | **Next.js 14+ (App Router) + TypeScript + Tailwind** | AI agent 最熟悉的栈，PWA 支持好，可先当移动网页用 |
| iOS | **Expo (React Native) + TypeScript** | 与 Web 共享 80% 业务逻辑（monorepo 共享包），单人维护双端唯一现实的方案 |
| 后端/数据库 | **Supabase**（Postgres + Auth + Storage + RLS） | 免运维、行级安全策略适合家庭数据隔离、免费额度够验证期 |
| 支付（Web） | **Stripe**（Checkout + Customer Portal，含 free trial） | 标准方案 |
| 支付（iOS） | **RevenueCat**（封装 StoreKit 2） | 统一 Web/iOS 订阅状态，省去自己写 receipt 验证 |
| 音频托管 | Supabase Storage 或 Cloudflare R2 + CDN | 音频文件小（5MB/集），成本可忽略 |
| TTS 内容生产 | ElevenLabs 或 OpenAI TTS（离线批量生成，**人工审核后发布**） | 不做运行时 AI 调用，成本可控、内容可控 |
| 邮件 | Resend | 每周家长摘要 |
| 分析 | PostHog（自托管或云） | 事件级漏斗分析，追踪"完整好奇心循环" |
| 部署 | Vercel（Web）+ EAS（iOS build） | 零运维 |

**Monorepo 结构**（Turborepo 或 pnpm workspace）：

```
wonderloop/
├── apps/
│   ├── web/          # Next.js
│   └── mobile/       # Expo
├── packages/
│   ├── core/         # 共享业务逻辑：episode 状态机、循环追踪、类型
│   ├── api-client/   # Supabase 封装 + 订阅状态
│   └── ui/           # 可选：跨端共享的设计 token
├── content/          # 内容管线（见 2.3）
└── supabase/         # migrations、RLS policies、edge functions
```

### 2.2 数据模型（核心表）

```
families          家长账户（family = 订阅主体）
child_profiles    孩子档案（只存昵称/年龄段，无真实姓名生日）
episodes          每集：标题、主题、音频URL、暂停点、问题JSON、状态(draft/reviewed/published)
episode_questions 预测题 / 思考题 / 回顾题，含选项与引导话术
daily_sessions    某家庭某天的收听记录：完成状态、答题记录、是否完成"教回来"
child_questions   孩子提出的新问题（家长手动输入，可选）
subscriptions     Stripe/RevenueCat 同步的订阅状态
weekly_digests    每周摘要生成记录
```

北极星指标"每周完整好奇心循环数"直接由 `daily_sessions` 的字段组合计算：`listened && answered && explained && asked_new_question`。

### 2.3 内容管线（当作正式工程模块）

这是独立开发者版的"编辑部"，半自动化：

```
content/
├── topics.yaml           # 选题库（人维护）
├── scripts/
│   ├── generate.ts       # LLM 生成脚本草稿（故事+6个环节的问题）
│   ├── review-ui/        # 一个本地审核界面：改稿、标暂停点、批准
│   ├── tts.ts            # 批量生成音频
│   └── publish.ts        # 上传音频 + 写入 episodes 表，状态置 published
```

工作流：**AI 生成草稿 → 你人工审核修改（事实核查、适龄性）→ 一键 TTS → 一键发布**。目标是每集人工时间压到 15–20 分钟，一次批量做 2 周的内容。

### 2.4 免费试用与订阅设计

| 层级 | 内容 |
|---|---|
| 免费 | 最近 7 天中的 2 集完整体验 + 全部集数的"仅故事版" |
| 试用 | 订阅前 7 天免费试用（Stripe trial / App Store intro offer） |
| 付费 | 每日完整互动内容、全部内容库、好奇心日历、每周家长报告，$7.99/月 或 $59/年（可实验） |

跨端订阅状态统一走 RevenueCat（它支持 Stripe 作为数据源），避免"Web 买了 iOS 不认"的经典坑。

---

## 三、分阶段执行计划（可直接交给 Codex / Claude Code）

每个 Phase 都是可独立验收的里程碑，任务粒度按"一次 agent session 能完成"来拆。

### Phase 0 — 人工验证（1–2 周，几乎不写代码）

> 目的：验证需求，同时产出第一批真实内容素材。

- [ ] 用内容管线的最简版（一个脚本 + 手动 TTS）制作 5 集样片
- [ ] 一个静态落地页（Next.js 单页 + 邮箱收集）——这是给 agent 的第一个任务，1 天
- [ ] 通过私人播客 RSS / 微信群发给 15–20 个家庭，人工收集反馈
- **Gate：至少 50% 家庭坚持一周、有孩子主动追问的实例 → 才进 Phase 1**

### Phase 1 — Web MVP（3–4 周）

**Epic 1.1 项目基建（agent 任务，2–3 天）**
- Monorepo 初始化、Supabase 项目、schema migration、RLS 策略、CI（lint + typecheck + test）

**Epic 1.2 认证与家庭账户（2 天）**
- 家长邮箱注册/登录（Supabase Auth）、孩子档案（昵称 + 年龄段）、家长门禁（parental gate 模式，为 iOS 铺路）

**Epic 1.3 核心播放体验（1 周）**
- 今日一集页面
- 自定义音频播放器：按 episode 定义的时间戳**自动暂停**，弹出问题卡
- 六环节状态机（Hook → Predict → Story → Think → Teach back → New question），进度持久化
- 昨日 20 秒回顾（新一集开始前插入）

**Epic 1.4 记录与回顾（3 天）**
- 好奇心日历（完成打卡视图）
- 孩子问题收藏夹（家长手动输入）
- 每周摘要邮件（Supabase Edge Function 定时 + Resend）

**Epic 1.5 内容管线正式版（4 天）**
- generate → review UI → tts → publish 完整流程
- 灌入 30 集内容储备

**Epic 1.6 埋点（2 天）**
- PostHog 事件：每个环节的完成事件、循环完成事件、D1/D7 留存漏斗

- **Gate：100+ 家庭、周留存 ≥ 40%、每活跃家庭每周 ≥ 3 个完整循环 → 进 Phase 2**

### Phase 2 — 变现（2 周）

- [ ] Stripe Checkout + 7 天试用 + Customer Portal
- [ ] 订阅状态中间件（免费/试用/付费的内容门控）
- [ ] 免费层内容策略实现（2 集完整 + 故事版）
- [ ] 付费转化漏斗埋点
- **Gate：试用→付费转化 ≥ 15–20%，或 20+ 付费家庭 → 进 Phase 3**

### Phase 3 — iOS（3–4 周）

- [ ] Expo app 骨架，复用 `packages/core` 与 `api-client`
- [ ] 原生体验重点：后台音频播放、锁屏控制、离线下载（expo-av / expo-audio + 文件缓存）
- [ ] RevenueCat 接入 StoreKit，与 Stripe 订阅状态合并
- [ ] Parental gate（购买、外链前的家长验证）
- [ ] App Store 准备：隐私营养标签、审核用的演示账号、内容分级说明
- [ ] TestFlight 内测 2 周 → 提交审核

### Phase 4 — 迭代方向（验证后再排期）

双语模式、8–12 岁独立模式、基于孩子问题的个性化选题、学校/图书馆版本。

### 交给 AI agent 的工程规范（写进 CLAUDE.md / AGENTS.md）

```
- TypeScript strict 模式，禁止 any
- 所有数据访问经过 RLS，前端永不信任
- 核心状态机（好奇心循环）必须有单元测试
- 儿童相关数据字段：只允许 nickname、age_band，schema review 强制检查
- 每个 PR 附带 migration 的回滚脚本
- 埋点事件命名遵循 events.md 中的字典
```

---

## 四、需要你确认的问题（开工前必答）

### 定位与合规（最影响架构，优先回答）

1. **产品定位**：接受我建议的"家长账户 + 亲子共用、不进 Apple Kids Category"的定位吗？还是坚持做面向儿童的独立使用产品（那样 Phase 3 的合规工作量至少 ×2）？
2. **儿童数据**：第一版是否同意**完全不收集**孩子的语音和自由文本输入（孩子的新问题由家长手动记录）？
3. **目标市场**：首发英文北美市场、中文市场，还是直接按原文档第十节做**北美华人双语切入**？这决定内容管线是单语还是双语、以及 TTS 选型。

### 商业模式

4. **价格假设**：$7.99/月、$59/年、7 天免费试用——用这个起步做实验可以吗？
5. **免费层**：接受"2 集完整互动 + 其余仅故事版"的免费策略吗？还是更激进/保守？
6. Web 和 iOS 都上订阅（iOS 抽成 15–30%），还是引导用户去 Web 订阅、iOS 只做已订阅用户的登录（合规上可行但转化差）？

### 内容与运营

7. **你能投入的内容审核时间**：每周能拿出 2–3 小时做内容审核吗？如果不能，需要把节奏从"每日一集"降为"每周 3 集"，这会改变产品叙事。
8. **声音方案**：接受纯 TTS 音频起步吗？还是你/家人愿意真人录制（更温暖但产能低）？
9. 首批 30 集选题是否由你提供方向（如偏科学/自然/生活），还是我让 agent 从孩子高频"为什么"数据生成候选清单供你筛选？

### 技术与资源

10. **iOS 方案确认**：接受 Expo/React Native（一套代码、体验 90 分）吗？还是要求 SwiftUI 原生（体验 100 分，但你要维护两套代码）？
11. 你已有的账号/预算情况：Apple Developer 账号（$99/年）、Supabase/Vercel 付费预算、TTS 预算（约 $30–80/月）是否 OK？
12. **Phase 0 是否可以跳过**：如果你已有测试家庭渠道（如身边的家长群），是否愿意先花 2 周做人工验证，还是想直接从 Web MVP 开始（我不推荐，但尊重你的时间约束）？

### 验收标准

13. 你认可"每活跃家庭每周完整好奇心循环数"作为北极星指标吗？各 Phase 的 Gate 数值（留存 40%、转化 15%）是否需要按你的风险偏好调整？

---

回答完以上问题（尤其 Q1–Q3、Q7、Q10）后，我可以立即产出：**Phase 1 的详细任务分解文档（含数据库 schema、API 设计、每个任务的验收标准）**，格式直接适配 Claude Code 的执行方式（每个任务一个可独立验证的 PR）。
User: 1. 接受家长账户 + 亲子共用， 以后可以拓展到16+  2. 完全不收集  3. 北美华人双语切入  4. 可以  5. 可以  6. 都订阅  7.思考一个方案，用fable5或者好的模型来压缩内容审核  8. 接受，思考一下哪种tts方案最适合  9. 收集100个孩子高频数据清单  10. 一套代码  11. 没有账号，预算控制在500以内
User: 12. 跳过，直接做mvp
User: 13. 思考一下这个指标是否合适，有没有更好的指标
Model: # WonderLoop — 最终执行计划 v1.0

基于你的 13 个回答，所有关键决策已锁定。下面先解决你要求"思考"的三个问题（Q7 内容审核压缩、Q8 TTS 选型、Q13 指标），然后给出更新后的完整计划和预算。

---

## 一、决策确认表（已锁定）

| # | 决策 | 对架构的影响 |
|---|---|---|
| 定位 | 家长账户 + 亲子共用，预留 16+ 扩展 | 不进 Kids Category；`child_profiles` 用 age_band 设计，未来加 "teen/adult" 模式只是内容分层 |
| 数据 | 零儿童数据收集 | 无语音输入、无孩子自由文本；孩子的新问题由家长手动录入，归属于家长账户 |
| 市场 | 北美华人双语 | 内容模型必须原生支持多语言变体（见下文 2.2） |
| 价格 | $7.99/月、$59/年、7 天试用 | Web + iOS 双端订阅，iOS 申请 App Store Small Business Program（抽成降至 15%） |
| iOS | Expo 一套代码 | Monorepo 共享 core |
| 验证 | 跳过人工验证，直接 MVP | **并行补救**：MVP 开发期间同步上落地页招募种子家庭（见 Phase 1） |

---

## 二、Q7：用强模型压缩内容审核 —— "AI 编辑部"方案

目标：把每集人工审核时间从 20 分钟压到 **5 分钟以内**，且人始终是发布前的最后一道闸门（儿童内容不可全自动发布）。

### 2.1 四层管线设计

```
Layer 1  生成（Generator）
  └ 强模型（GPT-5 / Claude Opus 级别）+ 严格模板
    输入：选题 + 2-3 条可信事实来源（人工/半自动预先绑定）
    输出：结构化 JSON —— 六环节脚本（Hook/Predict/Story/Think/TeachBack/NewQ）
          + 中英双版本 + 事实断言清单（每条断言标注来源）

Layer 2  对抗审核（Adversarial Reviewer）
  └ 第二个独立模型调用，扮演"挑剔的儿童编辑"，输出结构化评分：
    ① 事实核查：逐条比对断言与来源，标记无来源支撑的句子
    ② 适龄性：词汇难度、句长、概念抽象度（按 age_band 评分）
    ③ 安全扫描：恐惧/暴力/敏感话题/文化偏见检测
    ④ 教学质量：问题是否真正促进思考（vs 记忆型问题）
    ⑤ 双语一致性：中英版本的知识点是否等价

Layer 3  自动分流（Router）
  └ 综合评分 ≥ 阈值 → 进入"快速通道"（人工 spot-check 3 分钟）
    任一维度不达标 → 进入"完整审核"（人工逐项处理，~15 分钟）
    触发敏感词 → 强制完整审核 + 可能直接弃题

Layer 4  人工终审（Review UI）
  └ 本地审核界面，按 checklist 呈现：
    - Layer 2 的评分报告和标红句子（你只看标红处，不通读全文）
    - 一键改写按钮（选中句子 → AI 按你的批注重写）
    - 批准 → 自动进入 TTS → 试听 → 发布
```

### 2.2 关键设计点

- **事实来源前置**：选题库（`topics.yaml`）中每个选题必须预先绑定来源链接（维基/教科书/科普机构），生成时注入 prompt。这样 Layer 2 的核查是"比对"而不是"模型凭记忆判断"，可靠性质变。
- **双语不是翻译**：中文版和英文版由同一份"知识大纲"分别生成（翻译腔会毁掉儿童音频），Layer 2 只校验知识点等价性。
- **批量节奏**：每 2 周一次批量生产 14 集，预计人工总时间 = 14 × 5 分钟 + 2-3 集完整审核 ≈ **2 小时/两周**，符合你的时间预算。
- 管线做成模型无关（配置文件切换 provider），前沿模型迭代时直接换。

---

## 三、Q8：TTS 选型分析

双语儿童音频的核心要求：中文自然度、句内中英混说（code-switching）、温暖的语气、成本。

| 方案 | 中文质量 | 混语能力 | 温暖度 | 成本估算（30集/月×双语） | 结论 |
|---|---|---|---|---|---|
| **Azure Speech**（多语言神经音色，如 Xiaoxiao Multilingual） | ★★★★★ | ★★★★☆ 单音色可中英混说 | ★★★★☆ 有儿童向/讲故事风格参数 | **免费层 50 万字符/月基本覆盖**，超出约 $16/百万字符 | ✅ **MVP 首选** |
| OpenAI TTS (gpt-4o-mini-tts) | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ~$5/月 | 备用/降级方案 |
| ElevenLabs Multilingual | ★★★★☆ | ★★★★★ | ★★★★★ 最有"人味" | 需 ~300 分钟/月 → Pro 档 $99/月 | ❌ 超预算；付费验证后升级用 |
| MiniMax Speech | ★★★★★ | ★★★★☆ | ★★★★☆ | 很低 | 中文极强，但国际计费/合规链路对北美产品略麻烦，作为候补 |

**结论**：MVP 用 **Azure Speech**（免费额度内几乎零成本，中英同音色混说，SSML 可精细控制语速停顿——对"暂停提问点"的音频节奏控制很重要）。管线抽象成 `TTSProvider` 接口，付费验证后（Phase 4）可对头部内容升级 ElevenLabs 真声级音色，甚至混合方案：主叙述 ElevenLabs、日更内容 Azure。

---

## 四、Q13：北极星指标再思考

你原方案："每活跃家庭每周完整好奇心循环数"（平均值）。**它有三个缺陷**：

1. **平均值陷阱**：5 个狂热家庭能掩盖 50 个流失家庭；
2. **比率指标的反直觉**：轻度用户流失反而会让指标"变好"；
3. **不含增长维度**：这个数字很高但只有 10 个家庭，业务依然是死的。

### 建议改为：**每周习惯家庭数（Weekly Habit Families, WHF）**

> **WHF = 本周完成 ≥ 3 次完整好奇心循环的家庭数量**

为什么更好：
- 它是**绝对数**，同时被"获客"和"留存"驱动，团队所有工作都指向它；
- "≥3 次/周"是习惯形成的门槛，直接预测续费（这个阈值本身要在数据积累后校准，可能是 3 也可能是 4）；
- 计算简单，`daily_sessions` 一条 SQL 出结果。

### 配套指标体系（仪表盘四层）

| 层 | 指标 | 回答的问题 |
|---|---|---|
| 北极星 | WHF | 业务健康度 |
| 质量 | 循环完成率（开始播放→完成 TeachBack 的比例） | 单集体验好不好 |
| 领先 | 首周完成 ≥4 循环的新家庭比例 | 新用户会不会养成习惯（预测 WHF 走势） |
| 商业 | 试用→付费转化率、W4 留存 | 值不值得投入获客 |

另外保留一个**定性信号**：家长在周报邮件里点"孩子今天主动要求听"的次数——这是无法被数据造假的真实需求信号，且不涉及儿童数据（家长自己点的）。

---

## 五、Q9：100 个高频"为什么"清单 —— 方法与样例

### 生成方法（Phase 1 内容 Epic 的第一个任务）
数据来源交叉验证：But Why / Brains On 历史选题（已验证有儿童需求）+ Reddit r/Parenting、小红书亲子帖中的"孩子问倒我"话题 + NGSS K-2 / 国内科学课标概念图 + 强模型模拟 5-8 岁提问分布。产出带元数据的清单：`类别 / 年龄段 / 敏感度 / 双语亮点 / 事实来源`。

### 8 大类别与样例（正式清单开工后交付）

| 类别 | 样例 |
|---|---|
| 动物 | 为什么鸟站电线上不触电？猫为什么能在黑暗中看见？ |
| 身体 | 为什么会打喷嚏？伤口为什么会结痂？ |
| 自然 | 为什么天是蓝的？彩虹从哪里来？ |
| 太空 | 月亮为什么跟着我走？白天星星去哪了？ |
| 食物 | 爆米花为什么会爆？冰淇淋为什么会化？ |
| 机器 | 飞机那么重为什么能飞？电梯怎么知道去几楼？ |
| 情感社会 | 为什么会做梦？为什么有时候会害怕？ |
| 语言文化 ⭐ | 为什么我们家说两种话？汉字和字母有什么不一样？ |

⭐ 第 8 类是双语定位的**独有差异化内容**——泛英语竞品做不了。

---

## 六、预算分解（目标 ≤ $500，覆盖前 4 个月）

| 项目 | 费用 | 说明 |
|---|---|---|
| Apple Developer | $99/年 | Phase 3 前再买即可，先省着 |
| 域名 | ~$15/年 | |
| Supabase | $0 → $25/月 | 免费层撑过前 2 月，用户增长后升 Pro（按 2 个月算 $50） |
| Web 托管 | $0 | ⚠️ Vercel 免费层禁商用，**改用 Cloudflare Pages（免费且允许商用）** |
| TTS (Azure) | ~$0–10/月 | 免费额度基本覆盖 |
| LLM API（内容生成+审核） | ~$15–25/月 | 每集含审核 ~$0.5–1 |
| RevenueCat | $0 | 月收入 $2.5k 内免费 |
| Resend / PostHog / Stripe | $0 | 免费层 / 按交易抽成 |
| **4 个月合计** | **~$280–340** | ✅ 留有 $150+ 缓冲 |

---

## 七、更新后的执行计划

### Phase 1 — 双语 Web MVP（4–5 周）

> 因跳过人工验证，**第 1 周同步上线落地页**（中英双语，投小红书/微信家长群/本地中文学校群），MVP 完成时手上要有 30–50 个候补家庭。

| Epic | 内容 | 工期 |
|---|---|---|
| 1.1 基建 | Monorepo、Supabase schema + RLS、CI、Cloudflare Pages 部署 | 3 天 |
| 1.2 落地页 + 候补名单 | 双语单页 + 邮箱收集（**最先交付，立即开始获客**） | 1 天 |
| 1.3 账户 | 家长注册登录、孩子档案（昵称+年龄段，仅此两项）、语言偏好（English/中文/Bilingual） | 2 天 |
| 1.4 核心播放 | 自定义播放器 + 时间戳自动暂停 + 六环节状态机 + 昨日回顾；音频按语言模式加载对应变体 | 7 天 |
| 1.5 记录 | 好奇心日历、孩子问题收藏（家长录入）、每周摘要邮件 | 3 天 |
| 1.6 内容管线 | 第二节的四层管线 + 审核 UI + Azure TTS 集成；产出 100 题清单 + 首批 20 集双语内容 | 5 天 |
| 1.7 埋点 | PostHog 事件字典、WHF 仪表盘 | 2 天 |

**Gate**：50+ 激活家庭、循环完成率 ≥ 60%、周留存 ≥ 40%

### Phase 2 — 变现（2 周）
Stripe Checkout + 7 天试用 + 内容门控（免费 = 每周 2 集完整互动 + 其余仅故事版）+ 转化漏斗。
**Gate**：试用→付费 ≥ 15% 或 20 个付费家庭。

### Phase 3 — iOS（3–4 周）
Expo 复用 core、后台播放/锁屏控制/离线下载、RevenueCat + StoreKit（申请 Small Business Program）、parental gate、隐私营养标签（"不收集儿童数据"是审核加分项）、TestFlight 2 周 → 提审。此时才购买 Apple Developer 账号。

### Phase 4 — 验证后迭代
头部内容升级 ElevenLabs 音色 → 基于孩子问题的个性化选题 → 8–12 岁模式 → 16+ 成人每日模式。

---

## 八、下一步

所有决策已闭环，我可以立即产出以下三份可直接投喂 Claude Code / Codex 的文档，**建议按此顺序**：

1. **`CLAUDE.md` + 数据库 Schema + RLS 策略**（含双语内容模型的完整表设计）— 项目的宪法
2. **Phase 1 任务分解文档** — 每个任务一个独立 PR，含验收标准和测试要求
3. **内容管线 Prompt 套件** — Generator 模板、Adversarial Reviewer 评分 rubric、100 题清单生成任务

要我从第 1 份开始生成吗？或者如果你想先看内容质量（这是本项目真正的命门），也可以反过来：先出第 3 份，用管线跑出 2 集样片给你审，确认内容水准达标后再动工程。**我个人建议后者**——代码不会失败，内容才会。
User: 一份一份输出
Model: # 文档 1/3：内容管线 Prompt 套件 v1.0

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

