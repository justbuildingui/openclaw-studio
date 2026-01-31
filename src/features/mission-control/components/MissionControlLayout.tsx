"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MissionControlLayoutProps = {
  sidebar: ReactNode;
  queue: ReactNode;
  liveFeed: ReactNode;
  groupChat: ReactNode;
  chatPanel?: ReactNode;
  header?: ReactNode;
};

export const MissionControlLayout = ({
  sidebar,
  queue,
  liveFeed,
  groupChat,
  chatPanel,
  header,
}: MissionControlLayoutProps) => {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {header && (
        <div className="flex-shrink-0 border-b border-border px-4 py-2">
          {header}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Agents */}
        <div className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-muted/30">
          {sidebar}
        </div>

        {/* Center - Mission Queue */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {queue}
        </div>

        {/* Agent Chat Panel - slides in when agent selected */}
        {chatPanel && (
          <div className="flex w-96 flex-shrink-0 flex-col border-l border-border bg-background">
            {chatPanel}
          </div>
        )}

        {/* Right panel - Live Feed + Group Chat */}
        <div className={cn(
          "flex flex-shrink-0 flex-col border-l border-border transition-all",
          chatPanel ? "w-64" : "w-80"
        )}>
          {/* Live Feed - top portion */}
          <div className="flex h-1/2 flex-col border-b border-border overflow-hidden">
            {liveFeed}
          </div>
          {/* Group Chat - bottom portion */}
          <div className="flex h-1/2 flex-col overflow-hidden">
            {groupChat}
          </div>
        </div>
      </div>
    </div>
  );
};
