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

