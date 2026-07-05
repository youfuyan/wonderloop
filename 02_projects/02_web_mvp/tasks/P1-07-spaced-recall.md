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

