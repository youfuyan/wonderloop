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

