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
  type Edge,
} from "@xyflow/react";
import { flowsApi, type Flow } from "@/lib/api";
import { nodeTypes, defaultNodeData } from "./nodes";
import { NodePropertiesPanel } from "./NodePropertiesPanel";

interface Props {
  flow: Flow;
  projectId: string;
  saveRef: React.MutableRefObject<() => Promise<void>>;
}

// --- Schema conversion helpers ---

const RF_TO_NOODLE: Record<string, string> = {
  httpRequest: "http_request",
  jsonTransform: "json_transform",
  condition: "condition",
  trigger: "trigger",
};

const NOODLE_TO_RF: Record<string, string> = {
  http_request: "httpRequest",
  json_transform: "jsonTransform",
  condition: "condition",
  trigger: "trigger",
};

const DEFAULT_OUTPUTS: Record<string, Record<string, { type: string }>> = {
  http_request: {
    status: { type: "number" },
    body: { type: "any" },
    headers: { type: "object" },
  },
  json_transform: { result: { type: "object" } },
  condition: { result: { type: "boolean" } },
};

interface NoodleSchema {
  schema_version: string;
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  nodes: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
    outputs?: Record<string, { type: string }>;
  }>;
  edges: Array<{ from: string; to: string }>;
  output?: string;
  _ui?: {
    positions?: Record<string, { x: number; y: number }>;
    rf_edges?: Edge[];
  };
}

function toNoodleSchema(
  flowName: string,
  rfNodes: Node[],
  rfEdges: Edge[]
): NoodleSchema {
  const noodleNodes = rfNodes
    .filter((n) => n.type !== "trigger")
    .map((n) => {
      const noodleType = RF_TO_NOODLE[n.type ?? ""] ?? n.type ?? "unknown";
      const data = n.data as { config?: Record<string, unknown> };
      return {
        id: n.id,
        type: noodleType,
        config: data.config ?? {},
        outputs: DEFAULT_OUTPUTS[noodleType] ?? {},
      };
    });

  const noodleEdges = rfEdges
    .filter((e) => {
      const sourceNode = rfNodes.find((n) => n.id === e.source);
      return sourceNode?.type !== "trigger";
    })
    .map((e) => ({ from: e.source, to: e.target }));

  // Find terminal node (no outgoing edges, not trigger) for output expression.
  const sourcesWithEdges = new Set(noodleEdges.map((e) => e.from));
  const terminal = noodleNodes.findLast((n) => !sourcesWithEdges.has(n.id));
  let output = "";
  if (terminal) {
    const firstOutput = Object.keys(terminal.outputs ?? {})[0];
    if (firstOutput) {
      output = `{{nodes.${terminal.id}.outputs.${firstOutput}}}`;
    }
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of rfNodes) {
    positions[n.id] = n.position;
  }

  return {
    schema_version: "1.0",
    name: flowName,
    nodes: noodleNodes,
    edges: noodleEdges,
    output,
    _ui: { positions, rf_edges: rfEdges },
  };
}

function fromNoodleSchema(schema: NoodleSchema): { nodes: Node[]; edges: Edge[] } {
  const positions = schema._ui?.positions ?? {};
  const rfEdges = schema._ui?.rf_edges ?? schema.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.from,
    target: e.to,
  }));

  const rfNodes: Node[] = schema.nodes.map((n) => ({
    id: n.id,
    type: NOODLE_TO_RF[n.type] ?? n.type,
    position: positions[n.id] ?? { x: 0, y: 0 },
    data: {
      ...defaultNodeData(NOODLE_TO_RF[n.type] ?? n.type),
      label: n.id,
      config: n.config,
    },
  }));

  return { nodes: rfNodes, edges: rfEdges as Edge[] };
}

function loadInitial(stored: unknown): { nodes: Node[]; edges: Edge[] } {
  if (!stored || typeof stored !== "object") return { nodes: [], edges: [] };
  const s = stored as Record<string, unknown>;

  // New Noodle schema format.
  if (s.schema_version === "1.0") {
    return fromNoodleSchema(s as unknown as NoodleSchema);
  }

  // Legacy React Flow format.
  return {
    nodes: (s.nodes as Node[]) ?? [],
    edges: (s.edges as Edge[]) ?? [],
  };
}

// --- Component ---

export function FlowCanvas({ flow, projectId, saveRef }: Props) {
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { nodes: initNodes, edges: initEdges } = loadInitial(flow.flow_json);
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  function updateNodeData(id: string, data: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data } : n))
    );
  }

  useEffect(() => {
    saveRef.current = async () => {
      const schema = toNoodleSchema(flow.name, nodes, edges);
      await flowsApi.update(projectId, flow.id, { flow_json: schema });
    };
  }, [nodes, edges, flow.id, flow.name, projectId, saveRef]);

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
    <>
      <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode="Delete"
          className="bg-zinc-950"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#3f3f46" />
          <Controls className="[&>button]:bg-zinc-800 [&>button]:border-zinc-700 [&>button]:text-zinc-300 [&>button:hover]:bg-zinc-700" />
          <MiniMap
            className="!bg-zinc-900 !border !border-zinc-800"
            nodeColor="#52525b"
            maskColor="rgba(9,9,11,0.7)"
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <NodePropertiesPanel
          node={selectedNode}
          onUpdate={updateNodeData}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </>
  );
}
