export const experimentStatuses = ['success', 'failed', 'running', 'archived'] as const

export type ExperimentStatus = (typeof experimentStatuses)[number]

export type ExperimentNodeId = string

export type BranchDirection = 'left' | 'right' | 'top' | 'bottom'

export type AttachmentKind = 'image'

export type ExperimentAttachment = {
  id: string
  name: string
  type: string
  size: number
  kind: AttachmentKind
  dataUrl: string
  createdAt: string
}

export type ExperimentManualPosition = {
  x: number
  y: number
}

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
  attachments: ExperimentAttachment[]
  branchDirection?: BranchDirection
  manualPosition?: ExperimentManualPosition
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
  | 'attachments'
>

export type ExperimentDocument = {
  version: 2
  rootId: ExperimentNodeId | null
  nodesById: Record<ExperimentNodeId, ExperimentNode>
}

export const documentVersion = 2 as const

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
  attachments: [],
})

export const statusLabels: Record<ExperimentStatus, string> = {
  success: '成功',
  failed: '失败',
  running: '进行中',
  archived: '废弃',
}
