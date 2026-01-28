"use client";

import { NodeResizeControl, type Node, type NodeProps } from "@xyflow/react";
import type { AgentTile as AgentTileType, TileSize } from "@/features/canvas/state/store";
import { AgentTile, MIN_TILE_SIZE } from "./AgentTile";

export type AgentTileNodeData = {
  tile: AgentTileType;
  projectId: string | null;
  canSend: boolean;
  onResize: (size: TileSize) => void;
  onDelete: () => void;
  onNameChange: (name: string) => Promise<boolean>;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onAvatarShuffle: () => void;
  onNameShuffle: () => void;
};

type AgentTileNodeType = Node<AgentTileNodeData>;

export const AgentTileNode = ({ data, selected }: NodeProps<AgentTileNodeType>) => {
  const {
    tile,
    projectId,
    canSend,
    onResize,
    onDelete,
    onNameChange,
    onDraftChange,
    onSend,
    onModelChange,
    onThinkingChange,
    onAvatarShuffle,
    onNameShuffle,
  } = data;

  return (
    <div className="h-full w-full">
      <NodeResizeControl
        position="bottom"
        className="tile-resize-handle"
        minWidth={MIN_TILE_SIZE.width}
        maxWidth={MIN_TILE_SIZE.width}
        minHeight={MIN_TILE_SIZE.height}
        resizeDirection="vertical"
        onResizeEnd={(_, params) => {
          onResize({ width: MIN_TILE_SIZE.width, height: params.height });
        }}
      />
      <AgentTile
        tile={tile}
        projectId={projectId}
        isSelected={selected}
        canSend={canSend}
        onDelete={onDelete}
        onNameChange={onNameChange}
        onDraftChange={onDraftChange}
        onSend={onSend}
        onModelChange={onModelChange}
        onThinkingChange={onThinkingChange}
        onAvatarShuffle={onAvatarShuffle}
        onNameShuffle={onNameShuffle}
        onResize={onResize}
      />
    </div>
  );
};
