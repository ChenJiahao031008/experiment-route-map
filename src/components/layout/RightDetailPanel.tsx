import { ExperimentForm } from '../editor/ExperimentForm'
import {
  useCompareExperiment,
  useDeleteImpactCount,
  useExperimentStore,
  useHasUnsavedChanges,
  useSelectedExperiment,
} from '../../store/experimentStore'

type RightDetailPanelProps = {
  onCreateRoot: () => void
}

const confirmDelete = (deleteImpactCount: number) =>
  window.confirm(`确定删除当前实验及其 ${deleteImpactCount} 个节点的整棵子树吗？此操作不可撤销。`)

export function RightDetailPanel({ onCreateRoot }: RightDetailPanelProps) {
  const selectedNode = useSelectedExperiment()
  const compareNode = useCompareExperiment()
  const detailDraft = useExperimentStore((state) => state.detailDraft)
  const updateDetailDraft = useExperimentStore((state) => state.updateDetailDraft)
  const saveSelectedNode = useExperimentStore((state) => state.saveSelectedNode)
  const resetDetailDraft = useExperimentStore((state) => state.resetDetailDraft)
  const branchFromSelected = useExperimentStore((state) => state.branchFromSelected)
  const deleteSelectedNode = useExperimentStore((state) => state.deleteSelectedNode)
  const clearCompareNode = useExperimentStore((state) => state.clearCompareNode)
  const deleteImpactCount = useDeleteImpactCount()
  const hasUnsavedChanges = useHasUnsavedChanges()

  if (!selectedNode) {
    return (
      <aside className="h-full rounded-[32px] border border-pencil bg-white/85 p-6 shadow-note">
        <div className="flex h-full min-h-[540px] flex-col items-center justify-center text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-ink/45">详情面板</p>
          <h2 className="mt-4 font-title text-3xl text-ink">还没有选中的实验</h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-ink/65">
            选中左侧树中的任意节点，即可在这里完整记录改动内容、实验结果与最终结论。
          </p>
          <button type="button" className="note-button note-button-primary mt-6" onClick={onCreateRoot}>
            创建根实验
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="h-full rounded-[32px] border border-pencil bg-white/85 p-6 shadow-note">
      <ExperimentForm
        node={selectedNode}
        compareNode={compareNode}
        draft={detailDraft}
        hasUnsavedChanges={hasUnsavedChanges}
        deleteImpactCount={deleteImpactCount}
        onChange={updateDetailDraft}
        onSave={saveSelectedNode}
        onReset={resetDetailDraft}
        onBranch={branchFromSelected}
        onClearCompare={clearCompareNode}
        onDelete={() => {
          if (confirmDelete(deleteImpactCount)) {
            deleteSelectedNode()
          }
        }}
      />
    </aside>
  )
}
