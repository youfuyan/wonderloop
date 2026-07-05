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

