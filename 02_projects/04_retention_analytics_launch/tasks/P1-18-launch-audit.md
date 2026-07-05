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

