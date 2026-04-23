export const experimentStatuses = ['success', 'failed', 'running', 'archived'] as const

export type ExperimentStatus = (typeof experimentStatuses)[number]

export type ExperimentNodeId = string

export type ExperimentNode = {
  id: ExperimentNodeId
  parentId: ExperimentNodeId | null
  childIds: ExperimentNodeId[]
  title: string
  changeSummary: string
  result: string
  conclusion: string
  status: ExperimentStatus
  timestamp: string
  tags: string[]
  notes: string
  branchLabel: string
  createdAt: string
  updatedAt: string
}

export type ExperimentDraft = Pick<
  ExperimentNode,
  | 'title'
  | 'changeSummary'
  | 'result'
  | 'conclusion'
  | 'status'
  | 'timestamp'
  | 'tags'
  | 'notes'
  | 'branchLabel'
>

export type ExperimentDocument = {
  rootId: ExperimentNodeId | null
  nodesById: Record<ExperimentNodeId, ExperimentNode>
}

export const defaultExperimentDraft = (): ExperimentDraft => ({
  title: '',
  changeSummary: '',
  result: '',
  conclusion: '',
  status: 'running',
  timestamp: new Date().toISOString().slice(0, 16),
  tags: [],
  notes: '',
  branchLabel: '',
})

export const statusLabels: Record<ExperimentStatus, string> = {
  success: '成功',
  failed: '失败',
  running: '进行中',
  archived: '废弃',
}
