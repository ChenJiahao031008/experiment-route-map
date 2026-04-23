import {
  defaultExperimentDraft,
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
    createdAt,
    updatedAt: createdAt,
  }
}

export const createInitialDocument = (): ExperimentDocument => ({
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

export const getSiblingIndex = (
  document: ExperimentDocument,
  nodeId: ExperimentNodeId,
): number => {
  const node = document.nodesById[nodeId]
  if (!node?.parentId) {
    return 0
  }

  const parentNode = document.nodesById[node.parentId]
  return parentNode ? parentNode.childIds.indexOf(nodeId) : 0
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

export const countSubtreeNodes = (document: ExperimentDocument, nodeId: ExperimentNodeId) =>
  collectSubtreeIds(document, nodeId).length

export const serializeExperimentDocument = (document: ExperimentDocument) =>
  JSON.stringify(document, null, 2)
