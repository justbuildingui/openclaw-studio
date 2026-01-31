"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MissionControlLayout,
  MissionControlHeader,
  AgentsSidebar,
  MissionQueue,
  LiveFeed,
  GroupChat,
  AgentChatPanel,
  type Task,
  type TaskStatus,
  type FeedEvent,
  type ChatMessage,
} from "@/features/mission-control";
import { AgentInspectPanel } from "@/features/canvas/components/AgentInspectPanel";
import { WorkspaceSettingsPanel } from "@/features/canvas/components/WorkspaceSettingsPanel";
import { useGatewayConnection } from "@/lib/gateway/useGatewayConnection";
import type { EventFrame } from "@/lib/gateway/frames";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import {
  AgentCanvasProvider,
  useAgentCanvasStore,
} from "@/features/canvas/state/store";
import { extractText } from "@/lib/text/extractText";
import { stripUiMetadata } from "@/lib/text/uiMetadata";
import { createRandomAgentName } from "@/lib/names/agentNames";
import { buildAgentInstruction } from "@/lib/projects/message";
import { filterArchivedItems } from "@/lib/projects/archive";
import { logger } from "@/lib/logger";

type ChatEventPayload = {
  sessionKey?: string;
  state?: "delta" | "final" | "aborted" | "error";
  errorMessage?: string;
  message?: Record<string, unknown>;
};

function MissionControlPageContent() {
  const { client, status } = useGatewayConnection();
  const { state, dispatch, createTile, refreshStore, deleteTile } = useAgentCanvasStore();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [inspectTileId, setInspectTileId] = useState<string | null>(null);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [gatewayModels, setGatewayModels] = useState<GatewayModelChoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);

  const project = useMemo(
    () => state.projects.find((entry) => !entry.archivedAt) ?? null,
    [state.projects]
  );

  const tiles = useMemo(
    () => filterArchivedItems(project?.tiles ?? [], false),
    [project?.tiles]
  );

  const workspacePath = project?.repoPath?.trim() ?? "";
  const needsWorkspace = state.needsWorkspace || !workspacePath;

  const selectedTile = useMemo(
    () => tiles.find((t) => t.id === selectedAgentId) ?? null,
    [tiles, selectedAgentId]
  );

  const inspectTile = useMemo(
    () => tiles.find((t) => t.id === inspectTileId) ?? null,
    [tiles, inspectTileId]
  );

  // Load gateway models
  useEffect(() => {
    if (status !== "connected") {
      setGatewayModels([]);
      return;
    }
    let cancelled = false;
    const loadModels = async () => {
      try {
        const result = await client.call<{ models: GatewayModelChoice[] }>("models.list", {});
        if (!cancelled) {
          setGatewayModels(Array.isArray(result.models) ? result.models : []);
        }
      } catch (err) {
        logger.error("Failed to load models", err);
      }
    };
    void loadModels();
    return () => { cancelled = true; };
  }, [client, status]);

  // Add feed event helper
  const addFeedEvent = useCallback((event: Omit<FeedEvent, "id" | "timestamp">) => {
    setFeedEvents((prev) => [
      ...prev,
      { ...event, id: crypto.randomUUID(), timestamp: Date.now() },
    ]);
  }, []);

  // Listen to gateway events
  useEffect(() => {
    return client.onEvent((event: EventFrame) => {
      if (event.event !== "chat") return;
      const payload = event.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey || !project) return;

      const tile = tiles.find((t) => t.sessionKey === payload.sessionKey);
      if (!tile) return;

      if (payload.state === "final") {
        const text = extractText(payload.message);
        const cleaned = text ? stripUiMetadata(text) : null;
        if (cleaned?.trim()) {
          addFeedEvent({
            type: "message",
            agentId: tile.id,
            content: cleaned.slice(0, 200) + (cleaned.length > 200 ? "..." : ""),
          });
          dispatch({
            type: "appendOutput",
            projectId: project.id,
            tileId: tile.id,
            line: cleaned,
          });
          dispatch({
            type: "updateTile",
            projectId: project.id,
            tileId: tile.id,
            patch: { status: "idle", streamText: null, lastResult: cleaned, latestPreview: cleaned },
          });

          // Add to group chat if this was a group message response
          setGroupMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              senderId: tile.id,
              senderName: tile.name,
              content: cleaned,
              timestamp: Date.now(),
            },
          ]);
        }
      } else if (payload.state === "delta") {
        const text = extractText(payload.message);
        if (text) {
          dispatch({ type: "setStream", projectId: project.id, tileId: tile.id, value: stripUiMetadata(text) });
          dispatch({ type: "updateTile", projectId: project.id, tileId: tile.id, patch: { status: "running" } });
        }
      }
    });
  }, [addFeedEvent, client, dispatch, project, tiles]);

  // Handlers
  const handleAddAgent = useCallback(async () => {
    if (!project || needsWorkspace) {
      setShowWorkspaceSettings(true);
      return;
    }
    const name = createRandomAgentName();
    const result = await createTile(project.id, name, "coding");
    if (result) {
      addFeedEvent({ type: "system", content: `New agent "${name}" created` });
    }
  }, [addFeedEvent, createTile, needsWorkspace, project]);

  const handleSendToAgent = useCallback(async (message: string) => {
    if (!project || !selectedTile) return;
    const trimmed = message.trim();
    if (!trimmed) return;

    dispatch({
      type: "updateTile",
      projectId: project.id,
      tileId: selectedTile.id,
      patch: { status: "running", draft: "", lastUserMessage: trimmed },
    });
    dispatch({ type: "appendOutput", projectId: project.id, tileId: selectedTile.id, line: `> ${trimmed}` });

    try {
      await client.call("chat.send", {
        sessionKey: selectedTile.sessionKey,
        message: buildAgentInstruction({ workspacePath: selectedTile.workspacePath, message: trimmed }),
        deliver: false,
      });
      addFeedEvent({ type: "message", content: `You → ${selectedTile.name}: ${trimmed.slice(0, 100)}...` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gateway error";
      dispatch({ type: "updateTile", projectId: project.id, tileId: selectedTile.id, patch: { status: "error" } });
      dispatch({ type: "appendOutput", projectId: project.id, tileId: selectedTile.id, line: `Error: ${msg}` });
    }
  }, [addFeedEvent, client, dispatch, project, selectedTile]);

  const handleGroupMessage = useCallback(async (message: string) => {
    if (!project) return;
    const trimmed = message.trim();
    if (!trimmed) return;

    setGroupMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), senderId: "user", senderName: "You", content: trimmed, timestamp: Date.now() },
    ]);

    for (const tile of tiles) {
      if (!tile.sessionKey) continue;
      dispatch({ type: "updateTile", projectId: project.id, tileId: tile.id, patch: { status: "running" } });
      try {
        await client.call("chat.send", {
          sessionKey: tile.sessionKey,
          message: buildAgentInstruction({ workspacePath: tile.workspacePath, message: `[Group Chat] ${trimmed}` }),
          deliver: false,
        });
      } catch (err) {
        logger.error(`Failed to send to ${tile.name}`, err);
      }
    }
    addFeedEvent({ type: "message", content: `You (group): ${trimmed.slice(0, 100)}...` });
  }, [addFeedEvent, client, dispatch, project, tiles]);

  const handleTaskMove = useCallback((taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, updatedAt: Date.now() } : t)));
  }, []);

  const handleAddTask = useCallback((status: TaskStatus) => {
    const title = window.prompt("Task title:");
    if (!title?.trim()) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), title: title.trim(), status, createdAt: Date.now(), updatedAt: Date.now() }]);
  }, []);

  return (
    <>
      <MissionControlLayout
        header={
          <MissionControlHeader
            workspaceLabel={project?.name || "OpenClaw Studio"}
            status={status}
            agentCount={tiles.length}
            activeAgentCount={tiles.filter(t => t.status === "running").length}
            taskCount={tasks.length}
            onOpenSettings={() => setShowWorkspaceSettings(true)}
          />
        }
        sidebar={
          <AgentsSidebar
            agents={tiles}
            selectedAgentId={selectedAgentId}
            onSelectAgent={(id) => setSelectedAgentId((prev) => (prev === id ? null : id))}
            onAddAgent={handleAddAgent}
            onInspectAgent={setInspectTileId}
            canAddAgent={!needsWorkspace && !!project}
          />
        }
        queue={
          <MissionQueue tasks={tasks} agents={tiles} onTaskMove={handleTaskMove} onAddTask={handleAddTask} />
        }
        chatPanel={
          selectedTile ? (
            <AgentChatPanel
              tile={selectedTile}
              onClose={() => setSelectedAgentId(null)}
              onSend={handleSendToAgent}
              onOpenFiles={() => setInspectTileId(selectedTile.id)}
              onOpenSettings={() => setInspectTileId(selectedTile.id)}
              canSend={status === "connected"}
            />
          ) : undefined
        }
        liveFeed={<LiveFeed events={feedEvents} agents={tiles} />}
        groupChat={
          <GroupChat
            messages={groupMessages}
            agents={tiles}
            onSendMessage={handleGroupMessage}
            disabled={status !== "connected" || tiles.length === 0}
          />
        }
      />

      {/* Inspect Panel Overlay */}
      {inspectTile && project && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4">
          <div className="h-full max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-auto rounded-lg bg-background shadow-xl">
            <AgentInspectPanel
              tile={inspectTile}
              projectId={project.id}
              models={gatewayModels}
              onClose={() => setInspectTileId(null)}
              onLoadHistory={() => {}}
              onModelChange={async (value) => {
                try {
                  await client.call("sessions.patch", { key: inspectTile.sessionKey, model: value ?? null });
                } catch (err) {
                  logger.error("Failed to update model", err);
                }
              }}
              onThinkingChange={async (value) => {
                try {
                  await client.call("sessions.patch", { key: inspectTile.sessionKey, thinkingLevel: value ?? null });
                } catch (err) {
                  logger.error("Failed to update thinking", err);
                }
              }}
              onDelete={async () => {
                await deleteTile(project.id, inspectTile.id);
                setInspectTileId(null);
                if (selectedAgentId === inspectTile.id) setSelectedAgentId(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Workspace Settings Overlay */}
      {showWorkspaceSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl">
            <WorkspaceSettingsPanel
              onClose={() => setShowWorkspaceSettings(false)}
              onSaved={async () => {
                setShowWorkspaceSettings(false);
                await refreshStore();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function MissionControlPage() {
  return (
    <AgentCanvasProvider>
      <MissionControlPageContent />
    </AgentCanvasProvider>
  );
}
