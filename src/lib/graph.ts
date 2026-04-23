import {
  defaultExperimentDraft,
  documentVersion,
  type ExperimentAttachment,
  type ExperimentDocument,
  type ExperimentDraft,
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
        status: baseDraft.status,
        timestamp: baseDraft.timestamp,
        tags: Array.isArray(baseDraft.tags) ? [...baseDraft.tags] : [],
        notes: baseDraft.notes,
        branchLabel: baseDraft.branchLabel,
        attachments: normalizeAttachments(node.attachments),
        createdAt: node.createdAt ?? nowIso(),
        updatedAt: node.updatedAt ?? node.createdAt ?? nowIso(),
      }

      return [id, normalizedNode]
    }),
  )

  return {
    version: documentVersion,
    rootId: candidate.rootId ?? null,
    nodesById,
  }
}

export const createExperimentNode = (
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
) => {
  const parentNode = document.nodesById[parentId]

  if (!parentNode) {
    throw new Error(`Parent experiment ${parentId} not found`)
  }

  const childNode = createExperimentNode(draft, parentId)

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

export const getExperimentDepth = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
): number => {
  const node = document.nodesById[nodeId]
  if (!node || !node.parentId) {
    return 0
  }

  return getExperimentDepth(document, node.parentId) + 1
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

const getSubtreeWeight = (document: ExperimentDocument, nodeId: ExperimentNodeId): number => {
  const node = document.nodesById[nodeId]
  if (!node || node.childIds.length === 0) {
    return 1
  }

  return node.childIds.reduce((sum, childId) => sum + getSubtreeWeight(document, childId), 0)
}

const assignTreeLayout = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
  startRow: number,
  positions: Record<ExperimentNodeId, { x: number; y: number }>,
) => {
  const node = document.nodesById[nodeId]
  if (!node) {
    return startRow
  }

  const depth = getExperimentDepth(document, nodeId)
  const subtreeWeight = getSubtreeWeight(document, nodeId)
  const centerRow = startRow + (subtreeWeight - 1) / 2

  positions[nodeId] = {
    x: depth,
    y: centerRow,
  }

  let nextRow = startRow
  node.childIds.forEach((childId) => {
    assignTreeLayout(document, childId, nextRow, positions)
    nextRow += getSubtreeWeight(document, childId)
  })

  return startRow + subtreeWeight
}

export const computeTreeLayout = (document: ExperimentDocument) => {
  const positions: Record<ExperimentNodeId, { x: number; y: number }> = {}

  if (document.rootId) {
    assignTreeLayout(document, document.rootId, 0, positions)
  }

  return positions
}

export const countSubtreeNodes = (document: ExperimentDocument, nodeId: ExperimentNodeId) =>
  collectSubtreeIds(document, nodeId).length

export const serializeExperimentDocument = (document: ExperimentDocument) =>
  JSON.stringify(document, null, 2)
