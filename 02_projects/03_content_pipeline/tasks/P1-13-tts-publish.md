### P1-13 · 内容管线：TTS + 拼接 + 发布

```
任务：tts.ts（文档 1 第 7 节规范）+ publish.ts

tts.ts：
- 每 segment 独立生成（Azure SDK，SSML 规则见文档 1）→ ffmpeg 拼接单文件
  → 计算并输出 segments 时间戳数组
- (text, voice, ssml_config) hash 缓存，只重生成变动 segment
- 双音色配置：zh 版 XiaoxiaoMultilingual；en 版 A/B 两候选各生成一次
  （样片家庭盲选后固定）

publish.ts：
- 校验 final.json 有 approved_by/approved_at → 上传 mp3 到 episode-audio
  bucket（路径 {topic_id}/{lang}.mp3）→ upsert episodes 行
  （content + audio 时间戳 + status='published' + publish_date）
- --schedule 模式：给一批集自动分配未来连续的 publish_date（跳过指定日期）
- 幂等：重复发布同一 topic_id 覆盖更新，version +1

验收：
- [ ] 端到端：approve 一集 → 一条命令 → 线上 /today 可播放，暂停点准确（±0.3s）
- [ ] 未批准集发布时报错退出，episodes 表无残留 draft 污染
- [ ] 单集双语总成本打印（TTS 字符数 + 存储）
```

---

