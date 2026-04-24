import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  applyNodeChanges,
  getNodesBounds,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeDragHandler,
  type NodeTypes,
  type OnNodesChange,
  type ReactFlowInstance,
  type XYPosition,
  type IsValidConnection,
  type OnEdgeUpdateFunc,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { getBranchDirectionFromHandle, getBranchDirectionFromPositions, getBranchEdgeHandles } from '../../lib/edgeHandles'
import { collectSubtreeIds, computeTreeLayout, getNodePath, getVisibleNodeIds } from '../../lib/graph'
import { useExperimentStore } from '../../store/experimentStore'
import type { BranchDirection } from '../../types/experiment'
import { ExperimentNodeCard, type ExperimentNodeData } from './ExperimentNodeCard'

const xGap = 300
const yGap = 180
const branchConflictThreshold = {
  x: 120,
  y: 90,
}
const branchPositionAttempts = 24
const branchOffsets: Record<BranchDirection, XYPosition> = {
  left: { x: -xGap, y: 0 },
  right: { x: xGap, y: 0 },
  top: { x: 0, y: -yGap },
  bottom: { x: 0, y: yGap },
}
const branchStackOffsets: Record<BranchDirection, XYPosition> = {
  left: { x: 0, y: 74 },
  right: { x: 0, y: 74 },
  top: { x: 74, y: 0 },
  bottom: { x: 74, y: 0 },
}

const nodeTypes: NodeTypes = {
  experiment: ExperimentNodeCard,
}

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
}

const proOptions = {
  hideAttribution: true,
}

const fitViewOptions = {
  maxZoom: 0.9,
  padding: 0.22,
}

const viewportPadding = {
  x: 72,
  y: 64,
}
const nodeDropTargetPadding = 28
type PositionedNode = Pick<Node, 'position' | 'width' | 'height'>

const getNodeCenter = (node: PositionedNode): XYPosition => ({
  x: node.position.x + (node.width ?? 0) / 2,
  y: node.position.y + (node.height ?? 0) / 2,
})

const isPointInsidePaddedNode = (point: XYPosition, node: PositionedNode, padding: number) => {
  const width = node.width ?? 0
  const height = node.height ?? 0

  return (
    point.x >= node.position.x - padding &&
    point.x <= node.position.x + width + padding &&
    point.y >= node.position.y - padding &&
    point.y <= node.position.y + height + padding
  )
}

const getDistance = (from: XYPosition, to: XYPosition) => Math.hypot(from.x - to.x, from.y - to.y)

type ExperimentFlowProps = {
  onCreateRoot: () => void
}

export function ExperimentFlow({ onCreateRoot }: ExperimentFlowProps) {
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null)
  const [activeDropTargetNodeId, setActiveDropTargetNodeId] = useState<string | null>(null)
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const flowContainerRef = useRef<HTMLDivElement | null>(null)
  const lastAutoFitNodeIdsKeyRef = useRef<string | null>(null)

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
  const moveNodeToParent = useExperimentStore((state) => state.moveNodeToParent)
  const updateNodeEdgeConnection = useExperimentStore((state) => state.updateNodeEdgeConnection)

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
  const nodeIdsKey = useMemo(() => Object.keys(document.nodesById).sort().join('|'), [document.nodesById])

  const canMoveNodeToParent = useCallback(
    (nodeId: string, parentId: string) => {
      const node = document.nodesById[nodeId]

      if (!node?.parentId || nodeId === parentId) {
        return false
      }

      return !collectSubtreeIds(document, nodeId).includes(parentId)
    },
    [document],
  )

  const getDropTargetNodeId = useCallback(
    (draggedNode: Node): string | null => {
      const instance = flowInstanceRef.current
      if (!instance) {
        return null
      }

      const draggedCenter = getNodeCenter(draggedNode)
      let bestTargetId: string | null = null
      let bestTargetDistance = Number.POSITIVE_INFINITY

      instance.getNodes().forEach((candidateNode) => {
        if (!canMoveNodeToParent(draggedNode.id, candidateNode.id)) {
          return
        }

        if (!isPointInsidePaddedNode(draggedCenter, candidateNode, nodeDropTargetPadding)) {
          return
        }

        const distance = getDistance(draggedCenter, getNodeCenter(candidateNode))

        if (distance < bestTargetDistance) {
          bestTargetId = candidateNode.id
          bestTargetDistance = distance
        }
      })

      return bestTargetId
    },
    [canMoveNodeToParent],
  )

  const scheduleFitView = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const instance = flowInstanceRef.current
        const container = flowContainerRef.current
        if (!instance || !container) {
          return
        }

        const measuredNodes = instance
          .getNodes()
          .filter((node) => node.width && node.height)
        const bounds = measuredNodes.length ? getNodesBounds(measuredNodes) : null
        const { width } = container.getBoundingClientRect()

        if (!bounds || width <= 0) {
          instance.fitView(fitViewOptions)
          return
        }

        const zoom = Math.min(
          fitViewOptions.maxZoom,
          Math.max(0.35, (width - viewportPadding.x * 2) / bounds.width),
        )

        instance.setViewport({
          x: (width - bounds.width * zoom) / 2 - bounds.x * zoom,
          y: viewportPadding.y - bounds.y * zoom,
          zoom,
        })
      }, 80)
    })
  }, [])

  const getNodeCanvasPosition = useCallback(
    (nodeId: string): XYPosition => {
      const node = document.nodesById[nodeId]
      const autoPosition = layout[nodeId] ?? { x: 0, y: 0 }

      return node?.manualPosition ?? {
        x: autoPosition.x * xGap,
        y: autoPosition.y * yGap,
      }
    },
    [document, layout],
  )

  const hasPositionConflict = useCallback(
    (position: XYPosition, ignoredNodeId: string) =>
      Object.keys(document.nodesById).some((nodeId) => {
        if (nodeId === ignoredNodeId) {
          return false
        }

        const nodePosition = getNodeCanvasPosition(nodeId)
        return (
          Math.abs(nodePosition.x - position.x) < branchConflictThreshold.x &&
          Math.abs(nodePosition.y - position.y) < branchConflictThreshold.y
        )
      }),
    [document, getNodeCanvasPosition],
  )

  const getBranchPosition = useCallback(
    (nodeId: string, direction: BranchDirection = 'right'): XYPosition => {
      const parentPosition = getNodeCanvasPosition(nodeId)
      const offset = branchOffsets[direction]
      const stackOffset = branchStackOffsets[direction]
      const desiredPosition = {
        x: parentPosition.x + offset.x,
        y: parentPosition.y + offset.y,
      }

      for (let index = 0; index < branchPositionAttempts; index += 1) {
        const directionMultiplier = index % 2 === 0 ? 1 : -1
        const distance = Math.ceil(index / 2)
        const candidate = {
          x: desiredPosition.x + stackOffset.x * distance * directionMultiplier,
          y: desiredPosition.y + stackOffset.y * distance * directionMultiplier,
        }

        if (!hasPositionConflict(candidate, nodeId)) {
          return candidate
        }
      }

      return desiredPosition
    },
    [getNodeCanvasPosition, hasPositionConflict],
  )

  const handleBranchFromNode = useCallback(
    (nodeId: string, direction: BranchDirection = 'right') => {
      branchFromNode(nodeId, getBranchPosition(nodeId, direction), direction)
    },
    [branchFromNode, getBranchPosition],
  )

  const documentNodes = useMemo<Node<ExperimentNodeData>[]>(() => {
    return Object.values(document.nodesById).map((node) => {
      const isVisible = visibleIdSet.has(node.id)
      const isSelected = node.id === selectedNodeId
      const isCompareTarget = node.id === compareNodeId
      const isDragging = node.id === activeDragNodeId
      const isDropTarget = node.id === activeDropTargetNodeId

      return {
        id: node.id,
        type: 'experiment',
        position: getNodeCanvasPosition(node.id),
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
          isDropTarget,
          isDimmed: !isVisible,
          attachmentCount: node.attachments.length,
          onSelect: selectNode,
          onBranch: handleBranchFromNode,
          onCycleStatus: cycleNodeStatus,
          onSetCompare: toggleCompareNode,
          onRename: updateNodeTitle,
        },
      }
    })
  }, [activeDragNodeId, activeDropTargetNodeId, compareNodeId, cycleNodeStatus, document, getNodeCanvasPosition, handleBranchFromNode, selectNode, selectedNodeId, toggleCompareNode, updateNodeTitle, visibleIdSet])

  const documentEdges = useMemo<Edge[]>(() => {
    return Object.values(document.nodesById)
      .filter((node) => node.parentId)
      .map((node) => {
        const isOnSelectedPath = selectedPathSet.has(node.id) && selectedPathSet.has(node.parentId ?? '')
        const edgeHandles = getBranchEdgeHandles(
          getNodeCanvasPosition(node.parentId!),
          getNodeCanvasPosition(node.id),
          node.branchDirection,
          node.edgeConnection,
        )

        return {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId!,
          target: node.id,
          ...edgeHandles,
          animated: isOnSelectedPath,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: isOnSelectedPath ? '#7a5f3b' : '#bfae93',
            strokeWidth: isOnSelectedPath ? 2.5 : 1.5,
            opacity: visibleIdSet.has(node.id) ? 1 : 0.2,
          },
        }
      })
  }, [document, getNodeCanvasPosition, selectedPathSet, visibleIdSet])

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

  useEffect(() => {
    if (activeDragNodeId || lastAutoFitNodeIdsKeyRef.current === nodeIdsKey) {
      return
    }

    lastAutoFitNodeIdsKeyRef.current = nodeIdsKey
    scheduleFitView()
  }, [activeDragNodeId, nodeIdsKey, scheduleFitView])

  const handleNodesChange = useCallback<OnNodesChange>(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
    },
    [setNodes],
  )

  const handleNodeDragStart = useCallback<NodeDragHandler>(
    (_, node) => {
      setActiveDragNodeId(node.id)
      setActiveDropTargetNodeId(null)
      selectNode(node.id)
    },
    [selectNode],
  )

  const handleNodeDrag = useCallback<NodeDragHandler>(
    (_, node) => {
      setActiveDropTargetNodeId(getDropTargetNodeId(node))
    },
    [getDropTargetNodeId],
  )

  const handleNodeDragStop = useCallback<NodeDragHandler>(
    (_, node) => {
      const { x, y } = node.position as XYPosition
      const dropTargetNodeId = getDropTargetNodeId(node)
      const dropTargetPosition = dropTargetNodeId ? getNodeCanvasPosition(dropTargetNodeId) : null

      if (dropTargetNodeId && dropTargetPosition) {
        moveNodeToParent(
          node.id,
          dropTargetNodeId,
          { x, y },
          getBranchDirectionFromPositions(dropTargetPosition, { x, y }),
        )
      } else {
        setNodeManualPosition(node.id, { x, y })
      }

      setActiveDropTargetNodeId(null)
      setActiveDragNodeId((current) => (current === node.id ? null : current))
    },
    [getDropTargetNodeId, getNodeCanvasPosition, moveNodeToParent, setNodeManualPosition],
  )

  const isValidEdgeReconnect = useCallback<IsValidConnection>(
    (connection) => {
      if (!('source' in connection) || !connection.source || !connection.target) {
        return false
      }

      const targetNode = document.nodesById[connection.target]
      return targetNode?.parentId === connection.source
    },
    [document],
  )

  const handleEdgeReconnect = useCallback<OnEdgeUpdateFunc>(
    (oldEdge: Edge, connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }

      const targetNode = document.nodesById[oldEdge.target]
      if (
        oldEdge.source !== connection.source ||
        oldEdge.target !== connection.target ||
        targetNode?.parentId !== oldEdge.source
      ) {
        return
      }

      const sourceDirection = getBranchDirectionFromHandle(connection.sourceHandle)
      const targetDirection = getBranchDirectionFromHandle(connection.targetHandle)

      if (!sourceDirection || !targetDirection) {
        return
      }

      updateNodeEdgeConnection(oldEdge.target, { sourceDirection, targetDirection })
    },
    [document, updateNodeEdgeConnection],
  )

  const handleFlowInit = useCallback(
    (instance: ReactFlowInstance) => {
      flowInstanceRef.current = instance
      scheduleFitView()
    },
    [scheduleFitView],
  )

  if (!document.rootId) {
    return (
      <div className="flex min-h-[540px] flex-1 items-center justify-center rounded-[30px] border border-dashed border-pencil bg-white/70 p-10 text-center shadow-note">
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
    <div ref={flowContainerRef} className="min-h-[640px] flex-1 overflow-hidden rounded-[30px] border border-pencil bg-white/70 shadow-note">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable
        edgesUpdatable
        reconnectRadius={16}
        fitView
        fitViewOptions={fitViewOptions}
        onInit={handleFlowInit}
        onNodeClick={(_, node) => selectNode(node.id)}
        onNodesChange={handleNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onReconnect={handleEdgeReconnect}
        isValidConnection={isValidEdgeReconnect}
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
