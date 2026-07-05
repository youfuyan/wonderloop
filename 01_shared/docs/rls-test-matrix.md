# RLS 验证脚本要求

<!-- 原文内容逐行保留，仅添加分类标题。 -->

RLS 验证脚本要求（supabase/tests/rls.test.sql 最低覆盖）
#	场景	期望
1	家庭 A 查询家庭 B 的 daily_sessions / child_questions	0 行
2	authenticated 直接 select * from episodes	权限拒绝
3	免费用户调用 get_full_episode（非 free 集）	access='story_only'，segments 只含 hook/story
4	trialing 用户调用同一 RPC	access='full'
5	authenticated 直接 insert subscriptions	权限拒绝
6	尝试发布 approved_by is null 的 episode	check 约束报错
7	anon insert waitlist / anon select waitlist	成功 / 拒绝
