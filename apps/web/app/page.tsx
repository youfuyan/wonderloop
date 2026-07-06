import { LanguageSwitcher } from "./language-switcher";
import { WaitlistForm } from "./waitlist-form";

const loopSteps = [
  { zh: "猜一猜", en: "Predict" },
  { zh: "听故事", en: "Listen" },
  { zh: "想一想", en: "Think" },
  { zh: "讲给爸妈听", en: "Teach back" },
  { zh: "提出新问题", en: "Ask a new question" },
  { zh: "明天回顾", en: "Recall tomorrow" }
] as const;

const samples = [
  {
    titleZh: "为什么小鸟站在电线上不会触电？",
    titleEn: "Why Don't Birds Get Shocked on Power Lines?",
    categoryZh: "动物 · 电的路径",
    categoryEn: "Animals · Electricity paths",
    audioSrc: "/audio/animals-bird-powerline.wav"
  },
  {
    titleZh: "为什么我们家会说两种话？",
    titleEn: "Why Does Our Family Use Two Languages?",
    categoryZh: "语言文化 · 家庭连接",
    categoryEn: "Language culture · Family connection",
    audioSrc: "/audio/language-two-languages.wav"
  }
] as const;

const differences = [
  {
    zh: "双语原生内容",
    en: "Bilingual from the start",
    detailZh: "中英文共享同一事实骨架，但各自像真实口语。",
    detailEn: "English and Chinese share the same facts, written in natural voice."
  },
  {
    zh: "零儿童数据收集",
    en: "Zero child data collection",
    detailZh: "孩子只和家长一起听，账户与输入都归属家长。",
    detailEn: "Parents own the account and every saved entry."
  },
  {
    zh: "无广告无算法喂养",
    en: "No ads. No algorithmic feed.",
    detailZh: "每天一集，完成一次安静、完整的好奇心循环。",
    detailEn: "One daily episode, built for a calm, complete curiosity loop."
  }
] as const;

export default function Page() {
  return (
    <main>
      <section className="hero">
        <img
          className="heroImage"
          src="/images/wonderloop-hero.webp"
          alt=""
          fetchPriority="high"
        />
        <div className="heroShade" />
        <header className="topbar" aria-label="WonderLoop">
          <a className="brand" href="/">
            WonderLoop
          </a>
          <LanguageSwitcher />
        </header>
        <div className="heroContent">
          <h1>WonderLoop</h1>
          <div className="copyPair heroCopy">
            <p data-locale="zh">每天 5 分钟，陪孩子完成一次好奇心循环</p>
            <p data-locale="en">5 minutes a day. One question. One curious kid.</p>
          </div>
        </div>
      </section>

      <section className="section loopBand" aria-labelledby="loop-title">
        <div className="sectionInner">
          <div className="copyPair sectionHeading">
            <h2 id="loop-title" data-locale="zh">
              一次好奇心循环
            </h2>
            <h2 data-locale="en">One Curiosity Loop</h2>
          </div>
          <ol className="loopList">
            {loopSteps.map((step) => (
              <li key={step.en}>
                <span data-locale="zh">{step.zh}</span>
                <span data-locale="en">{step.en}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section samplesBand" aria-labelledby="samples-title">
        <div className="sectionInner">
          <div className="copyPair sectionHeading">
            <h2 id="samples-title" data-locale="zh">
              样片
            </h2>
            <h2 data-locale="en">Sample Episodes</h2>
          </div>
          <div className="sampleGrid">
            {samples.map((sample) => (
              <article className="sampleCard" key={sample.audioSrc}>
                <div>
                  <div className="copyPair sampleMeta">
                    <p data-locale="zh">{sample.categoryZh}</p>
                    <p data-locale="en">{sample.categoryEn}</p>
                  </div>
                  <div className="copyPair sampleTitle">
                    <h3 data-locale="zh">{sample.titleZh}</h3>
                    <h3 data-locale="en">{sample.titleEn}</h3>
                  </div>
                </div>
                <audio controls preload="metadata" src={sample.audioSrc}>
                  Audio preview
                </audio>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section differenceBand" aria-labelledby="difference-title">
        <div className="sectionInner">
          <div className="copyPair sectionHeading">
            <h2 id="difference-title" data-locale="zh">
              为什么不一样
            </h2>
            <h2 data-locale="en">What Makes It Different</h2>
          </div>
          <div className="differenceGrid">
            {differences.map((item) => (
              <article className="differenceItem" key={item.en}>
                <div className="copyPair">
                  <h3 data-locale="zh">{item.zh}</h3>
                  <h3 data-locale="en">{item.en}</h3>
                </div>
                <div className="copyPair">
                  <p data-locale="zh">{item.detailZh}</p>
                  <p data-locale="en">{item.detailEn}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section waitlistBand" aria-labelledby="waitlist-title">
        <div className="sectionInner waitlistLayout">
          <div>
            <div className="copyPair sectionHeading">
              <h2 id="waitlist-title" data-locale="zh">
                加入候补名单
              </h2>
              <h2 data-locale="en">Join the Waitlist</h2>
            </div>
            <div className="copyPair waitlistCopy">
              <p data-locale="zh">
                我们会先邀请少量家庭试听，慢慢把每天的好奇心循环打磨扎实。
              </p>
              <p data-locale="en">
                We are inviting a small group of families first and shaping the daily
                loop carefully.
              </p>
            </div>
          </div>
          <WaitlistForm />
        </div>
      </section>

      <footer className="footer">
        <div className="sectionInner footerInner">
          <div className="copyPair">
            <p data-locale="zh">隐私承诺：不收集儿童真实身份、照片、语音或位置。</p>
            <p data-locale="en">
              Privacy promise: no child real names, photos, voice, or location.
            </p>
          </div>
          <a href="mailto:hello@wonderloop.app">hello@wonderloop.app</a>
        </div>
      </footer>
    </main>
  );
}
