## Phase 3 · iOS（3–4 周，7 张卡概要）

> 开工前：购买 Apple Developer（$99，此时预算已由收入部分覆盖）；App 定位为普通 Education 类目 + 4+ 年龄分级，**不进 Kids Category**（面向家长的亲子工具，见 CLAUDE.md 定位）。

| 卡 | 内容 | 关键点 |
|---|---|---|
| P3-01 | Expo 骨架 + 复用 core/api-client | expo-router 对齐 web 路由结构；Supabase auth 深链处理 magic link |
| P3-02 | 原生播放器 | expo-audio + 后台播放 (UIBackgroundModes audio)、锁屏控制、shouldPauseAt 复用——**后台播放时暂停点行为**：命中边界暂停并发本地通知"该回答问题啦" |
| P3-03 | 离线下载 | expo-file-system 缓存本周集；签名 URL 过期与缓存校验策略 |
| P3-04 | RevenueCat 接入 | SDK + App Store Connect 产品（同价）；webhook → subscriptions 表（platform='app_store'，字段映射同 P2-02 模式：INITIAL_PURCHASE/RENEWAL→active，CANCELLATION→canceled，EXPIRATION→expired，BILLING_ISSUE→past_due）；**跨端互认**：has_entitlement 天然支持，UI 提示"已在网页订阅"防重复购买 |
| P3-05 | Parental gate | 购买/外链前的家长验证（算术题式）；虽不进 Kids Category，仍做——差异化信任卖点 |
| P3-06 | 商店准备 | 隐私营养标签（数据收集最小声明）、双语截图与文案、审核演示账号（预置已付费家庭 + 3 集内容）、App Review 备注说明产品定位与零儿童数据设计 |
| P3-07 | TestFlight 2 周 | 招募 15+ 现有付费 web 家庭内测 → 修复 → 提审 |

**申请 App Store Small Business Program**（年收入 <$100 万，抽成 15%）在首次提审前完成。

---

