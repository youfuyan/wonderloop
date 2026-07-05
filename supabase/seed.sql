insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'seed-parent@example.com',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
) on conflict (id) do nothing;

insert into public.episodes (
  id,
  topic_id,
  publish_date,
  status,
  category,
  age_band,
  sensitivity,
  title_en,
  title_zh,
  is_free,
  content,
  audio,
  approved_by,
  approved_at
) values (
  '20000000-0000-0000-0000-000000000001',
  'animals-bird-powerline',
  current_date - 1,
  'published',
  'animals',
  '5-8',
  'low',
  'Why Don''t Birds Get Shocked on Power Lines?',
  '为什么小鸟站在电线上不会触电？',
  true,
  $${
    "topic_id": "animals-bird-powerline",
    "version": 1,
    "age_band": "5-8",
    "category": "animals",
    "title": {
      "en": "Why Don't Birds Get Shocked on Power Lines?",
      "zh": "为什么小鸟站在电线上不会触电？"
    },
    "knowledge_outline": [
      "Electric current needs a path to flow.",
      "A bird standing on one wire has very little voltage difference between its feet.",
      "Touching two wires, or a wire and the ground, can make a dangerous path."
    ],
    "fact_claims": [
      {
        "claim": "A bird on one wire is usually not shocked because its two feet are at almost the same electric potential.",
        "source_url": "https://www.energy.gov/",
        "source_note": "General public electrical-safety explanation used for seed content only."
      }
    ],
    "segments": [
      {
        "type": "hook",
        "pause_after": false,
        "script": {
          "en": "A bird lands on a wire. The wire carries power, but the bird keeps singing.",
          "zh": "一只小鸟落在电线上。电线有电，可小鸟还在唱歌。"
        }
      },
      {
        "type": "predict",
        "pause_after": true,
        "question": {
          "en": "What do you think keeps the bird safe?",
          "zh": "你觉得小鸟为什么没事？"
        },
        "options": [
          {
            "id": "a",
            "en": "Its feet block electricity.",
            "zh": "它的脚会挡住电。"
          },
          {
            "id": "b",
            "en": "Electricity does not get an easy path through it.",
            "zh": "电没有一条容易穿过它身体的路。"
          },
          {
            "id": "c",
            "en": "The wire turns off for birds.",
            "zh": "电线看见小鸟就关掉了。"
          }
        ],
        "no_wrong_answer_note": {
          "en": "Any guess is welcome. We will listen for clues.",
          "zh": "怎么猜都可以，我们一起听线索。"
        }
      },
      {
        "type": "story",
        "pause_after": false,
        "script": {
          "en": "Mia saw a sparrow on a power line. Her dad said electricity is like water: it flows when it has a path. The bird's feet are on the same wire, almost like standing on one flat step. There is no big push from one foot to the other. But wires are not toys. People should stay far away and ask a grown-up for help.",
          "zh": "米米看见一只小麻雀站在电线上。爸爸说，电有点像水，要有一条路才会流。小鸟两只脚站在同一根线上，就像站在同一级台阶上，两只脚之间没有很大的推力。不过电线不是玩具，小朋友要离电线远远的，有事找大人帮忙。"
        }
      },
      {
        "type": "think",
        "pause_after": true,
        "question": {
          "en": "What if one foot touched another wire?",
          "zh": "如果一只脚又碰到另一根电线，会怎样？"
        },
        "answer_guidance": {
          "en": "That could make a path for electricity, so it is dangerous.",
          "zh": "那可能形成一条让电通过的路，所以很危险。"
        }
      },
      {
        "type": "teach_back",
        "pause_after": true,
        "prompt": {
          "en": "Tell your grown-up why the bird is safe in one sentence.",
          "zh": "用一句话告诉大人：小鸟为什么没事？"
        }
      },
      {
        "type": "new_question",
        "pause_after": true,
        "prompt": {
          "en": "What else do you wonder about electricity?",
          "zh": "关于电，你还想知道什么？"
        }
      }
    ],
    "recall_question": {
      "en": "Why was the bird safe on one wire?",
      "zh": "小鸟站在一根电线上为什么没事？",
      "answer_hint": {
        "en": "Its feet were on the same wire, so electricity did not get an easy path through it.",
        "zh": "它两只脚在同一根线上，电没有一条容易穿过身体的路。"
      }
    },
    "bilingual_bridge": [
      {
        "en": "electricity",
        "zh": "电",
        "pinyin": "dian"
      },
      {
        "en": "power line",
        "zh": "电线",
        "pinyin": "dian xian"
      }
    ],
    "sensitivity": "low",
    "estimated_duration_sec": {
      "en": 330,
      "zh": 360
    }
  }$$::jsonb,
  '{"en":{"path":"seed/animals-bird-powerline.en.mp3","duration_sec":330,"segments":[{"type":"hook","start":0,"end":20},{"type":"predict","start":20,"end":45},{"type":"story","start":45,"end":280},{"type":"think","start":280,"end":300},{"type":"teach_back","start":300,"end":315},{"type":"new_question","start":315,"end":330}]},"zh":{"path":"seed/animals-bird-powerline.zh.mp3","duration_sec":360,"segments":[{"type":"hook","start":0,"end":22},{"type":"predict","start":22,"end":50},{"type":"story","start":50,"end":305},{"type":"think","start":305,"end":325},{"type":"teach_back","start":325,"end":342},{"type":"new_question","start":342,"end":360}]}}'::jsonb,
  'seed',
  now()
) on conflict (topic_id) do nothing;

insert into public.episodes (
  id,
  topic_id,
  publish_date,
  status,
  category,
  age_band,
  sensitivity,
  title_en,
  title_zh,
  is_free,
  content,
  audio,
  approved_by,
  approved_at
) values (
  '20000000-0000-0000-0000-000000000002',
  'language-two-languages',
  current_date,
  'published',
  'language_culture',
  '5-8',
  'none',
  'Why Does Our Family Use Two Languages?',
  '为什么我们家会说两种话？',
  false,
  $${
    "topic_id": "language-two-languages",
    "version": 1,
    "age_band": "5-8",
    "category": "language_culture",
    "title": {
      "en": "Why Does Our Family Use Two Languages?",
      "zh": "为什么我们家会说两种话？"
    },
    "knowledge_outline": [
      "Families use languages to connect with people and places.",
      "Using two languages can help a child understand more words and stories.",
      "Switching languages is a normal part of many bilingual homes."
    ],
    "fact_claims": [
      {
        "claim": "Many families use more than one language at home to communicate with different people and communities.",
        "source_url": "https://www.naeyc.org/",
        "source_note": "Early childhood bilingual-family guidance used for seed content only."
      }
    ],
    "segments": [
      {
        "type": "hook",
        "pause_after": false,
        "script": {
          "en": "At breakfast, one family says good morning and zao an at the same table.",
          "zh": "早餐桌上，一家人一会儿说早安，一会儿说 good morning。"
        }
      },
      {
        "type": "predict",
        "pause_after": true,
        "question": {
          "en": "Why might a family use two languages?",
          "zh": "一家人为什么会用两种语言呢？"
        },
        "options": [
          {
            "id": "a",
            "en": "One language is for weekdays only.",
            "zh": "一种语言只能周一到周五用。"
          },
          {
            "id": "b",
            "en": "Different words help us talk with different people.",
            "zh": "不同的词能帮我们和不同的人说话。"
          },
          {
            "id": "c",
            "en": "The words are playing hide-and-seek.",
            "zh": "词语在玩捉迷藏。"
          }
        ],
        "no_wrong_answer_note": {
          "en": "There are many good guesses.",
          "zh": "很多猜法都很好。"
        }
      },
      {
        "type": "story",
        "pause_after": false,
        "script": {
          "en": "Leo called Grandma and said, ni hao. Then he told his teacher, good morning. His mom said languages are like keys. One key opens a chat with Grandma. Another key opens a chat at school. In their home, both keys belong on the same ring.",
          "zh": "乐乐给奶奶打电话，说：你好。到学校见到老师，他又说：good morning。妈妈说，语言像钥匙。一把钥匙打开和奶奶聊天的门，一把钥匙打开和学校聊天的门。在我们家，两把钥匙都挂在同一个钥匙圈上。"
        }
      },
      {
        "type": "think",
        "pause_after": true,
        "question": {
          "en": "When would you choose Chinese, and when would you choose English?",
          "zh": "什么时候你会选中文，什么时候会选英文？"
        },
        "answer_guidance": {
          "en": "The child may name family, school, books, songs, or friends.",
          "zh": "孩子可以说家人、学校、书、歌或者朋友。"
        }
      },
      {
        "type": "teach_back",
        "pause_after": true,
        "prompt": {
          "en": "Tell your grown-up one reason two languages can help.",
          "zh": "告诉大人：两种语言有什么用？"
        }
      },
      {
        "type": "new_question",
        "pause_after": true,
        "prompt": {
          "en": "What other word do you know in two languages?",
          "zh": "你还知道哪个词有两种说法？"
        }
      }
    ],
    "recall_question": {
      "en": "Why did Leo's family use two languages?",
      "zh": "乐乐家为什么用两种语言？",
      "answer_hint": {
        "en": "Different languages helped them talk with different people.",
        "zh": "不同语言帮他们和不同的人聊天。"
      }
    },
    "bilingual_bridge": [
      {
        "en": "language",
        "zh": "语言",
        "pinyin": "yu yan"
      },
      {
        "en": "family",
        "zh": "家庭",
        "pinyin": "jia ting"
      }
    ],
    "sensitivity": "none",
    "estimated_duration_sec": {
      "en": 320,
      "zh": 345
    }
  }$$::jsonb,
  '{"en":{"path":"seed/language-two-languages.en.mp3","duration_sec":320,"segments":[{"type":"hook","start":0,"end":20},{"type":"predict","start":20,"end":45},{"type":"story","start":45,"end":270},{"type":"think","start":270,"end":292},{"type":"teach_back","start":292,"end":306},{"type":"new_question","start":306,"end":320}]},"zh":{"path":"seed/language-two-languages.zh.mp3","duration_sec":345,"segments":[{"type":"hook","start":0,"end":22},{"type":"predict","start":22,"end":50},{"type":"story","start":50,"end":290},{"type":"think","start":290,"end":315},{"type":"teach_back","start":315,"end":330},{"type":"new_question","start":330,"end":345}]}}'::jsonb,
  'seed',
  now()
) on conflict (topic_id) do nothing;

with family_row as (
  select id
  from public.families
  where auth_user_id = '10000000-0000-0000-0000-000000000001'
),
child_row as (
  insert into public.child_profiles (family_id, nickname, age_band)
  select id, 'Seed Kid', '5-8'
  from family_row
  returning id, family_id
)
insert into public.daily_sessions (
  family_id,
  child_profile_id,
  episode_id,
  session_date,
  language_mode,
  listened,
  predict_choice,
  answered_think,
  taught_back,
  asked_new_question,
  recall_answered,
  completed_at
)
select
  child_row.family_id,
  child_row.id,
  episodes.id,
  current_date - 1,
  'bilingual',
  true,
  'b',
  true,
  true,
  true,
  false,
  now()
from child_row
cross join public.episodes
where episodes.topic_id = 'animals-bird-powerline'
on conflict (family_id, episode_id) do nothing;
