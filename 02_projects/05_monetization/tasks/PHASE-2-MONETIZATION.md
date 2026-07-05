## Phase 2 · 变现（2 周，6 张卡概要）

### P2-01 · Stripe 产品与 Checkout

```
- Stripe 产品：monthly_799（$7.99/月）/ annual_5900（$59/年），
  均带 trial_period_days=7，要求预留支付方式（trial 转付自动扣款）
- /pricing 页（双语）+ Checkout Session 创建（Route Handler，
  metadata.family_id 必带）
- 成功回跳 /welcome-premium；Customer Portal 链接入 /settings
验收：测试卡全流程 + 试用期内取消不扣款
```

### P2-02 · Stripe Webhook → subscriptions 表（字段映射，文档 2 遗留）

```
Edge Function stripe-webhook，处理事件与映射：

事件                                  → 动作
checkout.session.completed           → upsert subscriptions:
    platform='stripe'
    status = subscription.status 映射（trialing→trialing, active→active）
    product_id = price.lookup_key（monthly_799/annual_5900）
    trial_end / current_period_end = 对应时间戳
    external_customer_id = customer, external_subscription_id = subscription
customer.subscription.updated        → 同步 status/current_period_end
    （past_due→past_due；canceled 且期末→canceled）
customer.subscription.deleted        → status='expired'
invoice.payment_failed               → status='past_due'（宽限期由
    has_entitlement 的 current_period_end 自然兜底）

要求：签名校验（STRIPE_WEBHOOK_SECRET）、幂等（event.id 去重表 0004）、
     family_id 从 metadata 回溯，失败入死信日志
验收：stripe CLI 重放全事件类型；重复投递不产生重复行
```

### P2-03 · 试用与 Paywall 前端

```
- UpgradeHint（P1-08 占位）激活：story_only 集尾 → 价值页
  （展示被锁的 Predict/Think 问题的模糊预览——"孩子还差 4 个问题没被问到"）
- 试用状态条：settings 与 today 顶部显示"试用还剩 N 天"
- paywall_viewed / trial_started / subscription_activated 事件补齐
验收：免费→试用→付费三态 UI 正确；权益变化 <1 分钟内生效（RPC 实时）
```

### P2-04 · past_due 与到期处理 / P2-05 · 转化漏斗看板 / P2-06 · 定价实验开关

（概要：宽限期 3 天温和提醒邮件；/admin 加转化漏斗四步：paywall→trial→active→W4 留存；product_id 抽象支持后续价格实验，不做 A/B 基建只做配置切换。）

**Phase 2 Gate**：试用→付费 ≥ 15% 或 20 个付费家庭。

---

