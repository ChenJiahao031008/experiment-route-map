import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  addChildExperiment,
  buildBranchDraft,
  countSubtreeNodes,
  createInitialDocument,
  createRootExperiment,
  deleteExperimentSubtree,
  getNodeById,
  normalizeDocument,
  updateExperimentNode,
} from '../lib/graph'
import {
  defaultExperimentDraft,
  type ExperimentAttachment,
  type ExperimentDocument,
  type ExperimentDraft,
  type ExperimentNode,
  type ExperimentNodeId,
  type ExperimentStatus,
} from '../types/experiment'

type ExperimentStoreState = {
  document: ExperimentDocument
  selectedNodeId: ExperimentNodeId | null
  compareNodeId: ExperimentNodeId | null
  detailDraft: ExperimentDraft
  searchQuery: string
  statusFilters: ExperimentStatus[]
}

type ExperimentStoreActions = {
  selectNode: (nodeId: ExperimentNodeId | null) => void
  setCompareNode: (nodeId: ExperimentNodeId | null) => void
  clearCompareNode: () => void
  updateDetailDraft: (patch: Partial<ExperimentDraft>) => void
  resetDetailDraft: () => void
  createExperiment: () => void
  branchFromSelected: () => void
  branchFromNode: (nodeId: ExperimentNodeId) => void
  saveSelectedNode: () => void
  cycleNodeStatus: (nodeId: ExperimentNodeId) => void
  updateNodeTitle: (nodeId: ExperimentNodeId, title: string) => void
  deleteSelectedNode: () => void
  setSearchQuery: (query: string) => void
  toggleStatusFilter: (status: ExperimentStatus) => void
  addDraftAttachment: (attachment: ExperimentAttachment) => void
  removeDraftAttachment: (attachmentId: string) => void
}

type ExperimentStore = ExperimentStoreState & ExperimentStoreActions

const persistVersion = 1

const seedDocument = (): ExperimentDocument => {
  const initial = createInitialDocument()
  const { document: rootDocument, createdNodeId: baselineId } = createRootExperiment(initial, {
    title: 'Baseline · 原始实验',
    changeSummary: '建立第一版实验基线，记录默认参数与环境设置。',
    result: '系统可以稳定运行，得到可重复的初始结果。',
    conclusion: '后续所有实验都以此为对照，优先关注关键参数的单变量变化。',
    status: 'success',
    timestamp: '2026-04-23T09:00',
    tags: ['baseline', 'v1'],
    notes: '初始环境：本地数据集 + 默认推理参数。',
    branchLabel: '主线',
  })

  const { document: withBranchA } = addChildExperiment(rootDocument, baselineId, {
    title: '分支 A · 调整损失权重',
    changeSummary: '将损失函数中结构约束项权重提高到 1.5。',
    result: '收敛更快，但局部细节震荡明显。',
    conclusion: '结构约束增强有帮助，但需要搭配更平滑的学习率策略。',
    status: 'failed',
    timestamp: '2026-04-23T11:15',
    tags: ['loss', 'weight'],
    notes: '训练后半段波动增加。',
    branchLabel: 'A',
  })

  const { document: withBranchB } = addChildExperiment(withBranchA, baselineId, {
    title: '分支 B · 调低学习率',
    changeSummary: '将学习率从 1e-3 调整为 5e-4，并延长训练轮数。',
    result: '训练更稳，验证集曲线更平滑。',
    conclusion: '学习率偏大是影响稳定性的主要因素之一。',
    status: 'running',
    timestamp: '2026-04-23T14:20',
    tags: ['lr', 'stability'],
    notes: '继续观察是否会影响最终精度。',
    branchLabel: 'B',
  })

  return withBranchB
}

const getDraftFromNode = (node: ExperimentNode | null): ExperimentDraft => {
  if (!node) {
    return defaultExperimentDraft()
  }

  return {
    title: node.title,
    changeSummary: node.changeSummary,
    result: node.result,
    conclusion: node.conclusion,
    status: node.status,
    timestamp: node.timestamp,
    tags: [...node.tags],
    notes: node.notes,
    branchLabel: node.branchLabel,
    attachments: [...node.attachments],
  }
}

const statusOrder: ExperimentStatus[] = ['running', 'success', 'failed', 'archived']

const cycleStatus = (status: ExperimentStatus): ExperimentStatus => {
  const currentIndex = statusOrder.indexOf(status)
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % statusOrder.length
  return statusOrder[nextIndex]!
}

export const useExperimentStore = create<ExperimentStore>()(
  persist(
    (set, get) => {
      const document = seedDocument()
      const selectedNodeId = document.rootId

      return {
        document,
        selectedNodeId,
        compareNodeId: null,
        detailDraft: getDraftFromNode(getNodeById(document, selectedNodeId)),
        searchQuery: '',
        statusFilters: [],

        selectNode: (nodeId) => {
          const node = getNodeById(get().document, nodeId)
          set({
            selectedNodeId: nodeId,
            detailDraft: getDraftFromNode(node),
          })
        },

        setCompareNode: (nodeId) => set({ compareNodeId: nodeId }),
        clearCompareNode: () => set({ compareNodeId: null }),

        updateDetailDraft: (patch) => {
          set((state) => ({
            detailDraft: {
              ...state.detailDraft,
              ...patch,
              tags: patch.tags ? [...patch.tags] : state.detailDraft.tags,
              attachments: patch.attachments
                ? [...patch.attachments]
                : state.detailDraft.attachments,
            },
          }))
        },

        resetDetailDraft: () => {
          const { document: currentDocument, selectedNodeId: currentNodeId } = get()
          set({
            detailDraft: getDraftFromNode(getNodeById(currentDocument, currentNodeId)),
          })
        },

        createExperiment: () => {
          const state = get()

          if (!state.document.rootId) {
            const { document: nextDocument, createdNodeId } = createRootExperiment(state.document, {
              title: '新实验',
            })

            set({
              document: nextDocument,
              selectedNodeId: createdNodeId,
              detailDraft: getDraftFromNode(getNodeById(nextDocument, createdNodeId)),
            })
            return
          }

          if (!state.selectedNodeId) {
            return
          }

          get().branchFromNode(state.selectedNodeId)
        },

        branchFromSelected: () => {
          const state = get()
          if (!state.selectedNodeId) {
            return
          }

          get().branchFromNode(state.selectedNodeId)
        },

        branchFromNode: (nodeId) => {
          const state = get()
          const { document: nextDocument, createdNodeId } = addChildExperiment(
            state.document,
            nodeId,
            buildBranchDraft(state.document, nodeId),
          )

          set({
            document: nextDocument,
            selectedNodeId: createdNodeId,
            detailDraft: getDraftFromNode(getNodeById(nextDocument, createdNodeId)),
          })
        },

        saveSelectedNode: () => {
          const state = get()
          if (!state.selectedNodeId) {
            return
          }

          const nextDocument = updateExperimentNode(
            state.document,
            state.selectedNodeId,
            state.detailDraft,
          )

          set({
            document: nextDocument,
            detailDraft: getDraftFromNode(getNodeById(nextDocument, state.selectedNodeId)),
          })
        },

        cycleNodeStatus: (nodeId) => {
          const state = get()
          const node = getNodeById(state.document, nodeId)
          if (!node) {
            return
          }

          const nextDocument = updateExperimentNode(state.document, nodeId, {
            status: cycleStatus(node.status),
          })

          set((currentState) => ({
            document: nextDocument,
            detailDraft:
              currentState.selectedNodeId === nodeId
                ? getDraftFromNode(getNodeById(nextDocument, nodeId))
                : currentState.detailDraft,
          }))
        },

        updateNodeTitle: (nodeId, title) => {
          const state = get()
          const nextDocument = updateExperimentNode(state.document, nodeId, { title })

          set((currentState) => ({
            document: nextDocument,
            detailDraft:
              currentState.selectedNodeId === nodeId
                ? getDraftFromNode(getNodeById(nextDocument, nodeId))
                : currentState.detailDraft,
          }))
        },

        deleteSelectedNode: () => {
          const state = get()
          if (!state.selectedNodeId) {
            return
          }

          const { document: nextDocument, nextSelectedNodeId } = deleteExperimentSubtree(
            state.document,
            state.selectedNodeId,
          )

          set({
            document: nextDocument,
            selectedNodeId: nextSelectedNodeId,
            compareNodeId:
              state.compareNodeId === state.selectedNodeId ? null : state.compareNodeId,
            detailDraft: getDraftFromNode(getNodeById(nextDocument, nextSelectedNodeId)),
          })
        },

        setSearchQuery: (query) => set({ searchQuery: query }),

        toggleStatusFilter: (status) => {
          set((state) => ({
            statusFilters: state.statusFilters.includes(status)
              ? state.statusFilters.filter((item) => item !== status)
              : [...state.statusFilters, status],
          }))
        },

        addDraftAttachment: (attachment) => {
          set((state) => ({
            detailDraft: {
              ...state.detailDraft,
              attachments: [...state.detailDraft.attachments, attachment],
            },
          }))
        },

        removeDraftAttachment: (attachmentId) => {
          set((state) => ({
            detailDraft: {
              ...state.detailDraft,
              attachments: state.detailDraft.attachments.filter(
                (attachment) => attachment.id !== attachmentId,
              ),
            },
          }))
        },
      }
    },
    {
      name: 'vis-experiment-store',
      version: persistVersion,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState
        }

        const state = persistedState as Partial<ExperimentStoreState>
        const nextDocument = normalizeDocument(state.document) ?? seedDocument()
        const selectedNodeId =
          state.selectedNodeId && nextDocument.nodesById[state.selectedNodeId]
            ? state.selectedNodeId
            : nextDocument.rootId
        const compareNodeId =
          state.compareNodeId && nextDocument.nodesById[state.compareNodeId]
            ? state.compareNodeId
            : null
        const selectedNode = getNodeById(nextDocument, selectedNodeId)

        return {
          ...state,
          document: nextDocument,
          selectedNodeId,
          compareNodeId,
          detailDraft: {
            ...getDraftFromNode(selectedNode),
            ...(state.detailDraft ?? {}),
            tags: state.detailDraft?.tags ? [...state.detailDraft.tags] : getDraftFromNode(selectedNode).tags,
            attachments: state.detailDraft?.attachments
              ? [...state.detailDraft.attachments]
              : getDraftFromNode(selectedNode).attachments,
          },
          searchQuery: state.searchQuery ?? '',
          statusFilters: state.statusFilters ?? [],
        }
      },
      partialize: (state) => ({
        document: state.document,
        selectedNodeId: state.selectedNodeId,
        compareNodeId: state.compareNodeId,
        detailDraft: state.detailDraft,
        searchQuery: state.searchQuery,
        statusFilters: state.statusFilters,
      }),
    },
  ),
)

export const useSelectedExperiment = () =>
  useExperimentStore((state) => getNodeById(state.document, state.selectedNodeId))

export const useCompareExperiment = () =>
  useExperimentStore((state) => getNodeById(state.document, state.compareNodeId))

export const useHasUnsavedChanges = () =>
  useExperimentStore((state) => {
    const node = getNodeById(state.document, state.selectedNodeId)
    if (!node) {
      return false
    }

    const draft = state.detailDraft
    return (
      node.title !== draft.title ||
      node.changeSummary !== draft.changeSummary ||
      node.result !== draft.result ||
      node.conclusion !== draft.conclusion ||
      node.status !== draft.status ||
      node.timestamp !== draft.timestamp ||
      node.notes !== draft.notes ||
      node.branchLabel !== draft.branchLabel ||
      node.tags.join('|') !== draft.tags.join('|') ||
      node.attachments.length !== draft.attachments.length ||
      node.attachments.some((attachment, index) => attachment.id !== draft.attachments[index]?.id)
    )
  })

export const useDeleteImpactCount = () =>
  useExperimentStore((state) => {
    if (!state.selectedNodeId) {
      return 0
    }

    return countSubtreeNodes(state.document, state.selectedNodeId)
  })
