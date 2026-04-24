import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
  type NodeDragHandler,
  type NodeTypes,
  type OnNodesChange,
  type XYPosition,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { computeTreeLayout, getNodePath, getVisibleNodeIds } from '../../lib/graph'
import { useExperimentStore } from '../../store/experimentStore'
import { ExperimentNodeCard, type ExperimentNodeData } from './ExperimentNodeCard'

const xGap = 360
const yGap = 220

const nodeTypes: NodeTypes = {
  experiment: ExperimentNodeCard,
}

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
}

const proOptions = {
  hideAttribution: true,
}

type ExperimentFlowProps = {
  onCreateRoot: () => void
}

export function ExperimentFlow({ onCreateRoot }: ExperimentFlowProps) {
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null)

  const document = useExperimentStore((state) => state.document)
  const selectedNodeId = useExperimentStore((state) => state.selectedNodeId)
  const compareNodeId = useExperimentStore((state) => state.compareNodeId)
  const searchQuery = useExperimentStore((state) => state.searchQuery)
  const statusFilters = useExperimentStore((state) => state.statusFilters)
  const selectNode = useExperimentStore((state) => state.selectNode)
  const branchFromNode = useExperimentStore((state) => state.branchFromNode)
  const cycleNodeStatus = useExperimentStore((state) => state.cycleNodeStatus)
  const setCompareNode = useExperimentStore((state) => state.setCompareNode)
  const updateNodeTitle = useExperimentStore((state) => state.updateNodeTitle)
  const setNodeManualPosition = useExperimentStore((state) => state.setNodeManualPosition)

  const toggleCompareNode = useCallback(
    (nodeId: string) => setCompareNode(nodeId === compareNodeId ? null : nodeId),
    [compareNodeId, setCompareNode],
  )

  const visibleNodeIds = useMemo(
    () => getVisibleNodeIds(document, searchQuery, statusFilters),
    [document, searchQuery, statusFilters],
  )
  const selectedPath = useMemo(
    () => getNodePath(document, selectedNodeId),
    [document, selectedNodeId],
  )
  const layout = useMemo(() => computeTreeLayout(document), [document])

  const visibleIdSet = useMemo(() => new Set(visibleNodeIds), [visibleNodeIds])
  const selectedPathSet = useMemo(() => new Set(selectedPath), [selectedPath])

  const documentNodes = useMemo<Node<ExperimentNodeData>[]>(() => {
    return Object.values(document.nodesById).map((node) => {
      const autoPosition = layout[node.id] ?? { x: 0, y: 0 }
      const isVisible = visibleIdSet.has(node.id)
      const isSelected = node.id === selectedNodeId
      const isCompareTarget = node.id === compareNodeId
      const isDragging = node.id === activeDragNodeId
      const position = node.manualPosition ?? {
        x: autoPosition.x * xGap,
        y: autoPosition.y * yGap,
      }

      return {
        id: node.id,
        type: 'experiment',
        position,
        dragHandle: '.drag-handle__custom',
        zIndex: isDragging ? 40 : isSelected ? 30 : isCompareTarget ? 20 : 10,
        data: {
          nodeId: node.id,
          title: node.title,
          changeSummary: node.changeSummary,
          conclusion: node.conclusion,
          status: node.status,
          timestamp: node.timestamp,
          branchLabel: node.branchLabel,
          isSelected,
          isCompareTarget,
          isDragging,
          isDimmed: !isVisible,
          attachmentCount: node.attachments.length,
          onSelect: selectNode,
          onBranch: branchFromNode,
          onCycleStatus: cycleNodeStatus,
          onSetCompare: toggleCompareNode,
          onRename: updateNodeTitle,
        },
      }
    })
  }, [activeDragNodeId, branchFromNode, compareNodeId, cycleNodeStatus, document, layout, selectNode, selectedNodeId, toggleCompareNode, updateNodeTitle, visibleIdSet])

  const documentEdges = useMemo<Edge[]>(() => {
    return Object.values(document.nodesById)
      .filter((node) => node.parentId)
      .map((node) => {
        const isOnSelectedPath = selectedPathSet.has(node.id) && selectedPathSet.has(node.parentId ?? '')

        return {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId!,
          target: node.id,
          animated: isOnSelectedPath,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: isOnSelectedPath ? '#7a5f3b' : '#bfae93',
            strokeWidth: isOnSelectedPath ? 2.5 : 1.5,
            opacity: visibleIdSet.has(node.id) ? 1 : 0.2,
          },
        }
      })
  }, [document, selectedPathSet, visibleIdSet])

  const [nodes, setNodes] = useNodesState(documentNodes)
  const [edges, setEdges] = useEdgesState(documentEdges)

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentPositions = new Map(currentNodes.map((node) => [node.id, node.position]))

      return documentNodes.map((node) => {
        if (node.id !== activeDragNodeId) {
          return node
        }

        const livePosition = currentPositions.get(node.id)
        return livePosition ? { ...node, position: livePosition } : node
      })
    })
  }, [activeDragNodeId, documentNodes, setNodes])

  useEffect(() => {
    setEdges(documentEdges)
  }, [documentEdges, setEdges])

  const handleNodesChange = useCallback<OnNodesChange>(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
    },
    [setNodes],
  )

  const handleNodeDragStart = useCallback<NodeDragHandler>(
    (_, node) => {
      setActiveDragNodeId(node.id)
      selectNode(node.id)
    },
    [selectNode],
  )

  const handleNodeDragStop = useCallback<NodeDragHandler>(
    (_, node) => {
      const { x, y } = node.position as XYPosition
      setNodeManualPosition(node.id, { x, y })
      setActiveDragNodeId((current) => (current === node.id ? null : current))
    },
    [setNodeManualPosition],
  )

  if (!document.rootId) {
    return (
      <div className="flex h-full min-h-[540px] items-center justify-center rounded-[30px] border border-dashed border-pencil bg-white/70 p-10 text-center shadow-note">
        <div className="max-w-md space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-ink/45">实验树为空</p>
          <h2 className="font-title text-3xl text-ink">先落下第一张实验便签</h2>
          <p className="text-sm leading-7 text-ink/70">
            创建根实验后，你就可以继续从它分叉、记录每次改动和总结每轮结论。
          </p>
          <button type="button" className="note-button note-button-primary" onClick={onCreateRoot}>
            创建根实验
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-[640px] overflow-hidden rounded-[30px] border border-pencil bg-white/70 shadow-note">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable
        fitView
        onNodeClick={(_, node) => selectNode(node.id)}
        onNodesChange={handleNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={proOptions}
      >
        <Background color="#e5d8c4" gap={24} size={1.2} />
        <MiniMap
          pannable
          zoomable
          nodeStrokeColor="#8e7452"
          nodeColor="#f3e8d7"
          maskColor="rgba(243, 234, 220, 0.68)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
