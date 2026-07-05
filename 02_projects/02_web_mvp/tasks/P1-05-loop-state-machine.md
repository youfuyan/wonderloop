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

