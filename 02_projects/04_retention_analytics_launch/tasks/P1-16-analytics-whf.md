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

