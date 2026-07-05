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

