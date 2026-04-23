import { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node,
  type NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'

import {
  getExperimentDepth,
  getNodePath,
  getSiblingIndex,
  getVisibleNodeIds,
} from '../../lib/graph'
import { useExperimentStore } from '../../store/experimentStore'
import { ExperimentNodeCard, type ExperimentNodeData } from './ExperimentNodeCard'

const nodeTypes: NodeTypes = {
  experiment: ExperimentNodeCard,
}

const xGap = 360
const yGap = 220

type ExperimentFlowProps = {
  onCreateRoot: () => void
}

export function ExperimentFlow({ onCreateRoot }: ExperimentFlowProps) {
  const document = useExperimentStore((state) => state.document)
  const selectedNodeId = useExperimentStore((state) => state.selectedNodeId)
  const searchQuery = useExperimentStore((state) => state.searchQuery)
  const statusFilters = useExperimentStore((state) => state.statusFilters)
  const selectNode = useExperimentStore((state) => state.selectNode)

  const visibleNodeIds = useMemo(
    () => getVisibleNodeIds(document, searchQuery, statusFilters),
    [document, searchQuery, statusFilters],
  )
  const selectedPath = useMemo(
    () => getNodePath(document, selectedNodeId),
    [document, selectedNodeId],
  )

  const visibleIdSet = useMemo(() => new Set(visibleNodeIds), [visibleNodeIds])
  const selectedPathSet = useMemo(() => new Set(selectedPath), [selectedPath])

  const { nodes, edges } = useMemo(() => {
    const nextNodes: Node<ExperimentNodeData>[] = Object.values(document.nodesById).map((node) => {
      const depth = getExperimentDepth(document, node.id)
      const siblingIndex = getSiblingIndex(document, node.id)
      const isVisible = visibleIdSet.has(node.id)

      return {
        id: node.id,
        type: 'experiment',
        position: {
          x: depth * xGap,
          y: siblingIndex * yGap,
        },
        data: {
          title: node.title,
          changeSummary: node.changeSummary,
          conclusion: node.conclusion,
          status: node.status,
          timestamp: node.timestamp,
          branchLabel: node.branchLabel,
          isSelected: node.id === selectedNodeId,
          isDimmed: !isVisible,
        },
      }
    })

    const nextEdges: Edge[] = Object.values(document.nodesById)
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

    return { nodes: nextNodes, edges: nextEdges }
  }, [document, selectedNodeId, selectedPathSet, visibleIdSet])

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
        fitView
        nodesDraggable={false}
        onNodeClick={(_, node) => selectNode(node.id)}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
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
