import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentTile as AgentTileType, TileSize } from "@/features/canvas/state/store";
import { isTraceMarkdown, stripTraceMarkdown } from "@/lib/text/extractThinking";
import { normalizeAgentName } from "@/lib/names/agentNames";
import { Settings, Shuffle } from "lucide-react";
import {
  fetchProjectTileWorkspaceFiles,
  updateProjectTileWorkspaceFiles,
} from "@/lib/projects/client";
import {
  WORKSPACE_FILE_META,
  WORKSPACE_FILE_NAMES,
  WORKSPACE_FILE_PLACEHOLDERS,
  type WorkspaceFileName,
} from "@/lib/projects/workspaceFiles";
import { AgentAvatar } from "./AgentAvatar";

export const MIN_TILE_SIZE = { width: 420, height: 520 };

const buildWorkspaceState = () =>
  Object.fromEntries(
    WORKSPACE_FILE_NAMES.map((name) => [name, { content: "", exists: false }])
  ) as Record<WorkspaceFileName, { content: string; exists: boolean }>;

const buildWorkspaceExpanded = () =>
  Object.fromEntries(WORKSPACE_FILE_NAMES.map((name) => [name, false])) as Record<
    WorkspaceFileName,
    boolean
  >;

const isWorkspaceFileName = (value: string): value is WorkspaceFileName =>
  WORKSPACE_FILE_NAMES.includes(value as WorkspaceFileName);

type AgentTileProps = {
  tile: AgentTileType;
  projectId: string | null;
  isSelected: boolean;
  canSend: boolean;
  onDelete: () => void;
  onNameChange: (name: string) => Promise<boolean>;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onAvatarShuffle: () => void;
  onNameShuffle: () => void;
  onResize?: (size: TileSize) => void;
};

export const AgentTile = ({
  tile,
  projectId,
  isSelected,
  canSend,
  onDelete,
  onNameChange,
  onDraftChange,
  onSend,
  onModelChange,
  onThinkingChange,
  onAvatarShuffle,
  onNameShuffle,
  onResize,
}: AgentTileProps) => {
  const [nameDraft, setNameDraft] = useState(tile.name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState(buildWorkspaceState);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(buildWorkspaceExpanded);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const workspaceItemRefs = useRef<Record<WorkspaceFileName, HTMLDivElement | null>>(
    buildWorkspaceExpanded()
  );
  const outputRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollOutputToBottom = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleOutputWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isSelected) return;
      const el = outputRef.current;
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      const nextTop = Math.max(0, Math.min(maxTop, el.scrollTop + event.deltaY));
      const nextLeft = Math.max(0, Math.min(maxLeft, el.scrollLeft + event.deltaX));
      el.scrollTop = nextTop;
      el.scrollLeft = nextLeft;
    },
    [isSelected]
  );

  useEffect(() => {
    const raf = requestAnimationFrame(scrollOutputToBottom);
    return () => cancelAnimationFrame(raf);
  }, [scrollOutputToBottom, tile.outputLines, tile.streamText]);

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    setNameDraft(tile.name);
  }, [tile.name]);

  useEffect(() => {
    resizeDraft();
  }, [resizeDraft, tile.draft]);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) return;
    const extra = Math.ceil(output.scrollHeight - output.clientHeight);
    if (extra <= 0) return;
    onResize?.({ width: tile.size.width, height: tile.size.height + extra });
  }, [
    onResize,
    tile.outputLines,
    tile.streamText,
    tile.thinkingTrace,
    tile.size.height,
    tile.size.width,
  ]);

  const commitName = async () => {
    const next = normalizeAgentName(nameDraft);
    if (!next) {
      setNameDraft(tile.name);
      return;
    }
    if (next === tile.name) {
      return;
    }
    const ok = await onNameChange(next);
    if (!ok) {
      setNameDraft(tile.name);
      return;
    }
    setNameDraft(next);
  };

  const statusColor =
    tile.status === "running"
      ? "bg-amber-200 text-amber-900"
      : tile.status === "error"
        ? "bg-rose-200 text-rose-900"
        : "bg-emerald-200 text-emerald-900";
  const showThinking = tile.status === "running" && Boolean(tile.thinkingTrace);
  const showTranscript =
    tile.outputLines.length > 0 || Boolean(tile.streamText) || showThinking;
  const avatarSeed = tile.avatarSeed ?? tile.agentId;
  const panelBorder = "border-slate-200";

  const loadWorkspaceFiles = useCallback(async () => {
    if (!projectId) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const result = await fetchProjectTileWorkspaceFiles(projectId, tile.id);
      const nextState = buildWorkspaceState();
      for (const file of result.files) {
        if (!isWorkspaceFileName(file.name)) continue;
        nextState[file.name] = {
          content: file.content ?? "",
          exists: Boolean(file.exists),
        };
      }
      setWorkspaceFiles(nextState);
      setWorkspaceDirty(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load workspace files.";
      setWorkspaceError(message);
    } finally {
      setWorkspaceLoading(false);
    }
  }, [projectId, tile.id]);

  const saveWorkspaceFiles = useCallback(async () => {
    if (!projectId) return;
    setWorkspaceSaving(true);
    setWorkspaceError(null);
    try {
      const payload = {
        files: WORKSPACE_FILE_NAMES.map((name) => ({
          name,
          content: workspaceFiles[name].content,
        })),
      };
      const result = await updateProjectTileWorkspaceFiles(projectId, tile.id, payload);
      const nextState = buildWorkspaceState();
      for (const file of result.files) {
        if (!isWorkspaceFileName(file.name)) continue;
        nextState[file.name] = {
          content: file.content ?? "",
          exists: Boolean(file.exists),
        };
      }
      setWorkspaceFiles(nextState);
      setWorkspaceDirty(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save workspace files.";
      setWorkspaceError(message);
    } finally {
      setWorkspaceSaving(false);
    }
  }, [projectId, tile.id, workspaceFiles]);

  useEffect(() => {
    if (!settingsOpen) return;
    void loadWorkspaceFiles();
  }, [loadWorkspaceFiles, settingsOpen]);

  const settingsModal =
    settingsOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-6 py-8 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Agent settings"
            onClick={() => setSettingsOpen(false)}
          >
            <div
              className="w-[min(92vw,920px)] max-h-[90vh] overflow-hidden rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex max-h-[calc(90vh-3rem)] flex-col gap-4 overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Agent settings
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {tile.name}
                    </div>
                  </div>
                  <button
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase text-slate-600"
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-col gap-4 overflow-hidden">
                  <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Core
                    </div>
                    <label className="mt-4 flex flex-col gap-2 text-xs font-semibold uppercase text-slate-500">
                      <span>Model</span>
                      <select
                        className="h-10 rounded-2xl border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-700"
                        value={tile.model ?? ""}
                        onChange={(event) => {
                          const value = event.target.value.trim();
                          onModelChange(value ? value : null);
                        }}
                      >
                        <option value="openai-codex/gpt-5.2-codex">GPT-5.2 Codex</option>
                        <option value="xai/grok-4-1-fast-reasoning">
                          grok-4-1-fast-reasoning
                        </option>
                        <option value="xai/grok-4-1-fast-non-reasoning">
                          grok-4-1-fast-non-reasoning
                        </option>
                        <option value="zai/glm-4.7">glm-4.7</option>
                      </select>
                    </label>
                    {tile.model === "xai/grok-4-1-fast-non-reasoning" ? null : (
                      <label className="mt-4 flex flex-col gap-2 text-xs font-semibold uppercase text-slate-500">
                        <span>Thinking</span>
                        <select
                          className="h-10 rounded-2xl border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-700"
                          value={tile.thinkingLevel ?? ""}
                          onChange={(event) => {
                            const value = event.target.value.trim();
                            onThinkingChange(value ? value : null);
                          }}
                        >
                          <option value="">Default</option>
                          <option value="off">Off</option>
                          <option value="minimal">Minimal</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="xhigh">XHigh</option>
                        </select>
                      </label>
                    )}
                    <button
                      className="mt-6 w-full rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase text-rose-600"
                      type="button"
                      onClick={onDelete}
                    >
                      Delete agent
                    </button>
                  </div>

                  <div className="flex min-h-[420px] flex-1 flex-col rounded-3xl border border-slate-200 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Workspace files
                      </div>
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        {workspaceLoading
                          ? "Loading..."
                          : workspaceDirty
                            ? "Unsaved changes"
                            : "All changes saved"}
                      </div>
                    </div>
                    {workspaceError ? (
                      <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                        {workspaceError}
                      </div>
                    ) : null}
                    <div className="mt-4 flex-1 overflow-auto pr-1">
                      <div className="flex flex-col gap-3">
                        {WORKSPACE_FILE_NAMES.map((name) => {
                          const meta = WORKSPACE_FILE_META[name];
                          const isOpen = workspaceExpanded[name];
                          const file = workspaceFiles[name];
                          return (
                            <div
                              key={name}
                              className="rounded-2xl border border-slate-200 bg-white/90 p-4"
                              ref={(node) => {
                                workspaceItemRefs.current[name] = node;
                              }}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">
                                    {meta.title}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {meta.hint}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!file.exists ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
                                      new
                                    </span>
                                  ) : null}
                                  <button
                                    className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase text-slate-600"
                                    type="button"
                                    onClick={() => {
                                      const shouldOpen = !workspaceExpanded[name];
                                      setWorkspaceExpanded((prev) => ({
                                        ...prev,
                                        [name]: !prev[name],
                                      }));
                                      if (!shouldOpen) return;
                                      const scrollTarget = workspaceItemRefs.current[name];
                                      if (!scrollTarget) return;
                                      requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                          scrollTarget.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                          });
                                        });
                                      });
                                    }}
                                  >
                                    {isOpen ? "Hide" : "Edit"}
                                  </button>
                                </div>
                              </div>
                              {isOpen ? (
                              <textarea
                                className="mt-3 min-h-[140px] w-full resize-y rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-800 outline-none"
                                value={file.content}
                                placeholder={
                                  file.content.trim().length === 0
                                    ? WORKSPACE_FILE_PLACEHOLDERS[name]
                                    : undefined
                                }
                                disabled={workspaceLoading || workspaceSaving}
                                onChange={(event) => {
                                  const value = event.target.value;
                                    setWorkspaceFiles((prev) => ({
                                      ...prev,
                                      [name]: { ...prev[name], content: value },
                                    }));
                                    setWorkspaceDirty(true);
                                  }}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
                      <div className="text-xs text-slate-400">
                        {workspaceDirty ? "Remember to save your changes." : "Up to date."}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase text-slate-600"
                          type="button"
                          onClick={() => setSettingsOpen(false)}
                        >
                          Close
                        </button>
                        <button
                          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                          type="button"
                          disabled={
                            !projectId ||
                            workspaceLoading ||
                            workspaceSaving ||
                            !workspaceDirty
                          }
                          onClick={() => void saveWorkspaceFiles()}
                        >
                          {workspaceSaving ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div data-tile className="relative flex h-full w-full flex-col gap-3">
      {settingsModal}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 shadow-sm">
              <input
                className="w-full bg-transparent text-center text-xs font-semibold uppercase tracking-wide text-slate-700 outline-none"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  void commitName();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setNameDraft(tile.name);
                    event.currentTarget.blur();
                  }
                }}
              />
              <button
                className="nodrag flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-white"
                type="button"
                aria-label="Shuffle name"
                data-testid="agent-name-shuffle"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onNameShuffle();
                }}
              >
                <Shuffle className="h-3 w-3" />
              </button>
            </div>
            <div className="relative">
              <div data-drag-handle>
                <AgentAvatar
                  seed={avatarSeed}
                  name={tile.name}
                  size={120}
                  isSelected={isSelected}
                />
              </div>
              <div className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2">
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}
                >
                  {tile.status}
                </span>
              </div>
              <button
                className="nodrag absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-white"
                type="button"
                aria-label="Shuffle avatar"
                data-testid="agent-avatar-shuffle"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAvatarShuffle();
                }}
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-end gap-2">
          <div className="relative">
            <button
              className="nodrag flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 hover:bg-white"
              type="button"
              data-testid="agent-options-toggle"
              aria-label="Agent options"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSettingsOpen(true);
              }}
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={draftRef}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 outline-none"
            value={tile.draft}
            onChange={(event) => {
              onDraftChange(event.target.value);
              resizeDraft();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              if (!isSelected) return;
              if (!canSend || tile.status === "running") return;
              const message = tile.draft.trim();
              if (!message) return;
              event.preventDefault();
              onSend(message);
            }}
            placeholder="type a message"
          />
          <button
            className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            type="button"
            onClick={() => onSend(tile.draft)}
            disabled={!canSend || tile.status === "running" || !tile.draft.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {showTranscript ? (
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border ${panelBorder} bg-white/80 px-4 pb-4 pt-4 shadow-xl backdrop-blur`}
        >
          <div
            ref={outputRef}
            className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white/60 p-3 text-xs text-slate-700"
            onWheel={handleOutputWheel}
            data-testid="agent-transcript"
          >
            <div className="flex flex-col gap-2">
              {showThinking ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                  <div className="agent-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {tile.thinkingTrace}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
              {(() => {
                const nodes: React.ReactNode[] = [];
                for (let index = 0; index < tile.outputLines.length; index += 1) {
                  const line = tile.outputLines[index];
                  if (isTraceMarkdown(line)) {
                    const traces = [stripTraceMarkdown(line)];
                    let cursor = index + 1;
                    while (
                      cursor < tile.outputLines.length &&
                      isTraceMarkdown(tile.outputLines[cursor])
                    ) {
                      traces.push(stripTraceMarkdown(tile.outputLines[cursor]));
                      cursor += 1;
                    }
                    nodes.push(
                      <details
                        key={`${tile.id}-trace-${index}`}
                        className="rounded-xl border border-slate-200 bg-white/80 px-2 py-1 text-[11px] text-slate-600"
                      >
                        <summary className="cursor-pointer select-none font-semibold">
                          Thinking
                        </summary>
                        <div className="agent-markdown mt-1 text-slate-700">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {traces.join("\n")}
                          </ReactMarkdown>
                        </div>
                      </details>
                    );
                    index = cursor - 1;
                    continue;
                  }
                  nodes.push(
                    <div key={`${tile.id}-line-${index}`} className="agent-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{line}</ReactMarkdown>
                    </div>
                  );
                }
                return nodes;
              })()}
              {tile.streamText ? (
                <div className="agent-markdown text-slate-500">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {tile.streamText}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
