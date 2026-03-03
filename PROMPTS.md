# PROMPTS.md

AI-assisted development was used throughout this project. Below are the key prompts and how they shaped the implementation.

## Research phase

I started by asking the AI assistant to research Cloudflare's Agents SDK, Workers AI, and the agents-starter template. The main prompt was:

> Research the Cloudflare Agents SDK documentation, understand the AIChatAgent class, state management, scheduling APIs, and the agents-starter template structure. I need to build an AI app that uses an LLM, has workflow coordination, accepts chat input, and maintains state.

This research covered:
- The `AIChatAgent` class and how it extends Durable Objects with built-in SQLite
- How `useAgentChat` and `useAgent` React hooks connect via WebSocket
- The three tool patterns: server-side (auto-execute), client-side (browser-provided), and approval-gated
- Scheduling via `this.schedule()` with delay, date, and cron modes
- State management with `this.setState()` and real-time client sync

## Architecture design

> Design a study-focused AI agent that naturally uses all four tool types. The agent should track what the user studies, maintain a study streak, and let users schedule reminders. Make the tools actually useful, not just demos.

This led to:
- **generateFlashcards** / **createQuiz** / **summarizeTopic** as server-side tools that also update study state
- **getUserTimezone** as a client-side tool (no `execute` fn — browser provides the result)
- **resetStudyProgress** as an approval-gated tool (always requires user confirmation)
- **scheduleStudyReminder** using Cloudflare's scheduling system for study reminders
- **StudyState** type tracking topics, flashcard counts, quiz history, streak, and sessions

## Server implementation

> Write the server.ts with Llama 3.3 on Workers AI. Include study tools that update persistent state, a streak calculation system, and study reminder scheduling.

Key decisions made with AI assistance:
- Used `@cf/meta/llama-3.3-70b-instruct-fp8-fast` as the model
- Study streak logic: checks if last study date was yesterday (increment) or earlier (reset to 1)
- Topic normalization: lowercase + trim to avoid duplicates
- Tool outputs include context that helps the LLM generate better follow-up responses

## Frontend customization

> Customize the agents-starter UI for a study theme. Add a progress sidebar that syncs from agent state, study-specific suggested prompts, friendly tool labels, and toast notifications for study reminders.

Changes from the starter template:
- Added `StudyProgressSidebar` component with real-time stat cards
- Changed branding from "Agent Starter" to "StudyBot"
- Added study-specific suggested prompts
- Custom tool label mapping for friendlier display names
- Study reminder toast notifications via `onMessage` handler
- Removed MCP server panel (not needed for this use case)

## Documentation

> Write a README with setup instructions, usage examples, and a clear explanation of the architecture. Keep it concise and practical.

The README was drafted with AI assistance and edited for clarity and natural tone.
