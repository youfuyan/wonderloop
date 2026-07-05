### P1-02 · 双语落地页 + 候补名单 ⚡（P1-01 完成后立即做，当天上线）

```
任务：apps/web 中实现落地页，部署到 Cloudflare Pages

页面结构（单页，默认双语并排展示，右上角 EN/中 切换）：
1. Hero：一句话价值主张
   zh: "每天 5 分钟，陪孩子完成一次好奇心循环"
   en: "5 minutes a day. One question. One curious kid."
2. 循环示意：猜一猜 → 听故事 → 想一想 → 讲给爸妈听 → 提出新问题 → 明天回顾
3. 内嵌样片播放器：播放文档 1 产出的 2 集样片（<audio> 原生标签即可，
   此页不需要暂停点逻辑）
4. 差异化三点：双语原生内容 / 零儿童数据收集 / 无广告无算法喂养
5. 候补表单：email + 语言偏好(en/zh/bilingual) + 来源下拉
   (xiaohongshu/wechat/school/friend/other)
   → insert public.waitlist（anon 权限，已有 RLS policy）
6. Footer：隐私承诺一句话 + 联系邮箱

技术要求：
- 纯静态 RSC，无客户端 JS 除表单提交与语言切换
- Lighthouse mobile performance ≥ 90（家长大多手机打开）
- OG 图与 meta 双语（微信/小红书分享卡片正常显示）

验收：
- [ ] 提交 email 后 waitlist 表有记录，重复 email 报友好提示
- [ ] 手机端微信内置浏览器打开正常（实测）
- [ ] 部署到生产域名，HTTPS 正常
```

> **上线后你的运营动作（非 agent 任务）**：发到 2–3 个华人家长群 + 小红书发首帖。MVP 完成前目标 30–50 个 email。

---

