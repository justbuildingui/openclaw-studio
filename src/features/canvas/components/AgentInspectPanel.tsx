"use client";

import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentTile } from "@/features/canvas/state/store";
import { isTraceMarkdown, stripTraceMarkdown } from "@/lib/text/extractThinking";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import {
  fetchProjectTileHeartbeat,
  fetchProjectTileWorkspaceFiles,
  updateProjectTileHeartbeat,
  updateProjectTileWorkspaceFiles,
} from "@/lib/projects/client";
import {
  createWorkspaceFilesState,
  isWorkspaceFileName,
  WORKSPACE_FILE_META,
  WORKSPACE_FILE_NAMES,
  WORKSPACE_FILE_PLACEHOLDERS,
  type WorkspaceFileName,
} from "@/lib/projects/workspaceFiles";
import { X, History, Archive, RotateCcw, ChevronDown } from "lucide-react";

const HEARTBEAT_INTERVAL_OPTIONS = ["15m", "30m", "1h", "2h", "6h", "12h", "24h"];

type AgentInspectPanelProps = {
  tile: AgentTile;
  projectId: string;
  models: GatewayModelChoice[];
  onClose: () => void;
  onLoadHistory: () => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onDelete: () => void;
};

export const AgentInspectPanel = ({
  tile,
  projectId,
  models,
  onClose,
  onLoadHistory,
  onModelChange,
  onThinkingChange,
  onDelete,
}: AgentInspectPanelProps) => {
  const [workspaceFiles, setWorkspaceFiles] = useState(createWorkspaceFilesState);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceFileName>(
    WORKSPACE_FILE_NAMES[0]
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [heartbeatLoading, setHeartbeatLoading] = useState(false);
  const [heartbeatSaving, setHeartbeatSaving] = useState(false);
  const [heartbeatDirty, setHeartbeatDirty] = useState(false);
  const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
  const [heartbeatOverride, setHeartbeatOverride] = useState(false);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const [heartbeatEvery, setHeartbeatEvery] = useState("30m");
  const [heartbeatIntervalMode, setHeartbeatIntervalMode] = useState<
    "preset" | "custom"
  >("preset");
  const [heartbeatCustomMinutes, setHeartbeatCustomMinutes] = useState("45");
  const [heartbeatTargetMode, setHeartbeatTargetMode] = useState<
    "last" | "none" | "custom"
  >("last");
  const [heartbeatTargetCustom, setHeartbeatTargetCustom] = useState("");
  const [heartbeatIncludeReasoning, setHeartbeatIncludeReasoning] = useState(false);
  const [heartbeatActiveHoursEnabled, setHeartbeatActiveHoursEnabled] =
    useState(false);
  const [heartbeatActiveStart, setHeartbeatActiveStart] = useState("08:00");
  const [heartbeatActiveEnd, setHeartbeatActiveEnd] = useState("18:00");
  const [heartbeatAckMaxChars, setHeartbeatAckMaxChars] = useState("300");
  const [expandedSections, setExpandedSections] = useState({
    activity: true,
    files: true,
    settings: false,
    heartbeat: false,
  });
  const outputRef = useRef<HTMLDivElement | null>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const scrollOutputToBottom = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleOutputWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
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
    []
  );

  useEffect(() => {
    const raf = requestAnimationFrame(scrollOutputToBottom);
    return () => cancelAnimationFrame(raf);
  }, [scrollOutputToBottom, tile.outputLines, tile.streamText]);

  const loadWorkspaceFiles = useCallback(async () => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const result = await fetchProjectTileWorkspaceFiles(projectId, tile.id);
      const nextState = createWorkspaceFilesState();
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
      const nextState = createWorkspaceFilesState();
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

  const handleWorkspaceTabChange = useCallback(
    (nextTab: WorkspaceFileName) => {
      if (nextTab === workspaceTab) return;
      if (workspaceDirty && !workspaceSaving) {
        void saveWorkspaceFiles();
      }
      setWorkspaceTab(nextTab);
    },
    [saveWorkspaceFiles, workspaceDirty, workspaceSaving, workspaceTab]
  );

  const loadHeartbeat = useCallback(async () => {
    setHeartbeatLoading(true);
    setHeartbeatError(null);
    try {
      const result = await fetchProjectTileHeartbeat(projectId, tile.id);
      const every = result.heartbeat.every ?? "30m";
      const enabled = every !== "0m";
      const isPreset = HEARTBEAT_INTERVAL_OPTIONS.includes(every);
      if (isPreset) {
        setHeartbeatIntervalMode("preset");
      } else {
        setHeartbeatIntervalMode("custom");
        const parsed =
          every.endsWith("m")
            ? Number.parseInt(every, 10)
            : every.endsWith("h")
              ? Number.parseInt(every, 10) * 60
              : Number.parseInt(every, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          setHeartbeatCustomMinutes(String(parsed));
        }
      }
      const target = result.heartbeat.target ?? "last";
      const targetMode = target === "last" || target === "none" ? target : "custom";
      setHeartbeatOverride(result.hasOverride);
      setHeartbeatEnabled(enabled);
      setHeartbeatEvery(enabled ? every : "30m");
      setHeartbeatTargetMode(targetMode);
      setHeartbeatTargetCustom(targetMode === "custom" ? target : "");
      setHeartbeatIncludeReasoning(Boolean(result.heartbeat.includeReasoning));
      if (result.heartbeat.activeHours) {
        setHeartbeatActiveHoursEnabled(true);
        setHeartbeatActiveStart(result.heartbeat.activeHours.start);
        setHeartbeatActiveEnd(result.heartbeat.activeHours.end);
      } else {
        setHeartbeatActiveHoursEnabled(false);
      }
      if (typeof result.heartbeat.ackMaxChars === "number") {
        setHeartbeatAckMaxChars(String(result.heartbeat.ackMaxChars));
      } else {
        setHeartbeatAckMaxChars("300");
      }
      setHeartbeatDirty(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load heartbeat settings.";
      setHeartbeatError(message);
    } finally {
      setHeartbeatLoading(false);
    }
  }, [projectId, tile.id]);

  const saveHeartbeat = useCallback(async () => {
    setHeartbeatSaving(true);
    setHeartbeatError(null);
    try {
      const target =
        heartbeatTargetMode === "custom"
          ? heartbeatTargetCustom.trim()
          : heartbeatTargetMode;
      let every = heartbeatEnabled ? heartbeatEvery.trim() : "0m";
      if (heartbeatEnabled && heartbeatIntervalMode === "custom") {
        const customValue = Number.parseInt(heartbeatCustomMinutes, 10);
        if (!Number.isFinite(customValue) || customValue <= 0) {
          setHeartbeatError("Custom interval must be a positive number.");
          setHeartbeatSaving(false);
          return;
        }
        every = `${customValue}m`;
      }
      const ackParsed = Number.parseInt(heartbeatAckMaxChars, 10);
      const ackMaxChars = Number.isFinite(ackParsed) ? ackParsed : 300;
      const activeHours =
        heartbeatActiveHoursEnabled && heartbeatActiveStart && heartbeatActiveEnd
          ? { start: heartbeatActiveStart, end: heartbeatActiveEnd }
          : null;
      const result = await updateProjectTileHeartbeat(projectId, tile.id, {
        override: heartbeatOverride,
        heartbeat: {
          every,
          target: target || "last",
          includeReasoning: heartbeatIncludeReasoning,
          ackMaxChars,
          activeHours,
        },
      });
      setHeartbeatOverride(result.hasOverride);
      setHeartbeatDirty(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save heartbeat settings.";
      setHeartbeatError(message);
    } finally {
      setHeartbeatSaving(false);
    }
  }, [
    heartbeatActiveEnd,
    heartbeatActiveHoursEnabled,
    heartbeatActiveStart,
    heartbeatAckMaxChars,
    heartbeatCustomMinutes,
    heartbeatEnabled,
    heartbeatEvery,
    heartbeatIncludeReasoning,
    heartbeatIntervalMode,
    heartbeatOverride,
    heartbeatTargetCustom,
    heartbeatTargetMode,
    projectId,
    tile.id,
  ]);

  useEffect(() => {
    void loadWorkspaceFiles();
    void loadHeartbeat();
  }, [loadWorkspaceFiles, loadHeartbeat]);

  useEffect(() => {
    if (!WORKSPACE_FILE_NAMES.includes(workspaceTab)) {
      setWorkspaceTab(WORKSPACE_FILE_NAMES[0]);
    }
  }, [workspaceTab]);

  const modelOptions = useMemo(
    () =>
      models.map((entry) => ({
        value: `${entry.provider}/${entry.id}`,
        label:
          entry.name === `${entry.provider}/${entry.id}`
            ? entry.name
            : `${entry.name} (${entry.provider}/${entry.id})`,
        reasoning: entry.reasoning,
      })),
    [models]
  );
  const modelValue = tile.model ?? "";
  const modelOptionsWithFallback =
    modelValue && !modelOptions.some((option) => option.value === modelValue)
      ? [{ value: modelValue, label: modelValue, reasoning: undefined }, ...modelOptions]
      : modelOptions;
  const selectedModel = modelOptionsWithFallback.find(
    (option) => option.value === modelValue
  );
  const allowThinking = selectedModel?.reasoning !== false;

  const activityBlocks = useMemo(() => {
    type ActivityBlock = { user?: string; traces: string[]; assistant: string[] };
    const blocks: ActivityBlock[] = [];
    let current: ActivityBlock | null = null;
    let traceBuffer: string[] = [];
    const ensureBlock = () => {
      if (!current) {
        current = { traces: [], assistant: [] };
        blocks.push(current);
      }
      return current;
    };
    const flushTrace = () => {
      if (current && traceBuffer.length > 0) {
        current.traces.push(traceBuffer.join("\n"));
        traceBuffer = [];
      }
    };
    for (const line of tile.outputLines) {
      if (isTraceMarkdown(line)) {
        ensureBlock();
        traceBuffer.push(stripTraceMarkdown(line));
        continue;
      }
      flushTrace();
      const trimmed = line.trim();
      if (trimmed.startsWith(">")) {
        const user = trimmed.replace(/^>\s?/, "").trim();
        current = { user: user || undefined, traces: [], assistant: [] };
        blocks.push(current);
        continue;
      }
      const block = ensureBlock();
      if (line) {
        block.assistant.push(line);
      }
    }
    flushTrace();
    const liveThinking = tile.thinkingTrace?.trim();
    if (liveThinking) {
      const block = ensureBlock();
      block.traces.push(liveThinking);
    }
    const liveStream = tile.streamText?.trim();
    if (liveStream) {
      const block = ensureBlock();
      block.assistant.push(liveStream);
    }
    return blocks;
  }, [tile.outputLines, tile.streamText, tile.thinkingTrace]);

  const hasActivity = activityBlocks.length > 0;

  return (
    <div className="agent-inspect-panel flex flex-col" data-testid="agent-inspect-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Inspect</p>
          <h2 className="text-base font-semibold text-foreground">{tile.name}</h2>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          type="button"
          data-testid="agent-inspect-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Activity Section */}
        <section className="border-b border-border" data-testid="agent-inspect-activity">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left"
            onClick={() => toggleSection('activity')}
          >
            <span className="text-sm font-medium text-foreground">Activity</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedSections.activity ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSections.activity && (
            <div className="px-5 pb-4">
              {hasActivity ? (
                <div
                  ref={outputRef}
                  className="max-h-[320px] overflow-auto rounded-lg bg-muted/50 p-4"
                  onWheel={handleOutputWheel}
                >
                  <div className="flex flex-col gap-4">
                    {activityBlocks.map((block, index) => (
                      <div key={`${tile.id}-activity-${index}`} className="text-sm">
                        {block.user && (
                          <div className="mb-2 rounded-lg bg-primary/10 px-3 py-2 text-foreground">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {block.user}
                            </ReactMarkdown>
                          </div>
                        )}
                        {block.traces.length > 0 && (
                          <div className="mb-2">
                            {block.traces.map((trace, traceIndex) => (
                              <details
                                key={`${tile.id}-trace-${index}-${traceIndex}`}
                                className="rounded-md border border-border bg-card px-3 py-2 text-xs"
                              >
                                <summary className="cursor-pointer select-none font-medium text-muted-foreground">
                                  Thinking
                                </summary>
                                <div className="agent-markdown mt-2 text-muted-foreground">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {trace}
                                  </ReactMarkdown>
                                </div>
                              </details>
                            ))}
                          </div>
                        )}
                        {block.assistant.length > 0 && (
                          <div className="text-foreground">
                            {block.assistant.map((line, lineIndex) => (
                              <div key={`${tile.id}-assistant-${index}-${lineIndex}`} className="agent-markdown">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {line}
                                </ReactMarkdown>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 py-8">
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <button
                    className="btn-secondary flex items-center gap-2 text-sm"
                    type="button"
                    onClick={onLoadHistory}
                  >
                    <History className="h-4 w-4" />
                    Load history
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Files Section */}
        <section className="border-b border-border" data-testid="agent-inspect-files">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left"
            onClick={() => toggleSection('files')}
          >
            <span className="text-sm font-medium text-foreground">Brain Files</span>
            <div className="flex items-center gap-2">
              {workspaceLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
              {workspaceDirty && <span className="text-xs text-primary">Unsaved</span>}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedSections.files ? 'rotate-180' : ''}`} />
            </div>
          </button>
          
          {expandedSections.files && (
            <div className="px-5 pb-4">
              {workspaceError && (
                <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {workspaceError}
                </div>
              )}
              
              {/* Tabs */}
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                {WORKSPACE_FILE_NAMES.map((name) => {
                  const active = name === workspaceTab;
                  const label = WORKSPACE_FILE_META[name].title.replace(".md", "");
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleWorkspaceTabChange(name)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Editor */}
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {WORKSPACE_FILE_META[workspaceTab].hint}
                  </p>
                  {!workspaceFiles[workspaceTab].exists && (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      New
                    </span>
                  )}
                </div>
                <textarea
                  className="input min-h-[200px] resize-y font-mono text-xs"
                  value={workspaceFiles[workspaceTab].content}
                  placeholder={
                    workspaceFiles[workspaceTab].content.trim().length === 0
                      ? WORKSPACE_FILE_PLACEHOLDERS[workspaceTab]
                      : undefined
                  }
                  disabled={workspaceLoading || workspaceSaving}
                  onChange={(event) => {
                    const value = event.target.value;
                    setWorkspaceFiles((prev) => ({
                      ...prev,
                      [workspaceTab]: { ...prev[workspaceTab], content: value },
                    }));
                    setWorkspaceDirty(true);
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Settings Section */}
        <section className="border-b border-border" data-testid="agent-inspect-settings">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left"
            onClick={() => toggleSection('settings')}
          >
            <span className="text-sm font-medium text-foreground">Settings</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedSections.settings ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSections.settings && (
            <div className="space-y-4 px-5 pb-4">
              {/* Model selector */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Model
                </label>
                <select
                  className="input text-sm"
                  value={tile.model ?? ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    onModelChange(value ? value : null);
                  }}
                >
                  {modelOptionsWithFallback.length === 0 ? (
                    <option value="">No models found</option>
                  ) : null}
                  {modelOptionsWithFallback.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Thinking selector */}
              {allowThinking && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Thinking Level
                  </label>
                  <select
                    className="input text-sm"
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
                </div>
              )}

              {/* Archive/Restore */}
              <button
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  tile.archivedAt
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                }`}
                type="button"
                onClick={onDelete}
              >
                {tile.archivedAt ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Restore Agent
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Archive Agent
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* Heartbeat Section */}
        <section data-testid="agent-inspect-heartbeat">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left"
            onClick={() => toggleSection('heartbeat')}
          >
            <span className="text-sm font-medium text-foreground">Heartbeat</span>
            <div className="flex items-center gap-2">
              {heartbeatLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
              {heartbeatDirty && <span className="text-xs text-primary">Unsaved</span>}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedSections.heartbeat ? 'rotate-180' : ''}`} />
            </div>
          </button>
          
          {expandedSections.heartbeat && (
            <div className="space-y-4 px-5 pb-4">
              {heartbeatError && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {heartbeatError}
                </div>
              )}

              {/* Override toggle */}
              <label className="flex items-center justify-between">
                <span className="text-sm text-foreground">Override defaults</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  checked={heartbeatOverride}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatOverride(event.target.checked);
                    setHeartbeatDirty(true);
                  }}
                />
              </label>

              {/* Enabled toggle */}
              <label className="flex items-center justify-between">
                <span className="text-sm text-foreground">Enabled</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  checked={heartbeatEnabled}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatEnabled(event.target.checked);
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                />
              </label>

              {/* Interval */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Interval
                </label>
                <select
                  className="input text-sm"
                  value={heartbeatIntervalMode === "custom" ? "custom" : heartbeatEvery}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "custom") {
                      setHeartbeatIntervalMode("custom");
                    } else {
                      setHeartbeatIntervalMode("preset");
                      setHeartbeatEvery(value);
                    }
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                >
                  {HEARTBEAT_INTERVAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      Every {option}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
                {heartbeatIntervalMode === "custom" && (
                  <input
                    type="number"
                    min={1}
                    className="input mt-2 text-sm"
                    value={heartbeatCustomMinutes}
                    disabled={heartbeatLoading || heartbeatSaving}
                    onChange={(event) => {
                      setHeartbeatCustomMinutes(event.target.value);
                      setHeartbeatOverride(true);
                      setHeartbeatDirty(true);
                    }}
                    placeholder="Minutes"
                  />
                )}
              </div>

              {/* Target */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Target
                </label>
                <select
                  className="input text-sm"
                  value={heartbeatTargetMode}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatTargetMode(event.target.value as "last" | "none" | "custom");
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                >
                  <option value="last">Last channel</option>
                  <option value="none">No delivery</option>
                  <option value="custom">Custom</option>
                </select>
                {heartbeatTargetMode === "custom" && (
                  <input
                    className="input mt-2 text-sm"
                    value={heartbeatTargetCustom}
                    disabled={heartbeatLoading || heartbeatSaving}
                    onChange={(event) => {
                      setHeartbeatTargetCustom(event.target.value);
                      setHeartbeatOverride(true);
                      setHeartbeatDirty(true);
                    }}
                    placeholder="Channel id"
                  />
                )}
              </div>

              {/* Include reasoning */}
              <label className="flex items-center justify-between">
                <span className="text-sm text-foreground">Include reasoning</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  checked={heartbeatIncludeReasoning}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatIncludeReasoning(event.target.checked);
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                />
              </label>

              {/* Active hours */}
              <label className="flex items-center justify-between">
                <span className="text-sm text-foreground">Active hours</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  checked={heartbeatActiveHoursEnabled}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatActiveHoursEnabled(event.target.checked);
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                />
              </label>
              {heartbeatActiveHoursEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    className="input text-sm"
                    value={heartbeatActiveStart}
                    disabled={heartbeatLoading || heartbeatSaving}
                    onChange={(event) => {
                      setHeartbeatActiveStart(event.target.value);
                      setHeartbeatOverride(true);
                      setHeartbeatDirty(true);
                    }}
                  />
                  <input
                    type="time"
                    className="input text-sm"
                    value={heartbeatActiveEnd}
                    disabled={heartbeatLoading || heartbeatSaving}
                    onChange={(event) => {
                      setHeartbeatActiveEnd(event.target.value);
                      setHeartbeatOverride(true);
                      setHeartbeatDirty(true);
                    }}
                  />
                </div>
              )}

              {/* ACK max chars */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  ACK max chars
                </label>
                <input
                  type="number"
                  min={0}
                  className="input text-sm"
                  value={heartbeatAckMaxChars}
                  disabled={heartbeatLoading || heartbeatSaving}
                  onChange={(event) => {
                    setHeartbeatAckMaxChars(event.target.value);
                    setHeartbeatOverride(true);
                    setHeartbeatDirty(true);
                  }}
                />
              </div>

              {/* Save button */}
              <button
                className="btn-primary w-full disabled:opacity-50"
                type="button"
                disabled={heartbeatLoading || heartbeatSaving || !heartbeatDirty}
                onClick={() => void saveHeartbeat()}
              >
                {heartbeatSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
