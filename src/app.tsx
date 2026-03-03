import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import {
  Button,
  Badge,
  InputArea,
  Empty,
  Surface,
  Text
} from "@cloudflare/kumo";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { Streamdown } from "streamdown";
import { Switch } from "@cloudflare/kumo";
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  GearIcon,
  CircleIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  BrainIcon,
  CaretDownIcon,
  BugIcon,
  BookOpenIcon,
  LightningIcon,
  ChartBarIcon,
  ClockIcon,
  CardsThreeIcon,
  ExamIcon,
  ListBulletsIcon,
  ArrowCounterClockwiseIcon,
  SidebarIcon
} from "@phosphor-icons/react";

// ── Types ─────────────────────────────────────────────────────────────

type StudyState = {
  topicsStudied: string[];
  flashcardsGenerated: number;
  quizzesTaken: number;
  summariesCreated: number;
  currentStreak: number;
  lastStudyDate: string | null;
  totalSessions: number;
};

// ── Theme toggle ──────────────────────────────────────────────────────

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-mode") === "dark"
  );

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    const mode = next ? "dark" : "light";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme", mode);
  }, [dark]);

  return (
    <Button
      variant="secondary"
      shape="square"
      icon={dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      onClick={toggle}
      aria-label="Toggle theme"
    />
  );
}

// ── Study progress sidebar ────────────────────────────────────────────

function StudyProgressSidebar({
  studyState,
  visible
}: {
  studyState: StudyState;
  visible: boolean;
}) {
  if (!visible) return null;

  const stats = [
    {
      label: "Topics Studied",
      value: studyState.topicsStudied.length,
      icon: <BookOpenIcon size={18} className="text-blue-400" />
    },
    {
      label: "Flashcards",
      value: studyState.flashcardsGenerated,
      icon: <CardsThreeIcon size={18} className="text-amber-400" />
    },
    {
      label: "Quizzes Taken",
      value: studyState.quizzesTaken,
      icon: <ExamIcon size={18} className="text-green-400" />
    },
    {
      label: "Summaries",
      value: studyState.summariesCreated,
      icon: <ListBulletsIcon size={18} className="text-purple-400" />
    },
    {
      label: "Study Streak",
      value: `${studyState.currentStreak} day${studyState.currentStreak !== 1 ? "s" : ""}`,
      icon: <LightningIcon size={18} className="text-orange-400" />
    },
    {
      label: "Total Sessions",
      value: studyState.totalSessions,
      icon: <ClockIcon size={18} className="text-cyan-400" />
    }
  ];

  return (
    <div className="w-72 border-l border-kumo-line bg-kumo-base overflow-y-auto flex-shrink-0 hidden lg:block">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <ChartBarIcon size={20} className="text-kumo-accent" />
          <Text size="sm" bold>
            Study Progress
          </Text>
        </div>

        {/* Stats grid */}
        <div className="space-y-3">
          {stats.map((stat) => (
            <Surface
              key={stat.label}
              className="p-3 rounded-xl ring ring-kumo-line"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">{stat.icon}</div>
                <div className="flex-1 min-w-0">
                  <Text size="xs" variant="secondary">
                    {stat.label}
                  </Text>
                  <div className="text-lg font-bold text-kumo-default">
                    {stat.value}
                  </div>
                </div>
              </div>
            </Surface>
          ))}
        </div>

        {/* Topics list */}
        {studyState.topicsStudied.length > 0 && (
          <div className="mt-5">
            <span className="mb-2 block">
              <Text size="xs" variant="secondary" bold>
                Recent Topics
              </Text>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {studyState.topicsStudied.slice(-8).map((topic) => (
                <Badge key={topic} variant="secondary">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Last study date */}
        {studyState.lastStudyDate && (
          <div className="mt-4 pt-4 border-t border-kumo-line">
            <Text size="xs" variant="secondary">
              Last studied: {studyState.lastStudyDate}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tool part view ────────────────────────────────────────────────────

function ToolPartView({
  part,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);

  // Map tool names to friendly labels
  const toolLabels: Record<string, string> = {
    generateFlashcards: "📇 Generate Flashcards",
    createQuiz: "📝 Create Quiz",
    summarizeTopic: "📋 Summarize Topic",
    getStudyProgress: "📊 Study Progress",
    getUserTimezone: "🕐 Get Timezone",
    resetStudyProgress: "🔄 Reset Progress",
    scheduleStudyReminder: "⏰ Schedule Reminder",
    getScheduledReminders: "📅 List Reminders",
    cancelReminder: "❌ Cancel Reminder"
  };

  const displayName = toolLabels[toolName] || toolName;

  // Completed
  if (part.state === "output-available") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2 mb-1">
            <GearIcon size={14} className="text-kumo-inactive" />
            <Text size="xs" variant="secondary" bold>
              {displayName}
            </Text>
            <Badge variant="secondary">Done</Badge>
          </div>
          <div className="font-mono">
            <Text size="xs" variant="secondary">
              {JSON.stringify(part.output, null, 2)}
            </Text>
          </div>
        </Surface>
      </div>
    );
  }

  // Needs approval
  if ("approval" in part && part.state === "approval-requested") {
    const approvalId = (part.approval as { id?: string })?.id;
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-3 rounded-xl ring-2 ring-kumo-warning">
          <div className="flex items-center gap-2 mb-2">
            <ArrowCounterClockwiseIcon
              size={14}
              className="text-kumo-warning"
            />
            <Text size="sm" bold>
              ⚠️ Approval needed: {displayName}
            </Text>
          </div>
          <div className="font-mono mb-3">
            <Text size="xs" variant="secondary">
              {JSON.stringify(part.input, null, 2)}
            </Text>
          </div>
          <span className="mb-3 block">
            <Text size="xs" variant="secondary">
              This will permanently delete all your study progress data.
            </Text>
          </span>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: true });
                }
              }}
            >
              Approve Reset
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: false });
                }
              }}
            >
              Cancel
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  // Rejected
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2">
            <XCircleIcon size={14} className="text-kumo-danger" />
            <Text size="xs" variant="secondary" bold>
              {displayName}
            </Text>
            <Badge variant="secondary">Cancelled</Badge>
          </div>
        </Surface>
      </div>
    );
  }

  // Executing
  if (part.state === "input-available" || part.state === "input-streaming") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2">
            <GearIcon size={14} className="text-kumo-inactive animate-spin" />
            <Text size="xs" variant="secondary">
              Running {displayName}...
            </Text>
          </div>
        </Surface>
      </div>
    );
  }

  return null;
}

// ── Main chat ─────────────────────────────────────────────────────────

function Chat() {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toasts = useKumoToastManager();

  // Study state synced from agent
  const [studyState, setStudyState] = useState<StudyState>({
    topicsStudied: [],
    flashcardsGenerated: 0,
    quizzesTaken: 0,
    summariesCreated: 0,
    currentStreak: 0,
    lastStudyDate: null,
    totalSessions: 0
  });

  const agent = useAgent({
    agent: "ChatAgent",
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback(
      (error: Event) => console.error("WebSocket error:", error),
      []
    ),
    onStateUpdate: useCallback((state: StudyState) => {
      setStudyState(state);
    }, []),
    onMessage: useCallback(
      (message: MessageEvent) => {
        try {
          const data = JSON.parse(String(message.data));
          if (data.type === "study-reminder") {
            toasts.add({
              title: "📚 Study Reminder",
              description: data.description,
              timeout: 0
            });
          }
        } catch {
          // Not JSON or not our event
        }
      },
      [toasts]
    )
  });

  const {
    messages,
    sendMessage,
    clearHistory,
    addToolApprovalResponse,
    stop,
    status
  } = useAgentChat({
    agent,
    onToolCall: async (event) => {
      if (
        "addToolOutput" in event &&
        event.toolCall.toolName === "getUserTimezone"
      ) {
        event.addToolOutput({
          toolCallId: event.toolCall.toolCallId,
          output: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString(),
            utcOffset: new Date().getTimezoneOffset()
          }
        });
      }
    }
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sendMessage]);

  // Suggested study prompts
  const studyPrompts = [
    "Generate flashcards about photosynthesis",
    "Quiz me on World War II",
    "Summarize the theory of relativity",
    "Show my study progress",
    "Remind me to study in 30 minutes",
    "What timezone am I in?"
  ];

  return (
    <div className="flex h-screen bg-kumo-elevated">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="px-5 py-4 bg-kumo-base border-b border-kumo-line">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-kumo-default">
                <span className="mr-2">📚</span>StudyBot
              </h1>
              <Badge variant="secondary">
                <BrainIcon size={12} weight="bold" className="mr-1" />
                AI Study Agent
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <CircleIcon
                  size={8}
                  weight="fill"
                  className={
                    connected ? "text-kumo-success" : "text-kumo-danger"
                  }
                />
                <Text size="xs" variant="secondary">
                  {connected ? "Connected" : "Disconnected"}
                </Text>
              </div>
              <div className="flex items-center gap-1.5">
                <BugIcon size={14} className="text-kumo-inactive" />
                <Switch
                  checked={showDebug}
                  onCheckedChange={setShowDebug}
                  size="sm"
                  aria-label="Toggle debug mode"
                />
              </div>
              <ThemeToggle />
              <Button
                variant="secondary"
                shape="square"
                icon={<SidebarIcon size={16} />}
                onClick={() => setShowSidebar(!showSidebar)}
                aria-label="Toggle progress sidebar"
              />
              <Button
                variant="secondary"
                icon={<TrashIcon size={16} />}
                onClick={clearHistory}
              >
                Clear
              </Button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
            {messages.length === 0 && (
              <Empty
                icon={<BookOpenIcon size={32} />}
                title="Welcome to StudyBot!"
                contents={
                  <div className="space-y-3">
                    <Text size="sm" variant="secondary">
                      Your AI-powered study companion. Try one of these:
                    </Text>
                    <div className="flex flex-wrap justify-center gap-2">
                      {studyPrompts.map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          size="sm"
                          disabled={isStreaming}
                          onClick={() => {
                            sendMessage({
                              role: "user",
                              parts: [{ type: "text", text: prompt }]
                            });
                          }}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                }
              />
            )}

            {messages.map((message: UIMessage, index: number) => {
              const isUser = message.role === "user";
              const isLastAssistant =
                message.role === "assistant" && index === messages.length - 1;

              return (
                <div key={message.id} className="space-y-2">
                  {showDebug && (
                    <pre className="text-[11px] text-kumo-subtle bg-kumo-control rounded-lg p-3 overflow-auto max-h-64">
                      {JSON.stringify(message, null, 2)}
                    </pre>
                  )}

                  {/* Tool parts */}
                  {message.parts.filter(isToolUIPart).map((part) => (
                    <ToolPartView
                      key={part.toolCallId}
                      part={part}
                      addToolApprovalResponse={addToolApprovalResponse}
                    />
                  ))}

                  {/* Reasoning parts */}
                  {message.parts
                    .filter(
                      (part) =>
                        part.type === "reasoning" &&
                        (part as { text?: string }).text?.trim()
                    )
                    .map((part, i) => {
                      const reasoning = part as {
                        type: "reasoning";
                        text: string;
                        state?: "streaming" | "done";
                      };
                      const isDone = reasoning.state === "done" || !isStreaming;
                      return (
                        <div key={i} className="flex justify-start">
                          <details
                            className="max-w-[85%] w-full"
                            open={!isDone}
                          >
                            <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm select-none">
                              <BrainIcon
                                size={14}
                                className="text-purple-400"
                              />
                              <span className="font-medium text-kumo-default">
                                Thinking
                              </span>
                              {isDone ? (
                                <span className="text-xs text-kumo-success">
                                  Complete
                                </span>
                              ) : (
                                <span className="text-xs text-kumo-brand">
                                  Thinking...
                                </span>
                              )}
                              <CaretDownIcon
                                size={14}
                                className="ml-auto text-kumo-inactive"
                              />
                            </summary>
                            <pre className="mt-2 px-3 py-2 rounded-lg bg-kumo-control text-xs text-kumo-default whitespace-pre-wrap overflow-auto max-h-64">
                              {reasoning.text}
                            </pre>
                          </details>
                        </div>
                      );
                    })}

                  {/* Text parts */}
                  {message.parts
                    .filter((part) => part.type === "text")
                    .map((part, i) => {
                      const text = (part as { type: "text"; text: string })
                        .text;
                      if (!text) return null;

                      if (isUser) {
                        return (
                          <div key={i} className="flex justify-end">
                            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-kumo-contrast text-kumo-inverse leading-relaxed">
                              {text}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={i} className="flex justify-start">
                          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-kumo-base text-kumo-default leading-relaxed">
                            <Streamdown
                              className="sd-theme rounded-2xl rounded-bl-md p-3"
                              controls={false}
                              isAnimating={isLastAssistant && isStreaming}
                            >
                              {text}
                            </Streamdown>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-kumo-line bg-kumo-base">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="max-w-3xl mx-auto px-5 py-4"
          >
            <div className="flex items-end gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-sm focus-within:ring-2 focus-within:ring-kumo-ring focus-within:border-transparent transition-shadow">
              <InputArea
                ref={textareaRef}
                value={input}
                onValueChange={setInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                placeholder="Ask me to create flashcards, quiz you, or summarize a topic..."
                disabled={!connected || isStreaming}
                rows={1}
                className="flex-1 ring-0! focus:ring-0! shadow-none! bg-transparent! outline-none! resize-none max-h-40"
              />
              {isStreaming ? (
                <Button
                  type="button"
                  variant="secondary"
                  shape="square"
                  aria-label="Stop generation"
                  icon={<StopIcon size={18} />}
                  onClick={stop}
                  className="mb-0.5"
                />
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  shape="square"
                  aria-label="Send message"
                  disabled={!input.trim() || !connected}
                  icon={<PaperPlaneRightIcon size={18} />}
                  className="mb-0.5"
                />
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Study progress sidebar */}
      <StudyProgressSidebar studyState={studyState} visible={showSidebar} />
    </div>
  );
}

export default function App() {
  return (
    <Toasty>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen text-kumo-inactive">
            <div className="text-center space-y-2">
              <BookOpenIcon size={32} className="mx-auto opacity-50" />
              <div>Loading StudyBot...</div>
            </div>
          </div>
        }
      >
        <Chat />
      </Suspense>
    </Toasty>
  );
}
