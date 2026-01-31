"use client";

import { useState } from "react";
import type { AgentTile } from "@/features/canvas/state/store";
import { AgentAvatar } from "@/features/canvas/components/AgentAvatar";
import { cn } from "@/lib/utils";

export type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo?: string; // agent id
  createdAt: number;
  updatedAt: number;
};

type MissionQueueProps = {
  tasks: Task[];
  agents: AgentTile[];
  onTaskMove?: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (status: TaskStatus) => void;
};

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "inbox", label: "INBOX", color: "border-t-rose-400" },
  { key: "assigned", label: "ASSIGNED", color: "border-t-orange-400" },
  { key: "in_progress", label: "IN PROGRESS", color: "border-t-blue-400" },
  { key: "review", label: "REVIEW", color: "border-t-purple-400" },
  { key: "done", label: "DONE", color: "border-t-emerald-400" },
];

type TaskCardProps = {
  task: Task;
  agent?: AgentTile;
  onClick?: () => void;
};

// Pure time formatting - takes both values to avoid impure Date.now() in render
const formatTimeAgo = (timestamp: number, now: number) => {
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const TaskCard = ({ task, agent, onClick }: TaskCardProps) => {
  const [now] = useState(() => Date.now());

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-all",
        "hover:border-primary/50 hover:shadow-md"
      )}
      onClick={onClick}
    >
      <div className="mb-2 text-sm font-medium leading-snug">{task.title}</div>
      {task.description && (
        <div className="mb-2 text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </div>
      )}
      <div className="flex items-center justify-between">
        {agent && (
          <div className="flex items-center gap-1.5">
            <AgentAvatar name={agent.name} seed={agent.avatarSeed ?? agent.name} size={18} />
            <span className="text-xs text-muted-foreground">{agent.name}</span>
          </div>
        )}
        {!agent && <div />}
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(task.updatedAt, now)}
        </span>
      </div>
    </div>
  );
};

export const MissionQueue = ({
  tasks,
  agents,
  onTaskMove,
  onTaskClick,
  onAddTask,
}: MissionQueueProps) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const getAgentById = (id?: string) =>
    id ? agents.find((a) => a.id === id) : undefined;

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragEnd = () => {
    if (draggedTask && dragOverColumn) {
      onTaskMove?.(draggedTask, dragOverColumn);
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Mission Queue
        </span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{tasks.length} tasks</span>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {COLUMNS.map((column) => {
          const columnTasks = getTasksByStatus(column.key);
          const isDragOver = dragOverColumn === column.key;

          return (
            <div
              key={column.key}
              className={cn(
                "flex w-64 flex-shrink-0 flex-col rounded-lg bg-muted/30",
                isDragOver && "ring-2 ring-primary/50"
              )}
              onDragOver={(e) => handleDragOver(e, column.key)}
              onDragLeave={handleDragLeave}
              onDrop={handleDragEnd}
            >
              {/* Column header */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-t-lg border-t-2 px-3 py-2",
                  column.color
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {column.label}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {columnTasks.length}
                  </span>
                </div>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onAddTask?.(column.key)}
                  title="Add task"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>

              {/* Tasks */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <TaskCard
                      task={task}
                      agent={getAgentById(task.assignedTo)}
                      onClick={() => onTaskClick?.(task.id)}
                    />
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div className="flex flex-1 items-center justify-center py-8 text-xs text-muted-foreground">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
