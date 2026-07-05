## 收尾：三份文档的关系图

```
文档 1（内容契约 + Prompt 套件）
   └─ Episode JSON Schema ──→ 文档 2 episodes.content JSONB
                              packages/core zod schema（单一定义）
文档 2（宪法 + Schema + RLS）
   └─ 铁律/DoD/表结构 ──→ 文档 3 所有任务卡的默认约束
文档 3（任务分解）
   └─ P1-01 是入口任务；P1-02 上线即开始获客；
      P1-11~14 内容线与 P1-04~10 产品线并行
```

**建议的第一周执行顺序**：文档 1 的样片任务（验证内容生死线）→ P1-01 → P1-02（当天上线收 email）→ 之后产品线与内容线双轨推进。

