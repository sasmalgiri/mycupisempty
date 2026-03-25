/**
 * Character Development Framework
 * Based on: Ishwar Chandra Vidyasagar, Bhagavad Gita, Indian Shastra, and Bratachari Movement
 *
 * Bratachari (ব্রতচারী) — Founded by Gurusaday Dutt (1882-1941), a movement for complete
 * development of young people through 5 vows (pancha-brata): knowledge, labor, truth,
 * unity, and joy. It integrates physical fitness, folk culture, and character building.
 *
 * This is NOT moral policing or religious instruction.
 * These are universal human values expressed through Indian cultural wisdom.
 * Every value maps to practical, measurable student behavior.
 */

export interface CharacterValue {
  code: string;
  name: string;
  name_bn: string;
  source: 'vidyasagar' | 'gita' | 'shastra' | 'bratachari';
  source_text?: string;
  source_text_bn?: string;
  description: string;
  description_bn: string;
  // How this maps to our development dimensions
  dimension_codes: string[];
  // Practical daily behaviors a student can practice
  daily_practices: string[];
  daily_practices_bn: string[];
  // Age-appropriate framing
  age_framing: {
    '6-9': string;
    '10-12': string;
    '13-15': string;
    '16-18': string;
  };
}

export const CHARACTER_VALUES: CharacterValue[] = [
  // =========================================================================
  // FROM VIDYASAGAR — Bengali Renaissance, Education, Compassion
  // =========================================================================
  {
    code: 'daya',
    name: 'Compassion (Daya)',
    name_bn: 'দয়া',
    source: 'vidyasagar',
    source_text: 'Vidyasagar was called "Daya-r Sagar" (Ocean of Compassion) — he gave away his salary to help the poor.',
    source_text_bn: 'বিদ্যাসাগরকে "দয়ার সাগর" বলা হতো — তিনি নিজের বেতন গরিবদের মধ্যে বিলিয়ে দিতেন।',
    description: 'Feel others\' pain and help without expecting anything in return.',
    description_bn: 'অন্যের কষ্ট অনুভব করো এবং প্রতিদান না চেয়ে সাহায্য করো।',
    dimension_codes: ['empathy', 'social_conduct'],
    daily_practices: [
      'Help a classmate who is struggling with a topic',
      'Share your notes with someone who missed class',
      'Be kind to someone who seems sad today',
    ],
    daily_practices_bn: [
      'যে সহপাঠী কোনো বিষয়ে কষ্ট পাচ্ছে তাকে সাহায্য করো',
      'যে ক্লাস মিস করেছে তাকে নোট শেয়ার করো',
      'যে আজ দুঃখী মনে হচ্ছে তার প্রতি দয়ালু হও',
    ],
    age_framing: {
      '6-9': 'Be like Vidyasagar — when you see someone sad, try to make them smile!',
      '10-12': 'Vidyasagar helped everyone around him. How can you help someone today?',
      '13-15': 'True strength is helping others selflessly, as Vidyasagar showed throughout his life.',
      '16-18': 'Vidyasagar proved that compassion is not weakness — it is the highest form of courage.',
    },
  },
  {
    code: 'adhyavasaya',
    name: 'Perseverance (Adhyavasaya)',
    name_bn: 'অধ্যবসায়',
    source: 'vidyasagar',
    source_text: 'Young Vidyasagar walked miles barefoot to school, studying under streetlamps because he had no oil lamp at home.',
    source_text_bn: 'ছোটবেলায় বিদ্যাসাগর খালি পায়ে মাইলের পর মাইল হেঁটে স্কুলে যেতেন, রাস্তার বাতির নীচে পড়তেন কারণ বাড়িতে তেলের বাতি ছিল না।',
    description: 'Never give up, even when the path is hard. Keep working towards your goal.',
    description_bn: 'পথ কঠিন হলেও কখনো হাল ছেড়ো না। লক্ষ্যের দিকে কাজ করে যাও।',
    dimension_codes: ['consistency', 'failure_handling', 'discipline'],
    daily_practices: [
      'When a problem is hard, try at least 3 different approaches before asking for help',
      'Keep a "struggle journal" — write what was hard today and how you pushed through',
      'Celebrate effort, not just results',
    ],
    daily_practices_bn: [
      'সমস্যা কঠিন হলে সাহায্য চাওয়ার আগে কমপক্ষে ৩টি ভিন্ন উপায়ে চেষ্টা করো',
      'একটি "সংগ্রাম ডায়েরি" রাখো — আজ কী কঠিন ছিল এবং কীভাবে এগিয়ে গেলে তা লেখো',
      'শুধু ফলাফল নয়, চেষ্টাকে উদযাপন করো',
    ],
    age_framing: {
      '6-9': 'Vidyasagar walked so far to school every day! Can you try one more time when something is hard?',
      '10-12': 'When you feel like giving up, remember — Vidyasagar studied under streetlamps but became the greatest scholar.',
      '13-15': 'Perseverance is your superpower. Every failure is practice for success.',
      '16-18': 'Vidyasagar\'s life proves that circumstances don\'t define you — your persistence does.',
    },
  },
  {
    code: 'satyavadita',
    name: 'Truthfulness (Satyavadita)',
    name_bn: 'সত্যবাদিতা',
    source: 'vidyasagar',
    source_text: 'Vidyasagar never compromised on truth, even when it cost him positions and friendships.',
    source_text_bn: 'বিদ্যাসাগর কখনো সত্যের সাথে আপোষ করেননি, এমনকি যখন তাতে তাঁর পদ ও বন্ধুত্ব হারাতে হয়েছে।',
    description: 'Be honest with yourself and others. Admit mistakes — that is how you grow.',
    description_bn: 'নিজের ও অন্যের সাথে সৎ থাকো। ভুল স্বীকার করো — এভাবেই তুমি বড় হও।',
    dimension_codes: ['honesty', 'confidence'],
    daily_practices: [
      'If you don\'t understand something, say so instead of pretending',
      'When you make a mistake, own it and learn from it',
      'Give honest self-assessments after each study session',
    ],
    daily_practices_bn: [
      'কিছু না বুঝলে ভান না করে সরাসরি বলো',
      'ভুল করলে স্বীকার করো এবং তা থেকে শেখো',
      'প্রতিটি পড়ার সেশনের পর সৎভাবে নিজেকে মূল্যায়ন করো',
    ],
    age_framing: {
      '6-9': 'It\'s brave to say "I don\'t know" — that\'s how we start learning!',
      '10-12': 'Honest people earn trust. When you admit a mistake, people respect you more.',
      '13-15': 'Self-honesty is the foundation of real learning. Pretending to understand helps no one.',
      '16-18': 'Intellectual honesty — knowing what you know and what you don\'t — is the mark of a true scholar.',
    },
  },
  {
    code: 'atmanirvarata',
    name: 'Self-Reliance (Atmanirvarata)',
    name_bn: 'আত্মনির্ভরতা',
    source: 'vidyasagar',
    source_text: 'From extreme poverty, Vidyasagar built himself through education alone — needing no one\'s charity for his success.',
    source_text_bn: 'চরম দারিদ্র্য থেকে বিদ্যাসাগর শুধুমাত্র শিক্ষার জোরে নিজেকে গড়ে তুলেছিলেন — সাফল্যের জন্য কারও দানের প্রয়োজন হয়নি।',
    description: 'Build the ability to learn and solve problems on your own.',
    description_bn: 'নিজে শেখার এবং সমস্যা সমাধানের ক্ষমতা তৈরি করো।',
    dimension_codes: ['self_learning', 'problem_solving'],
    daily_practices: [
      'Try to solve the problem yourself before looking at the answer',
      'Learn one new thing today without anyone telling you to',
      'When stuck, research the topic before asking for help',
    ],
    daily_practices_bn: [
      'উত্তর দেখার আগে নিজে সমস্যাটি সমাধান করার চেষ্টা করো',
      'আজ কেউ না বলেও নতুন একটি জিনিস শেখো',
      'আটকে গেলে সাহায্য চাওয়ার আগে বিষয়টি নিয়ে গবেষণা করো',
    ],
    age_framing: {
      '6-9': 'Try it yourself first! You\'ll be surprised what you can figure out!',
      '10-12': 'Vidyasagar had no tutor, no internet — just determination. You have so much more.',
      '13-15': 'Self-reliance doesn\'t mean never asking for help. It means trying first.',
      '16-18': 'The ability to teach yourself is the most valuable skill you\'ll ever develop.',
    },
  },

  // =========================================================================
  // FROM BHAGAVAD GITA — Karma Yoga, Equanimity, Self-Discipline
  // =========================================================================
  {
    code: 'karmayoga',
    name: 'Karma Yoga (Selfless Action)',
    name_bn: 'কর্মযোগ',
    source: 'gita',
    source_text: 'Karmanye vadhikaraste, Ma phaleshu kadachana — You have the right to action alone, never to its fruits. (Gita 2.47)',
    source_text_bn: 'কর্মণ্যেবাধিকারস্তে মা ফলেষু কদাচন — তোমার কর্মেই অধিকার, ফলে নয়। (গীতা ২.৪৭)',
    description: 'Focus on your effort, not the result. Study to learn, not just for marks.',
    description_bn: 'ফলের দিকে না তাকিয়ে কর্মে মনোযোগ দাও। শুধু নম্বরের জন্য নয়, শেখার জন্য পড়ো।',
    dimension_codes: ['discipline', 'consistency', 'focus'],
    daily_practices: [
      'Before studying, set an intention: "I will understand this concept" (not "I will score well")',
      'After a test, reflect on what you learned, not just your marks',
      'Help someone learn something without expecting anything in return',
    ],
    daily_practices_bn: [
      'পড়ার আগে সংকল্প করো: "আমি এই বিষয়টি বুঝব" (শুধু "ভালো নম্বর পাব" নয়)',
      'পরীক্ষার পর শুধু নম্বর নয়, কী শিখলে তা ভাবো',
      'কিছু প্রতিদানের আশা ছাড়াই কাউকে কিছু শিখতে সাহায্য করো',
    ],
    age_framing: {
      '6-9': 'Enjoy learning like playing a game — the fun is in playing, not just winning!',
      '10-12': 'The Gita teaches: do your best work and don\'t worry about results. The results will come.',
      '13-15': 'When you study for understanding instead of marks, you actually get better marks too.',
      '16-18': 'Karma Yoga in action: put your best effort into everything, let go of anxiety about outcomes.',
    },
  },
  {
    code: 'samatva',
    name: 'Equanimity (Samatva)',
    name_bn: 'সমত্ব',
    source: 'gita',
    source_text: 'Samatvam Yoga Uchyate — Equanimity of mind is called Yoga. (Gita 2.48)',
    source_text_bn: 'সমত্বং যোগ উচ্যতে — মনের সমতাই যোগ। (গীতা ২.৪৮)',
    description: 'Stay balanced in success and failure. Don\'t be crushed by bad results or arrogant after good ones.',
    description_bn: 'সাফল্য ও ব্যর্থতায় সমান থাকো। খারাপ ফলে ভেঙে পড়ো না, ভালো ফলে অহংকারী হয়ো না।',
    dimension_codes: ['emotional_regulation', 'failure_handling', 'confidence'],
    daily_practices: [
      'After getting a result (good or bad), write 3 things you learned from the experience',
      'When something goes wrong, take 3 deep breaths before reacting',
      'Congratulate others genuinely when they succeed',
    ],
    daily_practices_bn: [
      'ফলাফল পাওয়ার পর (ভালো বা খারাপ), অভিজ্ঞতা থেকে ৩টি শিক্ষা লেখো',
      'কিছু ভুল হলে প্রতিক্রিয়া দেওয়ার আগে ৩বার গভীর শ্বাস নাও',
      'অন্যরা সফল হলে আন্তরিকভাবে অভিনন্দন জানাও',
    ],
    age_framing: {
      '6-9': 'It\'s okay to feel sad when things go wrong. But remember — tomorrow is a new day!',
      '10-12': 'Winners aren\'t people who never fail. Winners are people who stay calm and try again.',
      '13-15': 'The Gita says real strength is staying balanced — not getting too high or too low.',
      '16-18': 'Equanimity is emotional intelligence. It\'s what separates reactive people from wise ones.',
    },
  },
  {
    code: 'atmasanyama',
    name: 'Self-Discipline (Atma-sanyama)',
    name_bn: 'আত্মসংযম',
    source: 'gita',
    source_text: 'Uddhared atmanatmanam — Elevate yourself by yourself. You are your own friend or enemy. (Gita 6.5)',
    source_text_bn: 'উদ্ধরেদাত্মনাত্মানং — নিজেকে নিজে উদ্ধার করো। তুমিই তোমার বন্ধু অথবা শত্রু। (গীতা ৬.৫)',
    description: 'You are responsible for your own growth. No one can learn for you.',
    description_bn: 'তোমার বৃদ্ধির দায়িত্ব তোমার নিজের। তোমার হয়ে কেউ শিখতে পারবে না।',
    dimension_codes: ['discipline', 'time_management', 'focus'],
    daily_practices: [
      'Set a study schedule and follow it — even when you don\'t feel like it',
      'Put your phone away during study time',
      'Track your own progress honestly — are you doing what you said you would?',
    ],
    daily_practices_bn: [
      'একটি পড়ার সময়সূচি তৈরি করো এবং মানো — মন না চাইলেও',
      'পড়ার সময় ফোন দূরে রাখো',
      'সৎভাবে নিজের অগ্রগতি ট্র্যাক করো — তুমি কি যা বলেছিলে তা করছো?',
    ],
    age_framing: {
      '6-9': 'You are the boss of you! When you sit down to study, your brain says "thank you!"',
      '10-12': 'The Gita says you can be your own best friend. How? By doing what you know is right.',
      '13-15': 'Self-discipline is not punishment — it\'s freedom. Disciplined people have more free time, not less.',
      '16-18': 'Atma-sanyama: the ability to choose long-term growth over short-term comfort. This is the real skill.',
    },
  },

  // =========================================================================
  // FROM SHASTRA — Dharma, Vidya, Ethics
  // =========================================================================
  {
    code: 'vidya',
    name: 'Love of Learning (Vidya)',
    name_bn: 'বিদ্যা',
    source: 'shastra',
    source_text: 'Sa Vidya Ya Vimuktaye — True education is that which liberates. (Vishnu Purana)',
    source_text_bn: 'সা বিদ্যা যা বিমুক্তয়ে — প্রকৃত বিদ্যা তাই যা মুক্তি দেয়। (বিষ্ণু পুরাণ)',
    description: 'Learn not just to pass exams, but to free your mind and understand the world.',
    description_bn: 'শুধু পরীক্ষায় পাশ করার জন্য নয়, মনকে মুক্ত করতে এবং পৃথিবী বুঝতে শেখো।',
    dimension_codes: ['curiosity', 'self_learning', 'reasoning'],
    daily_practices: [
      'Ask "why?" at least once during every lesson',
      'Read or learn something beyond your textbook today',
      'Connect what you learned today with real life',
    ],
    daily_practices_bn: [
      'প্রতিটি পাঠে কমপক্ষে একবার "কেন?" জিজ্ঞেস করো',
      'আজ পাঠ্যবইয়ের বাইরে কিছু পড়ো বা শেখো',
      'আজ যা শিখলে তা বাস্তব জীবনের সাথে সংযুক্ত করো',
    ],
    age_framing: {
      '6-9': 'Learning is like a treasure hunt — every new thing you discover is a treasure!',
      '10-12': 'The ancient scholars said: real education makes you free. Free to think, free to question!',
      '13-15': 'Vidya means knowledge that transforms you — not just information you memorize and forget.',
      '16-18': 'Sa Vidya Ya Vimuktaye. Education that doesn\'t change how you think is just memorization.',
    },
  },
  {
    code: 'dharma',
    name: 'Doing What Is Right (Dharma)',
    name_bn: 'ধর্ম (কর্তব্য)',
    source: 'shastra',
    source_text: 'Dharmo Rakshati Rakshitah — Dharma protects those who protect it. (Manusmriti)',
    source_text_bn: 'ধর্মো রক্ষতি রক্ষিতঃ — ধর্ম তাকে রক্ষা করে যে ধর্মকে রক্ষা করে। (মনুস্মৃতি)',
    description: 'Dharma here means duty and doing the right thing — not religion. Do what you know is right, even when no one is watching.',
    description_bn: 'এখানে ধর্ম মানে কর্তব্য এবং সঠিক কাজ করা — ধর্মীয় বিশ্বাস নয়। কেউ না দেখলেও যা সঠিক তা করো।',
    dimension_codes: ['responsibility', 'honesty', 'social_conduct'],
    daily_practices: [
      'Do your homework properly even if no one checks',
      'Stand up for someone being treated unfairly',
      'Keep your promises — if you said you\'d do something, do it',
    ],
    daily_practices_bn: [
      'কেউ না দেখলেও বাড়ির কাজ সঠিকভাবে করো',
      'কারও সাথে অন্যায় হলে তার পাশে দাঁড়াও',
      'প্রতিশ্রুতি রক্ষা করো — যা করবে বলেছো তা করো',
    ],
    age_framing: {
      '6-9': 'Doing the right thing makes you a hero — even when no one is watching!',
      '10-12': 'Dharma means doing your duty. Your duty right now? Learn well, be kind, be honest.',
      '13-15': 'When you do what\'s right consistently, you build a reputation that opens doors.',
      '16-18': 'Dharma is not about following rules. It\'s about developing an internal compass for what is just.',
    },
  },
  {
    code: 'vinaya',
    name: 'Humility (Vinaya)',
    name_bn: 'বিনয়',
    source: 'shastra',
    source_text: 'Vidya dadati vinayam — Knowledge gives humility. (Hitopadesha)',
    source_text_bn: 'বিদ্যা দদাতি বিনয়ম্ — বিদ্যা বিনয় দান করে। (হিতোপদেশ)',
    description: 'The more you learn, the more you realize how much there is to learn. Stay humble.',
    description_bn: 'যত বেশি শেখো, তত বুঝতে পারো কতটা শেখার বাকি আছে। বিনয়ী থাকো।',
    dimension_codes: ['social_conduct', 'curiosity', 'emotional_regulation'],
    daily_practices: [
      'When you know the answer, help others understand instead of showing off',
      'Listen to others\' ideas with genuine interest, even if you disagree',
      'Say "I learned something new today" at least once',
    ],
    daily_practices_bn: [
      'উত্তর জানলে জাহির না করে অন্যদের বুঝতে সাহায্য করো',
      'অন্যদের মতামত আন্তরিক আগ্রহে শোনো, এমনকি তুমি একমত না হলেও',
      'দিনে অন্তত একবার বলো "আমি আজ নতুন কিছু শিখলাম"',
    ],
    age_framing: {
      '6-9': 'Smart people know something cool — there\'s ALWAYS more to learn!',
      '10-12': 'The Hitopadesha says: real knowledge makes you humble, not proud.',
      '13-15': 'The smartest people in any room are usually the ones listening, not the ones talking.',
      '16-18': 'Intellectual humility is a superpower. It keeps you learning when others think they know it all.',
    },
  },

  // =========================================================================
  // FROM BRATACHARI — Gurusaday Dutt's 5 Vows (Pancha-Brata)
  // =========================================================================
  {
    code: 'jnana_brata',
    name: 'Vow of Knowledge (Jnana Brata)',
    name_bn: 'জ্ঞানব্রত',
    source: 'bratachari',
    source_text: 'Bratachari\'s first vow: pursue knowledge relentlessly. A Bratachari seeks to learn from everything — books, nature, people, experience.',
    source_text_bn: 'ব্রতচারীর প্রথম ব্রত: জ্ঞান অর্জনে অবিচল থাকা। একজন ব্রতচারী সবকিছু থেকে শেখে — বই, প্রকৃতি, মানুষ, অভিজ্ঞতা।',
    description: 'Commit to learning from every source — not just textbooks. The world is your classroom.',
    description_bn: 'শুধু পাঠ্যবই নয়, সব উৎস থেকে শেখার প্রতিজ্ঞা করো। পৃথিবীটাই তোমার ক্লাসরুম।',
    dimension_codes: ['curiosity', 'self_learning', 'reasoning'],
    daily_practices: [
      'Learn one thing today from outside your textbook — nature, a conversation, an observation',
      'Ask a question that your textbook doesn\'t answer',
      'Teach something you learned today to someone at home',
    ],
    daily_practices_bn: [
      'আজ পাঠ্যবইয়ের বাইরে একটি জিনিস শেখো — প্রকৃতি, কথোপকথন, বা পর্যবেক্ষণ থেকে',
      'এমন একটি প্রশ্ন করো যার উত্তর পাঠ্যবইতে নেই',
      'আজ যা শিখেছো তা বাড়ির কাউকে শেখাও',
    ],
    age_framing: {
      '6-9': 'Bratachari says: learn from everything! What did the trees teach you today?',
      '10-12': 'A true learner doesn\'t stop at the textbook. Look around — knowledge is everywhere.',
      '13-15': 'The Bratachari vow of knowledge: be curious about everything, not just what\'s on the exam.',
      '16-18': 'Jnana Brata reminds us: education is not preparation for life — education IS life.',
    },
  },
  {
    code: 'shrama_brata',
    name: 'Vow of Labor (Shrama Brata)',
    name_bn: 'শ্রমব্রত',
    source: 'bratachari',
    source_text: 'Bratachari\'s second vow: dignity of labor. No work is beneath you. Physical and mental work both deserve respect.',
    source_text_bn: 'ব্রতচারীর দ্বিতীয় ব্রত: শ্রমের মর্যাদা। কোনো কাজই ছোট নয়। শারীরিক ও মানসিক উভয় শ্রমই সম্মানের যোগ্য।',
    description: 'Respect all forms of work. Study is work. Helping at home is work. No work is small.',
    description_bn: 'সব ধরনের কাজকে সম্মান করো। পড়াশোনাও কাজ। বাড়িতে সাহায্য করাও কাজ। কোনো কাজই ছোট নয়।',
    dimension_codes: ['responsibility', 'discipline', 'practical_skills'],
    daily_practices: [
      'Do one household chore today without being asked',
      'Clean your study space before starting work',
      'Thank someone who does work that often goes unnoticed — a helper, a cleaner, a cook',
    ],
    daily_practices_bn: [
      'আজ কেউ না বলেও বাড়ির একটি কাজ করো',
      'পড়া শুরু করার আগে পড়ার জায়গা পরিষ্কার করো',
      'যাঁদের কাজ চোখে পড়ে না — সাহায্যকারী, পরিচ্ছন্নতাকর্মী, রাঁধুনি — তাঁদের ধন্যবাদ দাও',
    ],
    age_framing: {
      '6-9': 'Helping is fun! Can you tidy up your books and help at home today?',
      '10-12': 'Bratachari teaches: no work is too small. The person who cleans your school deserves your respect.',
      '13-15': 'Dignity of labor means valuing effort in every form — from sweeping to studying.',
      '16-18': 'Shrama Brata: in a world that glorifies shortcuts, commit to honest hard work.',
    },
  },
  {
    code: 'satya_brata',
    name: 'Vow of Truth (Satya Brata)',
    name_bn: 'সত্যব্রত',
    source: 'bratachari',
    source_text: 'Bratachari\'s third vow: commitment to truth in thought, word, and deed.',
    source_text_bn: 'ব্রতচারীর তৃতীয় ব্রত: চিন্তা, কথা ও কাজে সত্যের প্রতি অঙ্গীকার।',
    description: 'Be true in what you think, what you say, and what you do. Let all three match.',
    description_bn: 'তুমি যা ভাবো, যা বলো, এবং যা করো — তিনটি যেন এক হয়।',
    dimension_codes: ['honesty', 'confidence', 'responsibility'],
    daily_practices: [
      'Before saying something, ask: "Is this true? Is it kind? Is it necessary?"',
      'If you copied homework, redo it yourself — even if no one found out',
      'Share your honest opinion respectfully, even when it\'s unpopular',
    ],
    daily_practices_bn: [
      'কিছু বলার আগে জিজ্ঞেস করো: "এটা কি সত্য? এটা কি দয়ালু? এটা কি প্রয়োজনীয়?"',
      'যদি বাড়ির কাজ কপি করে থাকো, নিজে আবার করো — কেউ না জানলেও',
      'তোমার সৎ মতামত সম্মানের সাথে জানাও, এমনকি যখন তা জনপ্রিয় নয়',
    ],
    age_framing: {
      '6-9': 'Telling the truth makes you brave! Even when it\'s a little scary.',
      '10-12': 'Bratachari says: match your thoughts, words, and actions. That\'s what integrity means.',
      '13-15': 'Satya Brata: be honest with yourself first. Self-deception is the biggest obstacle to growth.',
      '16-18': 'Truth in thought, word, and deed — this alignment is what people call authenticity.',
    },
  },
  {
    code: 'aikya_brata',
    name: 'Vow of Unity (Aikya Brata)',
    name_bn: 'ঐক্যব্রত',
    source: 'bratachari',
    source_text: 'Bratachari\'s fourth vow: unity with all. Break barriers of caste, class, and prejudice. See every person as equal.',
    source_text_bn: 'ব্রতচারীর চতুর্থ ব্রত: সকলের সাথে ঐক্য। জাতি, শ্রেণি, ও কুসংস্কারের বাধা ভাঙো। প্রতিটি মানুষকে সমান দেখো।',
    description: 'Work with everyone regardless of their background. Team up, lift each other up.',
    description_bn: 'সকলের সাথে মিলে কাজ করো, তাদের পরিচয় যাই হোক। দলবদ্ধ হও, একে অপরকে উপরে তোলো।',
    dimension_codes: ['teamwork', 'empathy', 'social_conduct'],
    daily_practices: [
      'Include someone who is usually left out in group activities',
      'Learn one thing about a classmate\'s culture or background',
      'In a group project, make sure everyone\'s voice is heard',
    ],
    daily_practices_bn: [
      'যাকে সাধারণত দলের কাজে বাদ দেওয়া হয় তাকে অন্তর্ভুক্ত করো',
      'একজন সহপাঠীর সংস্কৃতি বা পরিবেশ সম্পর্কে একটি জিনিস জানো',
      'দলগত কাজে সবার কথা শোনা হচ্ছে কিনা নিশ্চিত করো',
    ],
    age_framing: {
      '6-9': 'Everyone is different and that\'s awesome! Play with someone new today!',
      '10-12': 'Bratachari says: we are all one team. Include everyone, especially those left out.',
      '13-15': 'Unity doesn\'t mean agreeing on everything. It means respecting everyone\'s dignity.',
      '16-18': 'Aikya Brata: in a divided world, building bridges across differences is a radical act.',
    },
  },
  {
    code: 'ananda_brata',
    name: 'Vow of Joy (Ananda Brata)',
    name_bn: 'আনন্দব্রত',
    source: 'bratachari',
    source_text: 'Bratachari\'s fifth vow: find joy in learning, working, and living. Joy is not the absence of hardship — it is the choice to engage fully with life.',
    source_text_bn: 'ব্রতচারীর পঞ্চম ব্রত: শেখা, কাজ করা এবং জীবনযাপনে আনন্দ খোঁজো। আনন্দ মানে কষ্টের অনুপস্থিতি নয় — জীবনকে পূর্ণভাবে গ্রহণ করার সিদ্ধান্ত।',
    description: 'Find joy in the process of learning, not just the destination. Make studying fun.',
    description_bn: 'শুধু গন্তব্যে নয়, শেখার প্রক্রিয়ায় আনন্দ খোঁজো। পড়াশোনাকে মজার করো।',
    dimension_codes: ['curiosity', 'emotional_regulation', 'confidence'],
    daily_practices: [
      'Find one thing interesting or fun in every subject you study today',
      'Laugh at your mistakes — they\'re proof you\'re trying',
      'Celebrate small wins: "I understood that concept!" counts',
    ],
    daily_practices_bn: [
      'আজ যে বিষয়ই পড়ো, তাতে একটি মজার বা আকর্ষণীয় জিনিস খোঁজো',
      'ভুলের জন্য হাসো — এটা প্রমাণ যে তুমি চেষ্টা করছো',
      'ছোট জয় উদযাপন করো: "আমি সেই ধারণাটি বুঝেছি!" — এটাও গণ্য',
    ],
    age_framing: {
      '6-9': 'Learning is an adventure! What\'s the coolest thing you discovered today?',
      '10-12': 'Bratachari says: find JOY in learning! Not everything has to be serious.',
      '13-15': 'If you\'re not enjoying the process, you won\'t sustain it. Make learning YOUR way.',
      '16-18': 'Ananda Brata: choose to engage with life fully. Even hard things can be deeply satisfying.',
    },
  },
];

/**
 * Get character values appropriate for a student's age
 */
export function getCharacterValuesForAge(classLevel: number): CharacterValue[] {
  return CHARACTER_VALUES; // All values apply to all ages, framing changes
}

/**
 * Get the age-appropriate framing for a character value
 */
export function getAgeFraming(value: CharacterValue, classLevel: number): string {
  if (classLevel <= 3) return value.age_framing['6-9'];
  if (classLevel <= 6) return value.age_framing['10-12'];
  if (classLevel <= 9) return value.age_framing['13-15'];
  return value.age_framing['16-18'];
}

/**
 * Get a random daily practice for a character value
 */
export function getDailyPractice(value: CharacterValue, lang: string = 'en'): string {
  const practices = lang === 'bn' ? value.daily_practices_bn : value.daily_practices;
  return practices[Math.floor(Math.random() * practices.length)];
}

/**
 * Get source quote for a character value
 */
export function getSourceQuote(value: CharacterValue, lang: string = 'en'): string {
  if (lang === 'bn') return value.source_text_bn || value.source_text || '';
  return value.source_text || '';
}
