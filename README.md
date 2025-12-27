# 🧠 MyCupIsEmpty - AI-Powered Adaptive Learning Platform

An AI-powered, personalized learning platform for NCERT curriculum (Classes 1-12) that adapts to each student's unique learning style using 15+ scientific learning methods.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)

## ✨ Features

### 🎯 Personalized Learning
- **VARK Assessment**: Discover if you're a Visual, Auditory, Reading, or Kinesthetic learner
- **Adaptive Content**: Content automatically adapts to your learning style
- **Multiple Intelligences**: Track and develop all 8 of Gardner's intelligences

### 📚 Complete NCERT Curriculum
- Classes 1-12 coverage
- All major subjects (Math, Science, English, Hindi, Social Science, etc.)
- Aligned with latest NCERT syllabus (2024-25)
- Chapter-wise content with topics, definitions, and formulas

### 🤖 AI Tutor (Powered by Ollama)
- Ask questions in your preferred learning style
- Step-by-step problem solving
- Instant doubt clearing
- Personalized explanations

### 🎮 Gamification
- XP points and leveling system
- Daily streaks and achievements
- Progress tracking and analytics
- Leaderboards and challenges

### 📊 Learning Methods
- Bloom's Taxonomy question levels
- Spaced repetition for long-term retention
- Mastery-based progression
- Project-based learning modules

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, Framer Motion |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| AI/LLM | Ollama (on Oracle Cloud) |
| Hosting | Vercel |
| State Management | Zustand |
| Charts | Recharts |

## 📁 Project Structure

```
mycupisempty/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, signup)
│   │   ├── (dashboard)/       # Protected pages
│   │   └── api/               # API routes
│   ├── components/            # React components
│   ├── lib/                   # Utilities
│   │   ├── supabase.ts       # Supabase client
│   │   └── ollama.ts         # AI integration
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript types
│   └── styles/               # Global CSS
├── scripts/
│   └── ncert-scraper.ts      # NCERT content scraper
├── supabase/
│   └── migrations/           # Database schema
├── public/                   # Static assets
└── docs/                     # Documentation
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Oracle Cloud account (for Ollama hosting)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/mycupisempty.git
cd mycupisempty
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file:
   ```sql
   -- Copy contents from supabase/migrations/001_initial_schema.sql
   ```
3. Get your API keys from Project Settings > API

### 3. Set Up Ollama on Oracle Cloud

1. Create a free Oracle Cloud account
2. Launch an Ampere A1 VM (free tier: 4 OCPUs, 24GB RAM)
3. Install Ollama:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ollama pull llama3.2
   ollama serve --host 0.0.0.0
   ```
4. Configure firewall to allow port 11434

### 4. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OLLAMA_BASE_URL=http://your-oracle-vm-ip:11434
```

### 5. Seed the Database

```bash
npm run seed
# Or call the API endpoint:
# POST /api/curriculum { "action": "seed" }
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🌐 Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy!

```bash
# Or use Vercel CLI
npm i -g vercel
vercel --prod
```

## 📖 NCERT Content Legal Notice

NCERT textbooks are published by the Government of India's National Council of Educational Research and Training. They are:
- Freely available at [ncert.nic.in](https://ncert.nic.in/textbook.php)
- Intended for educational purposes
- Not under traditional commercial copyright

This platform uses NCERT content for educational purposes with proper attribution.

## 🤖 AI Features

### Learning Style Adaptation

The AI tutor adapts its responses based on your VARK profile:

| Style | Approach |
|-------|----------|
| 👁️ Visual | Diagrams, charts, visual metaphors |
| 👂 Auditory | Conversational tone, mnemonics |
| 📖 Reading | Detailed text, definitions, references |
| 🖐️ Kinesthetic | Hands-on activities, experiments |

### Bloom's Taxonomy Questions

Questions are categorized by cognitive level:
1. **Remember** - Recall facts
2. **Understand** - Explain concepts
3. **Apply** - Use in new situations
4. **Analyze** - Break down information
5. **Evaluate** - Make judgments
6. **Create** - Produce new ideas

## 📊 Database Schema

Key tables:
- `profiles` - User information
- `learning_styles` - VARK scores
- `classes/subjects/chapters/topics` - Curriculum structure
- `questions` - Question bank
- `user_topic_progress` - Learning progress
- `user_stats` - XP, streaks, achievements

See `supabase/migrations/001_initial_schema.sql` for full schema.

## 🧪 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/chat` | POST | AI tutor conversation |
| `/api/curriculum` | GET | Get curriculum data |
| `/api/curriculum` | POST | Seed curriculum (admin) |

## 🎨 Screenshots

Coming soon!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- NCERT for free educational content
- Supabase for the amazing database platform
- Ollama for open-source LLM hosting
- Vercel for seamless deployment

## 📞 Support

- 📧 Email: support@mycupisempty.com
- 💬 Discord: [Join our community](https://discord.gg/mycupisempty)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/mycupisempty/issues)

---

Made with ❤️ for Indian students

**"Fill your cup with knowledge!"** 🧠
