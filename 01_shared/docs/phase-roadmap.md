# 文档 3/3：Phase 1 任务分解（每任务一个 PR）+ Phase 2/3 任务卡

> 使用方式：每张任务卡直接粘贴给 Claude Code / Codex 作为一次 session 的输入。
> 卡片编号即分支名前缀（如 `feat/p1-04-audio-player`）。
> **依赖关系已排好序**，标注 ⚡ 的任务可与前序并行。
> 所有任务默认继承 CLAUDE.md 五条铁律与 AGENTS.md 的 DoD（typecheck/lint/test/build 全绿），卡内只写增量验收标准。

---

## Phase 1 总览（4–5 周，18 张任务卡）

```
Week 1   P1-01 基建 → P1-02 落地页（当天上线开始获客）→ P1-03 认证与家庭
Week 2   P1-04 播放器 → P1-05 循环状态机 → P1-06 会话持久化
Week 3   P1-07 昨日回顾 → P1-08 今日页 → P1-09 日历 → P1-10 问题收藏
Week 3-4 P1-11~14 内容管线四连（可与 Week 2-3 并行，如果你手动跑管线）
Week 4   P1-15 周报邮件 → P1-16 埋点 → P1-17 免费策略脚本 → P1-18 上线检查
```

---

### P1-01 · Monorepo 基建 + Migration + RLS 测试

即文档 2 末尾的验收任务卡，此处不重复。**这是一切的地基，必须最先完成。**

---

### P1-02 · 双语落地页 + 候补名单 ⚡（P1-01 完成后立即做，当天上线）

```
任务：apps/web 中实现落地页，部署到 Cloudflare Pages

页面结构（单页，默认双语并排展示，右上角 EN/中 切换）：
1. Hero：一句话价值主张
   zh: "每天 5 分钟，陪孩子完成一次好奇心循环"
   en: "5 minutes a day. One question. One curious kid."
2. 循环示意：猜一猜 → 听故事 → 想一想 → 讲给爸妈听 → 提出新问题 → 明天回顾
3. 内嵌样片播放器：播放文档 1 产出的 2 集样片（<audio> 原生标签即可，
   此页不需要暂停点逻辑）
4. 差异化三点：双语原生内容 / 零儿童数据收集 / 无广告无算法喂养
5. 候补表单：email + 语言偏好(en/zh/bilingual) + 来源下拉
   (xiaohongshu/wechat/school/friend/other)
   → insert public.waitlist（anon 权限，已有 RLS policy）
6. Footer：隐私承诺一句话 + 联系邮箱

技术要求：
- 纯静态 RSC，无客户端 JS 除表单提交与语言切换
- Lighthouse mobile performance ≥ 90（家长大多手机打开）
- OG 图与 meta 双语（微信/小红书分享卡片正常显示）

验收：
- [ ] 提交 email 后 waitlist 表有记录，重复 email 报友好提示
- [ ] 手机端微信内置浏览器打开正常（实测）
- [ ] 部署到生产域名，HTTPS 正常
```

> **上线后你的运营动作（非 agent 任务）**：发到 2–3 个华人家长群 + 小红书发首帖。MVP 完成前目标 30–50 个 email。

---

### P1-03 · 认证 + 家庭账户 + 孩子档案

```
任务：Supabase Auth 接入 + onboarding 流程

路由：
/login          email magic link（首选，免密码）+ Google OAuth
/onboarding     首次登录后强制走完：
                Step1 语言偏好（en/zh/bilingual，写 families.language_pref）
                Step2 添加孩子：nickname + age_band（可加 1-4 个，可跳过）
                Step3 时区自动检测（写 families.timezone，可改）
/settings       修改语言偏好/时区/孩子档案；"删除账户与全部数据"按钮
                （调 RPC delete_family_cascade，本卡实现该 migration）

要求：
- middleware 保护 /today /calendar /questions /settings，未登录跳 /login
- families 行由 auth trigger 自动创建（0001 已有），onboarding 只做 update
- 孩子档案表单只有 nickname + age_band 两个字段——不许"顺手"加生日选择器
- 删除账户：新 migration 0002，security definer RPC，级联删 families
  （外键已 cascade），并调用 auth.admin 删除 user（Edge Function 实现）
- i18n：所有文案走 packages/core/i18n 的 en/zh 字典

验收：
- [ ] 新用户 magic link 登录 → onboarding → /today 全流程通
- [ ] 删除账户后：auth.users、families 及所有子表数据消失（写测试验证）
- [ ] child_profiles 第 5 个孩子插入被 RLS 拒绝
```

---

### P1-04 · 分段音频播放器（核心组件之一）

```
任务：packages/core 播放器逻辑 + apps/web 播放器组件

背景：episodes.audio JSONB 结构为
  { en: { path, duration_sec, segments: [{type, start, end}] }, zh: {...} }
音频是整集单文件，segments 记录各环节的起止秒数（由 content 管线拼接时生成）。

packages/core/src/player.ts（纯函数，vitest 覆盖）：
- derivePlayerPlan(episode, languageMode): PlayerPlan
  → bilingual 模式选主语言音频（families.language_pref 为 bilingual 时
    默认 zh 主音频，可在集内切换）
- shouldPauseAt(plan, currentTime): SegmentBoundary | null
  → 命中 pause_after=true 的 segment 结束点（±0.3s 容差）返回边界

apps/web 组件 <EpisodePlayer>：
- HTML5 Audio + 自定义 UI：播放/暂停、进度条（按 segment 分色显示）、
  ±10 秒、语速 0.8x/1x
- timeupdate 中调 shouldPauseAt，命中即 pause() 并触发 onSegmentBoundary
  回调（问题卡由 P1-05 接管）
- 恢复播放从下一 segment 的 start 开始（防止重复触发）
- 音频 URL：调 /api/audio-url Route Handler（本卡实现），Handler 内
  先调 get_full_episode 校验 access，再用 service role 签 2 小时 URL

验收：
- [ ] player.ts 单测覆盖：边界命中/容差/恢复不重触发/双语选轨，≥ 12 用例
- [ ] 真机 Safari iOS 测试：锁屏后恢复、切后台回来进度正确
- [ ] story_only access 时，进度条只显示 hook+story 区间，播完自然结束
- [ ] /api/audio-url 对无权 episode 返回 403
```

---

### P1-05 · 好奇心循环状态机 + 问题卡 UI

```
任务：六环节状态机（纯函数）+ 各环节交互卡片

packages/core/src/loop.ts 扩展（0001 已有 loop_complete 对照测试）：
状态机 LoopState：
  idle → hook_playing → predict_paused → story_playing → think_paused
  → teach_back_paused → new_question_paused → completed
- advance(state, event): LoopState   事件：SEGMENT_END / ANSWER_SUBMITTED /
  SKIP / RESUME
- 每个 paused 状态允许 SKIP（家长可跳过任何环节，跳过 ≠ 完成）
- deriveSessionUpdate(state, event): Partial<DailySession>
  → 产出 listened/predict_choice/answered_think/taught_back/
    asked_new_question 的增量更新

apps/web 问题卡组件（音频暂停时覆盖在播放器上方）：
1. PredictCard：三选项大按钮（双语显示），选择后显示
   no_wrong_answer_note，不判对错 → 继续播放
2. ThinkCard：显示问题 + "给家长的参考答案"折叠区（answer_guidance）
   + [孩子回答了] [跳过] 两个按钮（不输入孩子原文——铁律 1）
3. TeachBackCard：显示 prompt + 30 秒可选倒计时动画 + [讲完了] [跳过]
4. NewQuestionCard：prompt + 可选文本框"家长帮孩子记下这个问题"
   （写 child_questions，明确标注"由家长输入"）+ [没有新问题] 按钮
5. CompletionCard：循环完成庆祝（克制：一句肯定 + 今日打卡标记，
   无积分无动画轰炸）
6. bilingual 模式：所有卡片中英双行显示；集尾追加 BilingualBridgeCard
   展示 3 个核心词（汉字+pinyin+英文）

验收：
- [ ] loop.ts 状态转移表全覆盖测试（含 SKIP 分支），≥ 20 用例
- [ ] deriveSessionUpdate 与 SQL loop_complete 定义一致性测试通过
- [ ] 全部跳过交互环节 → loop_complete 为 false（听完 ≠ 完成循环）
- [ ] 刷新页面后状态机从持久化会话恢复到正确环节（依赖 P1-06，可先 mock）
```

---

### P1-06 · 会话持久化 + 断点续听

```
任务：daily_sessions 读写层 + 本地进度缓存

packages/api-client/src/sessions.ts：
- getOrCreateSession(episodeId, childProfileId?, languageMode)
  → upsert on (family_id, episode_id)
- updateSession(sessionId, partial)  ← 消费 deriveSessionUpdate 输出
- 防抖：同一字段 true 后不重复写；网络失败入重试队列（localStorage）

本地缓存（localStorage）：
- { episodeId, currentTime, loopState } 每 10 秒 + 每次暂停时写入
- 回到页面时若存在未完成会话 → "继续上次？从'想一想'环节开始"提示

验收：
- [ ] 中途关闭浏览器 → 重开 → 恢复到正确环节与音频位置（±5s）
- [ ] 飞行模式下答题 → 恢复网络 → 数据补写成功（重试队列测试）
- [ ] 同一集重复进入不产生重复行（unique 约束 + upsert 验证）
```

---

### P1-07 · 昨日回顾（Spaced Recall）

```
任务：新一集开始前插入 20-30 秒回顾环节

逻辑（packages/core/src/recall.ts）：
- 查询该家庭最近一次 loop_complete 的 session（≤3 天内），取其 episode 的
  recall_question
- 若存在 → 今日流程变为：RecallCard → hook_playing → ...
- RecallCard：显示问题（双语按模式）+ [记得！] [有点忘了] 按钮
  → 点"有点忘了"展示 answer_hint，两种点击都算 recall_answered=true，
    写回昨日 session
- 无可回顾内容（新用户/中断 >3 天）→ 直接进 hook

验收：
- [ ] 连续两天完成循环，第二天开头出现第一天的回顾问题
- [ ] 中断 4 天后回来不出现回顾（不制造"欠债感"）
- [ ] recall_answered 写回的是昨日 session 而非今日
```

---

### P1-08 · 今日页（/today，产品首页）

```
任务：登录后主页

布局（移动优先）：
1. 顶部：问候 + 孩子昵称选择（多孩家庭切换 child_profile，影响 session 归属）
2. 主卡：今日一集
   - episode_catalog 查 publish_date = 今天（按 families.timezone 计算"今天"）
   - 状态三态：未开始（大播放按钮 + 标题 + 时长）/ 进行中（"继续 · 想一想
     环节"）/ 已完成（✓ + "明天见"）
3. 副卡：本周进度条（周内 loop_complete 天数，7 格点亮式，不是 streak——
   有意避免"断签焦虑"设计）
4. 底部导航：今日 / 日历 / 问题本 / 设置

边界情况：
- 今天没有已发布集（内容断档）→ 显示最近一集 + 温和提示
- 免费用户 + 今日集非 free → 正常进入，播放器呈现 story_only +
  集尾 UpgradeHint（Phase 2 前先放"了解会员"占位链接）

验收：
- [ ] 时区正确性测试：America/New_York 家庭在 UTC 日期切换时看到正确的"今天"
- [ ] 三态渲染正确（用 seed 数据 + 测试账号验证）
- [ ] 多孩切换后 session 归属正确
```

---

### P1-09 · 好奇心日历（/calendar）⚡

```
任务：月视图打卡日历

- 月历网格：每天一格，状态：完整循环(实心)/部分完成(半格)/仅收听(浅色)/无
- 点击某天 → 底部抽屉：当天集标题 + 完成的环节清单 + 该天记录的孩子问题
- 顶部聚合：本月完整循环 N 次 · 记录了 M 个新问题
- 数据：一次查询当月 daily_sessions + child_questions，客户端组装
- 设计基调：这是"成长记录"不是"考勤表"——空白日无任何红色/警告样式

验收：
- [ ] 跨月切换流畅，无 N+1 查询（单次 RPC 或两条查询）
- [ ] 半完成状态渲染正确
```

---

### P1-10 · 问题本（/questions）⚡

```
任务：孩子提问收藏夹

- 时间倒序列表：问题文本 + 日期 + 关联集标题 + 孩子昵称标签
- 家长可编辑/删除（child_questions RLS 已允许）
- 手动新增入口（不必来自某一集——生活中随时记）
- 空状态文案："孩子的第一个'为什么'，值得被记住" + 引导说明
- 顶部统计：累计 N 个问题
- 导出按钮：生成纯文本（未来做成年度纪念册的种子功能，本期只做 txt 下载）

验收：
- [ ] CRUD 全通，删除有确认
- [ ] 300 字长问题显示不破版
```

---

### P1-11 · 内容管线：generate + review 正式版 ⚡（可全程并行）

```
任务：把文档 1 样片阶段的脚本升级为可批量运行的正式管线

- content/ 迁入 monorepo 作为 workspace package，Episode 类型 import 自
  packages/core 的 zod schema（单一契约）
- generate.ts：支持 --batch 模式（读 topics.yaml 中所有 status=ready 条目）；
  LLM provider 抽象（配置文件切换 anthropic/openai）；失败重试 + 断点续跑
- review.ts：Prompt B 调用 + Router 分流（文档 1 第 5 节规则）+
  输出汇总表（每集：分数/通道/critical_flags）
- 成本记录：每次运行输出 token 用量与美元估算，累计写 content/costs.json

验收：
- [ ] 一条命令跑完 5 个 topic 的 generate+review，产出结构化报告
- [ ] 任一集 zod 校验失败时明确报错定位字段，不产出脏数据
- [ ] critical_flags 非空的集自动标记 REJECT 且不进入后续环节
```

---

### P1-12 · 内容管线：审核 UI（Review Web UI）

```
任务：本地审核界面（Vite 单页，只在你本机跑，不部署）

- 列表页：待审集 + 通道标签（FAST_TRACK/FULL_REVIEW）+ 分数雷达
- 详情页：
  FAST_TRACK → summary_for_human + 随机 2 个 segment 全文 + [批准] [转完整审核]
  FULL_REVIEW → line_issues 逐条卡片：[接受建议修复] [手动改写] [忽略]
  + 改完 [重跑 Reviewer] 按钮
- 双栏对照：中/英版本并排（校对双语一致性）
- fact_claims 区：每条 claim + 来源链接（新标签打开）
- [批准] → 写 approved/{topic_id}.final.json + approved_by（从环境变量取
  你的名字）+ approved_at
- 计时器：记录每集实际审核耗时，写入 costs.json（验证"5 分钟目标"）

验收：
- [ ] 用首批 5 集实测：FAST_TRACK 集审核 ≤ 5 分钟
- [ ] 手动改写后重跑 Reviewer，新报告覆盖旧报告
- [ ] 未批准的集无法被 publish.ts 处理（校验 approved_by）
```

---

### P1-13 · 内容管线：TTS + 拼接 + 发布

```
任务：tts.ts（文档 1 第 7 节规范）+ publish.ts

tts.ts：
- 每 segment 独立生成（Azure SDK，SSML 规则见文档 1）→ ffmpeg 拼接单文件
  → 计算并输出 segments 时间戳数组
- (text, voice, ssml_config) hash 缓存，只重生成变动 segment
- 双音色配置：zh 版 XiaoxiaoMultilingual；en 版 A/B 两候选各生成一次
  （样片家庭盲选后固定）

publish.ts：
- 校验 final.json 有 approved_by/approved_at → 上传 mp3 到 episode-audio
  bucket（路径 {topic_id}/{lang}.mp3）→ upsert episodes 行
  （content + audio 时间戳 + status='published' + publish_date）
- --schedule 模式：给一批集自动分配未来连续的 publish_date（跳过指定日期）
- 幂等：重复发布同一 topic_id 覆盖更新，version +1

验收：
- [ ] 端到端：approve 一集 → 一条命令 → 线上 /today 可播放，暂停点准确（±0.3s）
- [ ] 未批准集发布时报错退出，episodes 表无残留 draft 污染
- [ ] 单集双语总成本打印（TTS 字符数 + 存储）
```

---

### P1-14 · 内容生产冲刺（运营任务 + 一张 agent 卡）

```
Agent 卡：执行文档 1 的 Prompt C，产出 question-bank.yaml（100 题）
验收：分布约束满足（8 类 ≥8 题、language_culture ≥10、misconception 全非空）

你的运营任务（工具已就绪，纯执行）：
- 从 100 题中选首批 30 题 → 补 topics.yaml 来源 → 批量 generate+review
  → 审核 → TTS → schedule 排期 30 天
- 时间预算：来源绑定 ~3h + 审核 ~3h，分两个周末完成
```

---

### P1-15 · 每周家长摘要邮件

```
任务：Edge Function（supabase/functions/weekly-digest）+ Resend 模板

- pg_cron 每周日按时区分批触发（先粗做：UTC 周日 16:00 一批，覆盖北美晚间）
- 聚合上周：loops_completed、episodes_listened、new_questions（列出原文
  ——这是家长自己录的数据，发回给家长本人合规）、本周预告 1 集标题
- 文案基调：庆祝而非考核。"Nova 这周完成了 4 次好奇心循环，还想知道
  '松鼠为什么不触电'" 而不是 "完成率 57%"
- 邮件底部一个问题："这周孩子有没有主动要求听？" [有！] [还没有]
  → 点击落到一个记录页（写入 weekly_digests.stats 的 qualitative 字段
  ——这就是第六节说的"无法造假的定性信号"）
- 写 weekly_digests 行防重发；家长可在 /settings 关闭

验收：
- [ ] 本地触发对测试家庭发信，中英文按 language_pref 渲染正确
- [ ] 零活动家庭不发信（不制造愧疚）
- [ ] 重复触发不重发（unique family_id+week_start）
```

---

### P1-16 · 埋点 + WHF 内部仪表盘 ⚡

```
任务：PostHog 接入 + 北极星看板

- packages/core/src/analytics.ts：事件常量与属性类型（对齐 docs/events.md，
  禁止裸字符串）
- apps/web 接入：文档 2 事件字典全量埋点；属性只含 ID 与枚举
  （CI 加一条 lint 规则：capture 调用的属性 key 白名单校验）
- 内部仪表盘：/admin 路由（简单 basic auth 或仅限你的 email）
  四层指标：
  1. WHF（v_weekly_habit_families，service role 查询）周趋势
  2. 循环完成率 = loop_completed / episode_started（周维度）
  3. 新家庭首周 ≥4 循环比例
  4. 注册数 / waitlist 转化数
- PostHog 侧配置留存漏斗（手动配置，文档记录步骤即可）

验收：
- [ ] 完整走一次循环，PostHog 收到全链路 8 个事件，属性无内容字段
- [ ] /admin 非授权访问 403；WHF 数字与 SQL 手查一致
```

---

### P1-17 · 每周免费集置位脚本

```
任务：解决文档 2 遗留问题——is_free 的每周轮换

- Edge Function free-episode-rotation + pg_cron 每周一 00:00 UTC：
  1. 将上周 is_free=true 的集恢复 false
  2. 从本周 7 集中选 2 集置 is_free=true
     选择规则：优先 sensitivity=none 且 category 不同的两集（展示广度）
- 手动 override：episodes 表加 is_free_locked 字段（migration 0003），
  锁定的集不被轮换（用于营销活动固定免费集）

验收：
- [ ] 连续模拟 3 周运行，任一时刻 is_free 集数 = 2（+锁定集）
- [ ] 免费用户在轮换后对旧免费集的访问降级为 story_only（RPC 实时判断，天然生效）
```

---

### P1-18 · 上线检查清单（发布前最后一卡）

```
任务：生产就绪审计，输出报告

安全：
- [ ] 全表 RLS 复查（脚本遍历 pg_tables 断言 rowsecurity=true）
- [ ] 客户端 bundle 扫描：无 service_role/stripe secret 字样
- [ ] /api/* 全部有认证校验；audio-url 签名有效期 ≤ 2h
合规：
- [ ] 隐私政策页（/privacy，中英）：明确"不收集儿童数据"承诺、家长数据
      删除权、第三方清单（Supabase/PostHog/Resend/Stripe）
- [ ] Terms 页 + 邮件 footer 退订链接
体验：
- [ ] iOS Safari / Android Chrome / 微信浏览器三端实测完整循环
- [ ] Lighthouse mobile：/today ≥ 85
- [ ] 慢网（3G 节流）下音频加载有进度反馈
数据：
- [ ] 生产 Supabase 每日备份开启；PITR 评估（免费层限制记录到 docs/）
- [ ] Sentry 或等价错误监控接入（免费层）

产出：docs/launch-audit.md，未通过项列表 + 修复卡
```

**Phase 1 Gate 复核**（上线 4 周后）：50+ 激活家庭 / 循环完成率 ≥ 60% / 周留存 ≥ 40% → 进入 Phase 2。未达标优先怀疑内容配方，回文档 1 调 prompt 而不是加功能。

---

## Phase 2 · 变现（2 周，6 张卡概要）

### P2-01 · Stripe 产品与 Checkout

```
- Stripe 产品：monthly_799（$7.99/月）/ annual_5900（$59/年），
  均带 trial_period_days=7，要求预留支付方式（trial 转付自动扣款）
- /pricing 页（双语）+ Checkout Session 创建（Route Handler，
  metadata.family_id 必带）
- 成功回跳 /welcome-premium；Customer Portal 链接入 /settings
验收：测试卡全流程 + 试用期内取消不扣款
```

### P2-02 · Stripe Webhook → subscriptions 表（字段映射，文档 2 遗留）

```
Edge Function stripe-webhook，处理事件与映射：

事件                                  → 动作
checkout.session.completed           → upsert subscriptions:
    platform='stripe'
    status = subscription.status 映射（trialing→trialing, active→active）
    product_id = price.lookup_key（monthly_799/annual_5900）
    trial_end / current_period_end = 对应时间戳
    external_customer_id = customer, external_subscription_id = subscription
customer.subscription.updated        → 同步 status/current_period_end
    （past_due→past_due；canceled 且期末→canceled）
customer.subscription.deleted        → status='expired'
invoice.payment_failed               → status='past_due'（宽限期由
    has_entitlement 的 current_period_end 自然兜底）

要求：签名校验（STRIPE_WEBHOOK_SECRET）、幂等（event.id 去重表 0004）、
     family_id 从 metadata 回溯，失败入死信日志
验收：stripe CLI 重放全事件类型；重复投递不产生重复行
```

### P2-03 · 试用与 Paywall 前端

```
- UpgradeHint（P1-08 占位）激活：story_only 集尾 → 价值页
  （展示被锁的 Predict/Think 问题的模糊预览——"孩子还差 4 个问题没被问到"）
- 试用状态条：settings 与 today 顶部显示"试用还剩 N 天"
- paywall_viewed / trial_started / subscription_activated 事件补齐
验收：免费→试用→付费三态 UI 正确；权益变化 <1 分钟内生效（RPC 实时）
```

### P2-04 · past_due 与到期处理 / P2-05 · 转化漏斗看板 / P2-06 · 定价实验开关

（概要：宽限期 3 天温和提醒邮件；/admin 加转化漏斗四步：paywall→trial→active→W4 留存；product_id 抽象支持后续价格实验，不做 A/B 基建只做配置切换。）

**Phase 2 Gate**：试用→付费 ≥ 15% 或 20 个付费家庭。

---

## Phase 3 · iOS（3–4 周，7 张卡概要）

> 开工前：购买 Apple Developer（$99，此时预算已由收入部分覆盖）；App 定位为普通 Education 类目 + 4+ 年龄分级，**不进 Kids Category**（面向家长的亲子工具，见 CLAUDE.md 定位）。

| 卡 | 内容 | 关键点 |
|---|---|---|
| P3-01 | Expo 骨架 + 复用 core/api-client | expo-router 对齐 web 路由结构；Supabase auth 深链处理 magic link |
| P3-02 | 原生播放器 | expo-audio + 后台播放 (UIBackgroundModes audio)、锁屏控制、shouldPauseAt 复用——**后台播放时暂停点行为**：命中边界暂停并发本地通知"该回答问题啦" |
| P3-03 | 离线下载 | expo-file-system 缓存本周集；签名 URL 过期与缓存校验策略 |
| P3-04 | RevenueCat 接入 | SDK + App Store Connect 产品（同价）；webhook → subscriptions 表（platform='app_store'，字段映射同 P2-02 模式：INITIAL_PURCHASE/RENEWAL→active，CANCELLATION→canceled，EXPIRATION→expired，BILLING_ISSUE→past_due）；**跨端互认**：has_entitlement 天然支持，UI 提示"已在网页订阅"防重复购买 |
| P3-05 | Parental gate | 购买/外链前的家长验证（算术题式）；虽不进 Kids Category，仍做——差异化信任卖点 |
| P3-06 | 商店准备 | 隐私营养标签（数据收集最小声明）、双语截图与文案、审核演示账号（预置已付费家庭 + 3 集内容）、App Review 备注说明产品定位与零儿童数据设计 |
| P3-07 | TestFlight 2 周 | 招募 15+ 现有付费 web 家庭内测 → 修复 → 提审 |

**申请 App Store Small Business Program**（年收入 <$100 万，抽成 15%）在首次提审前完成。

---

## 收尾：三份文档的关系图

```
文档 1（内容契约 + Prompt 套件）
   └─ Episode JSON Schema ──→ 文档 2 episodes.content JSONB
                              packages/core zod schema（单一定义）
文档 2（宪法 + Schema + RLS）
   └─ 铁律/DoD/表结构 ──→ 文档 3 所有任务卡的默认约束
文档 3（任务分解）
   └─ P1-01 是入口任务；P1-02 上线即开始获客；
      P1-11~14 内容线与 P1-04~10 产品线并行
```

**建议的第一周执行顺序**：文档 1 的样片任务（验证内容生死线）→ P1-01 → P1-02（当天上线收 email）→ 之后产品线与内容线双轨推进。

