import {
  defaultExperimentDraft,
  documentVersion,
  experimentStatuses,
  type BranchDirection,
  type ExperimentAttachment,
  type ExperimentDocument,
  type ExperimentDraft,
  type ExperimentEdgeConnection,
  type ExperimentManualPosition,
  type ExperimentNode,
  type ExperimentNodeId,
  type ExperimentStatus,
} from '../types/experiment'

const createNodeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `exp-${Math.random().toString(36).slice(2, 10)}`
}

const nowIso = () => new Date().toISOString()

const toTimestampValue = (timestamp: string) => {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime()
}

const normalizeAttachment = (attachment: Partial<ExperimentAttachment>): ExperimentAttachment => ({
  id: attachment.id ?? createNodeId(),
  name: attachment.name ?? '未命名图片',
  type: attachment.type ?? 'image/png',
  size: attachment.size ?? 0,
  kind: 'image',
  dataUrl: attachment.dataUrl ?? '',
  createdAt: attachment.createdAt ?? nowIso(),
})

const normalizeAttachments = (attachments: Partial<ExperimentAttachment>[] | undefined) =>
  (attachments ?? []).map(normalizeAttachment)

const normalizeStatus = (status: unknown): ExperimentStatus =>
  experimentStatuses.includes(status as ExperimentStatus) ? (status as ExperimentStatus) : 'running'

const branchDirections = ['left', 'right', 'top', 'bottom'] as const

const normalizeBranchDirection = (direction: unknown): BranchDirection | undefined =>
  branchDirections.includes(direction as BranchDirection) ? (direction as BranchDirection) : undefined

const normalizeEdgeConnection = (
  edgeConnection: Partial<ExperimentEdgeConnection> | undefined,
): ExperimentEdgeConnection | undefined => {
  const sourceDirection = normalizeBranchDirection(edgeConnection?.sourceDirection)
  const targetDirection = normalizeBranchDirection(edgeConnection?.targetDirection)

  return sourceDirection && targetDirection ? { sourceDirection, targetDirection } : undefined
}

const normalizeManualPosition = (
  position: Partial<ExperimentManualPosition> | undefined,
): ExperimentManualPosition | undefined => {
  if (!position) {
    return undefined
  }

  const { x, y } = position
  if (typeof x !== 'number' || typeof y !== 'number') {
    return undefined
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined
  }

  return { x, y }
}

export const normalizeDocument = (raw: unknown): ExperimentDocument | null => {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    version?: number
    rootId?: string | null
    nodesById?: Record<string, Partial<ExperimentNode>>
  }

  if (!candidate.nodesById || typeof candidate.nodesById !== 'object') {
    return null
  }

  const nodesById = Object.fromEntries(
    Object.entries(candidate.nodesById).map(([id, node]) => {
      const baseDraft = {
        ...defaultExperimentDraft(),
        ...node,
      }

      const normalizedNode: ExperimentNode = {
        id,
        parentId: node.parentId ?? null,
        childIds: Array.isArray(node.childIds) ? [...node.childIds] : [],
        title: baseDraft.title,
        changeSummary: baseDraft.changeSummary,
        result: baseDraft.result,
        conclusion: baseDraft.conclusion,
        status: normalizeStatus(baseDraft.status),
        timestamp: baseDraft.timestamp,
        tags: Array.isArray(baseDraft.tags)
          ? baseDraft.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        notes: baseDraft.notes,
        branchLabel: baseDraft.branchLabel,
        attachments: normalizeAttachments(node.attachments),
        branchDirection: normalizeBranchDirection(node.branchDirection),
        edgeConnection: normalizeEdgeConnection(node.edgeConnection),
        manualPosition: normalizeManualPosition(node.manualPosition),
        createdAt: node.createdAt ?? nowIso(),
        updatedAt: node.updatedAt ?? node.createdAt ?? nowIso(),
      }

      return [id, normalizedNode]
    }),
  )

  const rootId =
    candidate.rootId && nodesById[candidate.rootId] ? candidate.rootId : Object.keys(nodesById)[0] ?? null

  return {
    version: documentVersion,
    rootId,
    nodesById,
  }
}

const createExperimentNode = (
  draft: Partial<ExperimentDraft> = {},
  parentId: ExperimentNodeId | null = null,
): ExperimentNode => {
  const createdAt = nowIso()
  const baseDraft = {
    ...defaultExperimentDraft(),
    ...draft,
  }

  return {
    id: createNodeId(),
    parentId,
    childIds: [],
    title: baseDraft.title,
    changeSummary: baseDraft.changeSummary,
    result: baseDraft.result,
    conclusion: baseDraft.conclusion,
    status: baseDraft.status,
    timestamp: baseDraft.timestamp,
    tags: [...baseDraft.tags],
    notes: baseDraft.notes,
    branchLabel: baseDraft.branchLabel,
    attachments: normalizeAttachments(baseDraft.attachments),
    branchDirection: undefined,
    edgeConnection: undefined,
    manualPosition: undefined,
    createdAt,
    updatedAt: createdAt,
  }
}

export const createInitialDocument = (): ExperimentDocument => ({
  version: documentVersion,
  rootId: null,
  nodesById: {},
})

export const getNodeById = (document: ExperimentDocument, nodeId: ExperimentNodeId | null) =>
  nodeId ? document.nodesById[nodeId] ?? null : null

export const createRootExperiment = (
  document: ExperimentDocument,
  draft: Partial<ExperimentDraft> = {},
) => {
  if (document.rootId) {
    throw new Error('Root experiment already exists')
  }

  const rootNode = createExperimentNode(draft, null)

  return {
    document: {
      ...document,
      rootId: rootNode.id,
      nodesById: {
        [rootNode.id]: rootNode,
      },
    },
    createdNodeId: rootNode.id,
  }
}

export const addChildExperiment = (
  document: ExperimentDocument,
  parentId: ExperimentNodeId,
  draft: Partial<ExperimentDraft> = {},
  options: { manualPosition?: ExperimentManualPosition; branchDirection?: BranchDirection } = {},
) => {
  const parentNode = document.nodesById[parentId]

  if (!parentNode) {
    throw new Error(`Parent experiment ${parentId} not found`)
  }

  const childNode: ExperimentNode = {
    ...createExperimentNode(draft, parentId),
    branchDirection: normalizeBranchDirection(options.branchDirection),
    manualPosition: normalizeManualPosition(options.manualPosition),
  }

  return {
    document: {
      ...document,
      nodesById: {
        ...document.nodesById,
        [parentId]: {
          ...parentNode,
          childIds: [...parentNode.childIds, childNode.id],
          updatedAt: nowIso(),
        },
        [childNode.id]: childNode,
      },
    },
    createdNodeId: childNode.id,
  }
}

const countExistingBranches = (document: ExperimentDocument, parentId: ExperimentNodeId) => {
  const parentNode = document.nodesById[parentId]
  return parentNode ? parentNode.childIds.length : 0
}

export const buildBranchDraft = (
  document: ExperimentDocument,
  parentId: ExperimentNodeId,
): Partial<ExperimentDraft> => {
  const parentNode = document.nodesById[parentId]

  if (!parentNode) {
    throw new Error(`Parent experiment ${parentId} not found`)
  }

  const branchIndex = countExistingBranches(document, parentId) + 1

  return {
    title: parentNode.title ? `${parentNode.title} · 分支 ${branchIndex}` : `实验分支 ${branchIndex}`,
    status: 'running',
    timestamp: new Date().toISOString().slice(0, 16),
    tags: [...parentNode.tags],
    notes: '',
    branchLabel: `分支 ${branchIndex}`,
    attachments: [],
    changeSummary: '',
    result: '',
    conclusion: '',
  }
}

export const updateExperimentNode = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
  patch: Partial<ExperimentDraft>,
) => {
  const node = document.nodesById[nodeId]

  if (!node) {
    throw new Error(`Experiment ${nodeId} not found`)
  }

  const nextNode: ExperimentNode = {
    ...node,
    ...patch,
    tags: patch.tags ? [...patch.tags] : node.tags,
    attachments: patch.attachments ? normalizeAttachments(patch.attachments) : node.attachments,
    updatedAt: nowIso(),
  }

  return {
    ...document,
    nodesById: {
      ...document.nodesById,
      [nodeId]: nextNode,
    },
  }
}

export const updateExperimentNodeManualPosition = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
  manualPosition: ExperimentManualPosition,
) => {
  const node = document.nodesById[nodeId]

  if (!node) {
    throw new Error(`Experiment ${nodeId} not found`)
  }

  return {
    ...document,
    nodesById: {
      ...document.nodesById,
      [nodeId]: {
        ...node,
        manualPosition: normalizeManualPosition(manualPosition),
        updatedAt: nowIso(),
      },
    },
  }
}

export const updateExperimentEdgeConnection = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
  edgeConnection: ExperimentEdgeConnection,
) => {
  const node = document.nodesById[nodeId]

  if (!node) {
    throw new Error(`Experiment ${nodeId} not found`)
  }

  return {
    ...document,
    nodesById: {
      ...document.nodesById,
      [nodeId]: {
        ...node,
        edgeConnection: normalizeEdgeConnection(edgeConnection),
        updatedAt: nowIso(),
      },
    },
  }
}

export const moveExperimentSubtree = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
  nextParentId: ExperimentNodeId,
  options: { manualPosition?: ExperimentManualPosition; branchDirection?: BranchDirection } = {},
) => {
  const node = document.nodesById[nodeId]
  const nextParentNode = document.nodesById[nextParentId]

  if (!node) {
    throw new Error(`Experiment ${nodeId} not found`)
  }

  if (!nextParentNode) {
    throw new Error(`Parent experiment ${nextParentId} not found`)
  }

  if (!node.parentId) {
    throw new Error('Root experiment cannot be moved')
  }

  if (nodeId === nextParentId || collectSubtreeIds(document, nodeId).includes(nextParentId)) {
    throw new Error('Cannot move an experiment under itself or its descendants')
  }

  const currentParentNode = document.nodesById[node.parentId]
  const updatedAt = nowIso()
  const normalizedManualPosition = normalizeManualPosition(options.manualPosition)
  const normalizedBranchDirection = normalizeBranchDirection(options.branchDirection)

  return {
    ...document,
    nodesById: {
      ...document.nodesById,
      ...(currentParentNode
        ? {
            [currentParentNode.id]: {
              ...currentParentNode,
              childIds: currentParentNode.childIds.filter((childId) => childId !== nodeId),
              updatedAt,
            },
          }
        : {}),
      [nextParentId]: {
        ...nextParentNode,
        childIds: nextParentNode.childIds.includes(nodeId)
          ? nextParentNode.childIds
          : [...nextParentNode.childIds, nodeId],
        updatedAt,
      },
      [nodeId]: {
        ...node,
        parentId: nextParentId,
        branchDirection: normalizedBranchDirection,
        edgeConnection: undefined,
        manualPosition: normalizedManualPosition,
        updatedAt,
      },
    },
  }
}

export const collectSubtreeIds = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
): ExperimentNodeId[] => {
  const node = document.nodesById[nodeId]
  if (!node) {
    return []
  }

  return [
    nodeId,
    ...node.childIds.flatMap((childId) => collectSubtreeIds(document, childId)),
  ]
}

export const deleteExperimentSubtree = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
) => {
  const node = document.nodesById[nodeId]

  if (!node) {
    throw new Error(`Experiment ${nodeId} not found`)
  }

  const subtreeIds = new Set(collectSubtreeIds(document, nodeId))
  const nodesById = Object.fromEntries(
    Object.entries(document.nodesById).filter(([id]) => !subtreeIds.has(id)),
  )

  if (node.parentId) {
    const parentNode = document.nodesById[node.parentId]

    if (parentNode) {
      nodesById[node.parentId] = {
        ...parentNode,
        childIds: parentNode.childIds.filter((childId) => childId !== nodeId),
        updatedAt: nowIso(),
      }
    }
  }

  return {
    document: {
      ...document,
      rootId: node.parentId ? document.rootId : null,
      nodesById,
    },
    deletedIds: [...subtreeIds],
    nextSelectedNodeId: node.parentId,
  }
}

export const getNodePath = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId | null,
): ExperimentNodeId[] => {
  if (!nodeId) {
    return []
  }

  const node = document.nodesById[nodeId]
  if (!node) {
    return []
  }

  return [...getNodePath(document, node.parentId), node.id]
}

const matchesSearch = (node: ExperimentNode, query: string) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  return [
    node.title,
    node.changeSummary,
    node.result,
    node.conclusion,
    node.notes,
    node.branchLabel,
    node.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

const matchesStatusFilter = (node: ExperimentNode, statusFilters: ExperimentStatus[]) => {
  if (statusFilters.length === 0) {
    return true
  }

  return statusFilters.includes(node.status)
}

export const getVisibleNodeIds = (
  document: ExperimentDocument,
  searchQuery: string,
  statusFilters: ExperimentStatus[],
) =>
  Object.values(document.nodesById)
    .filter((node) => matchesSearch(node, searchQuery) && matchesStatusFilter(node, statusFilters))
    .sort((left, right) => toTimestampValue(left.timestamp) - toTimestampValue(right.timestamp))
    .map((node) => node.id)

const assignTreeLayout = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
  depth: number,
  startRow: number,
  positions: Record<ExperimentNodeId, { x: number; y: number }>,
): number => {
  const node = document.nodesById[nodeId]
  if (!node) {
    return 1
  }

  let nextRow = startRow
  const subtreeWeight = node.childIds.reduce<number>((sum, childId) => {
    const childWeight = assignTreeLayout(document, childId, depth + 1, nextRow, positions)
    nextRow += childWeight
    return sum + childWeight
  }, 0) || 1
  const centerRow = startRow + (subtreeWeight - 1) / 2

  positions[nodeId] = {
    x: depth,
    y: centerRow,
  }

  return subtreeWeight
}

export const computeTreeLayout = (document: ExperimentDocument) => {
  const positions: Record<ExperimentNodeId, { x: number; y: number }> = {}

  if (document.rootId) {
    assignTreeLayout(document, document.rootId, 0, 0, positions)
  }

  return positions
}

export const countSubtreeNodes = (document: ExperimentDocument, nodeId: ExperimentNodeId) =>
  collectSubtreeIds(document, nodeId).length

export const serializeExperimentDocument = (document: ExperimentDocument) =>
  JSON.stringify(document, null, 2)
