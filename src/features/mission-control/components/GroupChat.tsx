"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentTile } from "@/features/canvas/state/store";
import { AgentAvatar } from "@/features/canvas/components/AgentAvatar";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  senderId: string; // "user" for human, agent.id for agents
  senderName: string;
  content: string;
  timestamp: number;
};

type GroupChatProps = {
  messages: ChatMessage[];
  agents: AgentTile[];
  onSendMessage: (message: string) => void;
  disabled?: boolean;
};

export const GroupChat = ({
  messages,
  agents,
  onSendMessage,
  disabled,
}: GroupChatProps) => {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const getAgentById = (id: string) =>
    agents.find((a) => a.id === id);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setDraft("");
    inputRef.current?.focus();
  }, [draft, disabled, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Group Chat
        </span>
        <div className="flex -space-x-2">
          {agents.slice(0, 4).map((agent) => (
            <AgentAvatar
              key={agent.id}
              name={agent.name}
              seed={agent.avatarSeed ?? agent.name}
              size={18}
              className="ring-2 ring-background"
            />
          ))}
          {agents.length > 4 && (
            <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
              +{agents.length - 4}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Start a conversation with all agents
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isUser = message.senderId === "user";
              const agent = !isUser ? getAgentById(message.senderId) : undefined;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    isUser && "flex-row-reverse"
                  )}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {isUser ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                        You
                      </div>
                    ) : agent ? (
                      <AgentAvatar
                        name={agent.name}
                        seed={agent.avatarSeed ?? agent.name}
                        size={24}
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px]">
                        ?
                      </div>
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {!isUser && (
                      <div className="mb-0.5 text-[10px] font-medium opacity-70">
                        {message.senderName}
                      </div>
                    )}
                    <p className="text-xs whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <div
                      className={cn(
                        "mt-1 text-[10px]",
                        isUser ? "text-primary-foreground/60" : "text-muted-foreground"
                      )}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message all agents..."
            disabled={disabled}
            className={cn(
              "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-xs",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            rows={2}
          />
          <Button
            size="icon"
            className="h-auto self-end"
            onClick={handleSubmit}
            disabled={disabled || !draft.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
