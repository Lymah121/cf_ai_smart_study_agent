import { createWorkersAI } from "workers-ai-provider";
import { routeAgentRequest, callable, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  streamText,
  convertToModelMessages,
  pruneMessages,
  tool,
  stepCountIs,
} from "ai";
import { z } from "zod";

// ── State types ───────────────────────────────────────────────────────

type StudyState = {
  topicsStudied: string[];
  flashcardsGenerated: number;
  quizzesTaken: number;
  summariesCreated: number;
  currentStreak: number;
  lastStudyDate: string | null;
  totalSessions: number;
};

// ── Study Agent ───────────────────────────────────────────────────────

export class ChatAgent extends AIChatAgent<Env, StudyState> {
  initialState: StudyState = {
    topicsStudied: [],
    flashcardsGenerated: 0,
    quizzesTaken: 0,
    summariesCreated: 0,
    currentStreak: 0,
    lastStudyDate: null,
    totalSessions: 0,
  };

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI });

    // Update study streak on each interaction
    this._updateStreak();

    // Use glm-4.7-flash which properly supports tool calling via Workers AI
    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system: `You are StudyBot, an AI study companion. Your job is to help users learn effectively.

When users want to study a topic, you should:
1. First call the trackStudyActivity tool to log the activity
2. Then provide the actual content (flashcards, quiz, or summary) in your response

For FLASHCARDS: Create numbered Q&A pairs with "Q:" and "A:" format.
For QUIZZES: Create multiple-choice questions with options A-D and the answer.
For SUMMARIES: Use headings, bullet points, and key takeaways.
For general questions: Just answer clearly and helpfully.

Always use the trackStudyActivity tool before generating study content.
Use getStudyProgress when the user asks about their stats.

${getSchedulePrompt({ date: new Date() })}

Be encouraging, use markdown formatting, and keep things clear.`,

      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
      }),

      tools: {
        // Tracks study activity in persistent state
        trackStudyActivity: tool({
          description:
            "Track a study activity. Call this whenever you generate flashcards, create a quiz, or summarize a topic. This updates the user's study progress dashboard.",
          inputSchema: z.object({
            topic: z.string().describe("The topic being studied"),
            activityType: z
              .enum(["flashcards", "quiz", "summary"])
              .describe("Type of study activity"),
            count: z
              .number()
              .optional()
              .describe("Number of items generated"),
          }),
          execute: async ({ topic, activityType, count }) => {
            this._addTopic(topic);
            const updates = { ...this.state };
            if (activityType === "flashcards") {
              updates.flashcardsGenerated += count || 5;
            } else if (activityType === "quiz") {
              updates.quizzesTaken += 1;
            } else if (activityType === "summary") {
              updates.summariesCreated += 1;
            }
            this.setState(updates);
            return {
              tracked: true,
              topic,
              activityType,
              message: `Tracked ${activityType} activity for "${topic}". Now generate the ${activityType} content for the user.`,
            };
          },
        }),

        // Returns study progress stats
        getStudyProgress: tool({
          description:
            "Get the user's study progress. Use when they ask about their stats, progress, or history.",
          inputSchema: z.object({}),
          execute: async () => {
            return {
              topicsStudied: this.state.topicsStudied,
              totalTopics: this.state.topicsStudied.length,
              flashcardsGenerated: this.state.flashcardsGenerated,
              quizzesTaken: this.state.quizzesTaken,
              summariesCreated: this.state.summariesCreated,
              currentStreak: this.state.currentStreak,
              lastStudyDate: this.state.lastStudyDate,
              totalSessions: this.state.totalSessions,
            };
          },
        }),

        // Client-side tool — browser provides the timezone
        getUserTimezone: tool({
          description:
            "Get the user's timezone from their browser for scheduling.",
          inputSchema: z.object({}),
        }),

        // Approval-gated — user must confirm
        resetStudyProgress: tool({
          description: "Reset all study progress. Requires user approval.",
          inputSchema: z.object({
            confirmation: z
              .string()
              .describe('Should be "reset"'),
          }),
          needsApproval: async () => true,
          execute: async () => {
            this.setState({
              topicsStudied: [],
              flashcardsGenerated: 0,
              quizzesTaken: 0,
              summariesCreated: 0,
              currentStreak: 0,
              lastStudyDate: null,
              totalSessions: 0,
            });
            return { success: true, message: "Study progress has been reset." };
          },
        }),

        // Schedule study reminders
        scheduleStudyReminder: tool({
          description:
            "Schedule a study reminder. Use when the user wants to be reminded to study.",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") {
              return "Not a valid schedule input";
            }
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) return "Invalid schedule type";
            try {
              this.schedule(input, "executeTask", description);
              return `Reminder scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling: ${error}`;
            }
          },
        }),

        getScheduledReminders: tool({
          description: "List all scheduled study reminders",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules();
            return tasks.length > 0 ? tasks : "No reminders scheduled.";
          },
        }),

        cancelReminder: tool({
          description: "Cancel a scheduled reminder by its ID",
          inputSchema: z.object({
            reminderId: z.string().describe("Reminder ID to cancel"),
          }),
          execute: async ({ reminderId }) => {
            try {
              this.cancelSchedule(reminderId);
              return `Reminder ${reminderId} cancelled.`;
            } catch (error) {
              return `Error cancelling: ${error}`;
            }
          },
        }),
      },

      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal,
    });

    return result.toUIMessageStreamResponse();
  }

  // Runs when a scheduled reminder fires
  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`Study reminder fired: ${description}`);
    this.broadcast(
      JSON.stringify({
        type: "study-reminder",
        description,
        timestamp: new Date().toISOString(),
      })
    );
  }

  @callable()
  async getProgress(): Promise<StudyState> {
    return this.state;
  }

  private _addTopic(topic: string) {
    const normalized = topic.toLowerCase().trim();
    if (!this.state.topicsStudied.includes(normalized)) {
      this.setState({
        ...this.state,
        topicsStudied: [...this.state.topicsStudied, normalized],
      });
    }
  }

  private _updateStreak() {
    const today = new Date().toISOString().split("T")[0];
    const lastDate = this.state.lastStudyDate;
    if (lastDate === today) return;

    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    this.setState({
      ...this.state,
      currentStreak: lastDate === yesterday ? this.state.currentStreak + 1 : 1,
      lastStudyDate: today,
      totalSessions: this.state.totalSessions + 1,
    });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
