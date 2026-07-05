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

