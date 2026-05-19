import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type ReactFlowInstance,
  type Node,
} from "@xyflow/react";
import { flowsApi, type Flow } from "@/lib/api";
import { nodeTypes, defaultNodeData } from "./nodes";

interface Props {
  flow: Flow;
  projectId: string;
  saveRef: React.MutableRefObject<() => Promise<void>>;
}

export function FlowCanvas({ flow, projectId, saveRef }: Props) {
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const stored = flow.flow_json as { nodes?: Node[]; edges?: object[] } | null;
  const [nodes, setNodes, onNodesChange] = useNodesState(stored?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (stored?.edges ?? []) as Parameters<typeof useEdgesState>[0]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Keep save function current
  useEffect(() => {
    saveRef.current = async () => {
      await flowsApi.update(projectId, flow.id, {
        flow_json: { nodes, edges },
      });
    };
  }, [nodes, edges, flow.id, projectId, saveRef]);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("nodeType");
      if (!type || !rfInstance) return;

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position,
        data: defaultNodeData(type),
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [rfInstance, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        className="bg-zinc-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#3f3f46"
        />
        <Controls className="[&>button]:bg-zinc-800 [&>button]:border-zinc-700 [&>button]:text-zinc-300 [&>button:hover]:bg-zinc-700" />
        <MiniMap
          className="!bg-zinc-900 !border !border-zinc-800"
          nodeColor="#52525b"
          maskColor="rgba(9,9,11,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
