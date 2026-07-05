### P1-04 · 分段音频播放器（核心组件之一）

```
任务：packages/core 播放器逻辑 + apps/web 播放器组件

背景：episodes.audio JSONB 结构为
  { en: { path, duration_sec, segments: [{type, start, end}] }, zh: {...} }
音频是整集单文件，segments 记录各环节的起止秒数（由 content 管线拼接时生成）。

packages/core/src/player.ts（纯函数，vitest 覆盖）：
- derivePlayerPlan(episode, languageMode): PlayerPlan
  → bilingual 模式选主语言音频（families.language_pref 为 bilingual 时
    默认 zh 主音频，可在集内切换）
- shouldPauseAt(plan, currentTime): SegmentBoundary | null
  → 命中 pause_after=true 的 segment 结束点（±0.3s 容差）返回边界

apps/web 组件 <EpisodePlayer>：
- HTML5 Audio + 自定义 UI：播放/暂停、进度条（按 segment 分色显示）、
  ±10 秒、语速 0.8x/1x
- timeupdate 中调 shouldPauseAt，命中即 pause() 并触发 onSegmentBoundary
  回调（问题卡由 P1-05 接管）
- 恢复播放从下一 segment 的 start 开始（防止重复触发）
- 音频 URL：调 /api/audio-url Route Handler（本卡实现），Handler 内
  先调 get_full_episode 校验 access，再用 service role 签 2 小时 URL

验收：
- [ ] player.ts 单测覆盖：边界命中/容差/恢复不重触发/双语选轨，≥ 12 用例
- [ ] 真机 Safari iOS 测试：锁屏后恢复、切后台回来进度正确
- [ ] story_only access 时，进度条只显示 hook+story 区间，播完自然结束
- [ ] /api/audio-url 对无权 episode 返回 403
```

---

