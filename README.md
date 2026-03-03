# cf_ai_smart_study_agent

AI-powered study companion built on [Cloudflare Workers](https://developers.cloudflare.com/workers/) + [Agents SDK](https://developers.cloudflare.com/agents/). Chat with an AI tutor that generates flashcards, quizzes you on topics, summarizes concepts, tracks your study progress, and sends you reminders to keep studying.

Built with GLM-4.7-Flash (Workers AI), Durable Objects for persistent state, and React for the chat frontend.

## What it does

- **Flashcard generation** — ask for flashcards on any topic and it creates Q&A pairs at your chosen difficulty
- **Quizzes** — multiple-choice quizzes with scoring, adjustable difficulty
- **Topic summaries** — get brief or comprehensive breakdowns of any subject
- **Progress tracking** — tracks what you've studied, your daily streak, and session history (persisted in SQLite via Durable Objects)
- **Study reminders** — schedule one-time or recurring reminders using natural language ("remind me in 30 min", "every day at 8am")
- **Timezone-aware** — detects your browser timezone to schedule reminders correctly (client-side tool)
- **Data safety** — resetting your progress requires explicit approval (human-in-the-loop pattern)

## How it's built

The app runs entirely on Cloudflare's stack:

| Component           | What it does                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Workers AI**      | Runs GLM-4.7-Flash (`@cf/zai-org/glm-4.7-flash`) for chat + tool calling — no external API keys |
| **Durable Objects** | Each user gets their own agent instance with SQLite for chat history + study state              |
| **AIChatAgent**     | Handles streaming AI responses, tool execution, message persistence, and WebSocket connections  |
| **Scheduling**      | Uses Durable Object alarms for delayed/cron/scheduled study reminders                           |
| **React + Vite**    | Chat UI with a study progress sidebar, Cloudflare's Kumo design system                          |

```
React Chat UI  ←— WebSocket —→  StudyBot Agent (Durable Object)
                                    ├── GLM-4.7-Flash via Workers AI
                                    ├── Tools (flashcards, quiz, summarize, etc.)
                                    ├── State (topics, streaks, session count)
                                    ├── Scheduling (study reminders)
                                    └── SQLite (message + state persistence)
```

## Getting started

**Prerequisites:** Node.js 18+, a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works fine)

```bash
# clone and install
git clone https://github.com/YOUR_USERNAME/cf_ai_smart_study_agent.git
cd cf_ai_smart_study_agent
npm install

# login to cloudflare (needed for Workers AI)
npx wrangler login

# start dev server
npm run dev
```

Open http://localhost:5173 and start chatting.

### Deploy

```bash
npm run deploy
```

Goes live at `https://cf-ai-smart-study-agent.<your-subdomain>.workers.dev`.

## Try these prompts

- "Generate flashcards about photosynthesis" — creates flashcard Q&A pairs
- "Quiz me on World War II" — multiple-choice quiz
- "Summarize quantum mechanics" — concise topic breakdown
- "Show my study progress" — see your stats dashboard
- "What timezone am I in?" — browser provides the timezone
- "Reset my study progress" — triggers approval dialog
- "Remind me to study bio in 30 minutes" — sets a timed reminder
- "Schedule daily study at 8am" — recurring cron reminder

## Project structure

```
src/
  server.ts    — the study agent: LLM config, tools, state management, scheduling
  app.tsx      — React chat UI with progress sidebar
  client.tsx   — React entry point
  styles.css   — Tailwind + Kumo styles
wrangler.jsonc — Cloudflare worker config (AI binding, Durable Objects, SQLite migrations)
```

## Tech stack

- Cloudflare Workers + Durable Objects
- Workers AI (GLM-4.7-Flash)
- Agents SDK (`@cloudflare/ai-chat`, `agents`)
- Vercel AI SDK for streaming and tool patterns
- React 19, Vite, Tailwind v4
- TypeScript

## License

MIT
