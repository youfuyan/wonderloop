### P1-03 · 认证 + 家庭账户 + 孩子档案

```
任务：Supabase Auth 接入 + onboarding 流程

路由：
/login          email magic link（首选，免密码）+ Google OAuth
/onboarding     首次登录后强制走完：
                Step1 语言偏好（en/zh/bilingual，写 families.language_pref）
                Step2 添加孩子：nickname + age_band（可加 1-4 个，可跳过）
                Step3 时区自动检测（写 families.timezone，可改）
/settings       修改语言偏好/时区/孩子档案；"删除账户与全部数据"按钮
                （调 RPC delete_family_cascade，本卡实现该 migration）

要求：
- middleware 保护 /today /calendar /questions /settings，未登录跳 /login
- families 行由 auth trigger 自动创建（0001 已有），onboarding 只做 update
- 孩子档案表单只有 nickname + age_band 两个字段——不许"顺手"加生日选择器
- 删除账户：新 migration 0002，security definer RPC，级联删 families
  （外键已 cascade），并调用 auth.admin 删除 user（Edge Function 实现）
- i18n：所有文案走 packages/core/i18n 的 en/zh 字典

验收：
- [ ] 新用户 magic link 登录 → onboarding → /today 全流程通
- [ ] 删除账户后：auth.users、families 及所有子表数据消失（写测试验证）
- [ ] child_profiles 第 5 个孩子插入被 RLS 拒绝
```

---

