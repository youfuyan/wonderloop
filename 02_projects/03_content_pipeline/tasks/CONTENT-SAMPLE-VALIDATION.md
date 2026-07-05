交付 ②：样片任务实际执行陪跑 — 选题来源绑定 + Prompt 调试手册

> 这是内容生死线的实操指南。目标：产出 2 集达标样片，你的总投入 ≈ 3–4 小时。
2.1 两个选题的来源绑定（直接可用）
选题 A：animals-bird-powerline

- topic_id: animals-bird-powerline
  category: animals
  question_zh: 为什么小鸟站在电线上不会触电？
  question_en: Why don't birds get shocked on power lines?
  age_band: "5-8"
  sensitivity: low          # 涉及电安全 → story 结尾必须带安全提醒
  sources:
    - url: https://www.loc.gov/everyday-mysteries/zoology/item/why-dont-birds-get-electrocuted-when-they-land-on-an-electrical-wire/
      note: 美国国会图书馆 Everyday Mysteries——电流路径与电位差的权威科普解释
    - url: https://www.energyeducation.ca/encyclopedia/Electrical_safety_of_birds_on_power_lines
      note: 卡尔加里大学能源教育百科——为何双脚同线安全、接触两线或接地危险
  bilingual_hook: null
  status: ready

你的动作：打开两个链接，摘录支撑段落各 200–500 字，粘贴进 generate 时的 SOURCES。核对要点三条：① 电流走电阻小的路径 ② 两脚同线电位差极小 ③ 同时接触两个不同电位才危险。
选题 B：language-two-languages（差异化题）

- topic_id: language-two-languages
  category: language_culture
  question_zh: 为什么我们家说两种话？
  question_en: Why does our family speak two languages?
  age_band: "5-8"
  sensitivity: low          # 涉及身份认同，语气必须是自豪而非"不同=奇怪"
  sources:
    - url: https://www.linguisticsociety.org/resource/faq-raising-bilingual-children
      note: 美国语言学会 FAQ——双语儿童发展的常见事实与迷思澄清
    - url: https://kidshealth.org/en/parents/bilingual-kids.html
      note: KidsHealth（Nemours）——双语成长的科普事实（不会"搞混"、切换是能力）
  bilingual_hook: 孩子可能以为"混着说是说错了"——真相是 code-switching 是大脑的高级能力
  status: ready

> 来源 URL 请在执行时实际打开核验可用性与内容匹配度；如失效，替换标准是：学术机构 / 医疗教育机构 / 政府科普来源，避免自媒体。
2.2 Prompt 调试流程（预期迭代 2–3 轮）

第 1 轮：直接跑，重点看结构合规
检查项	不合格的典型表现	修法
JSON 可解析且过 zod	混入解释文字、字段缺失	Prompt A 末尾加"输出以 { 开始，以 } 结束"
fact_claims 有来源	编了来源外的数字（如"电压 1 万伏"）	SOURCES 注入时加编号，要求 claim 引用编号
中文无翻译腔	"让我们来想一想这个有趣的问题"	System 中追加中文语感范例句 3 条

第 2 轮：重点看教学质量（这是最常见的失败点）

逐项人工检查并记录：

    Predict 迷思项是不是真迷思？（孩子真的会以为"鸟脚防电"——好；"电线是假的"——太蠢，不是迷思）不合格 → 在 topics.yaml 补 misconception 字段并注入 prompt。
    Think 是迁移题吗？"小鸟为什么没事？"= 复述题，不合格；"一只脚碰电线杆会怎样？"= 迁移题，合格。
    Story 时长：中文朗读约 250 字/分钟，story 段 400–600 字 ≈ 2 分钟，全集应落在 5–8 分钟。超长 → prompt 加硬性字数上限。

第 3 轮：跑 Reviewer（Prompt B），校准阈值

    若 Reviewer 全维度给 9–10 分但你人工发现了问题 → Reviewer prompt 太温和，在 system 中强化"宁可误杀"并加 few-shot 差评示例。
    若 line_issues 大量鸡蛋里挑骨头 → 在 rubric 中明确"仅报告会实际影响孩子理解或安全的问题"。
    记录两集的分流结果：理想状态是选题 A 走 FAST_TRACK、选题 B（sensitivity 敏感面更宽）走 FULL_REVIEW——正好验证两条通道。

2.3 TTS 试听清单（每集 5 分钟）

    中文数字、多音字（"电线 xiàn"不读 "线 xián"类错误）→ 错误处加 <phoneme>
    问题句后的 600ms 停顿是否自然
    语速 -8% 对 5 岁是否仍偏快 → 备选 -12% 各生成一版
    双语桥段落中英切换是否顺滑（Xiaoxiao Multilingual 的英文词发音）

2.4 家庭试听验证（生死信号）

找 3 个家庭（微信好友即可），发音频 + 一页说明，请家长记录：

观察表（家长填，2 分钟）：
1. 孩子听完整集了吗？中途走神在第几分钟？
2. Predict 暂停时，孩子选了哪个？说了什么原话？
3. Teach back 环节，孩子说出来的一句话是什么？（原文记录）
4. 听完之后 24 小时内，孩子有没有再提起这个话题？
5. 家长直觉：愿意每天做这件事吗？(1-5 分)

判定标准：

    3 个孩子中 ≥2 个听完 + 能回答 Predict → 内容配方成立，进 P1-01
    普遍在 story 段走神 → 缩短 story、增加角色对话密度，回炉重跑
    Teach back 说不出来 → 说明解释太抽象，比喻没立住，这是最重要的失败信号

