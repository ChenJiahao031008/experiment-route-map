import clsx from 'clsx'
import { Handle, Position, type NodeProps } from 'reactflow'

import { statusLabels, type ExperimentStatus } from '../../types/experiment'

type ExperimentNodeData = {
  title: string
  changeSummary: string
  conclusion: string
  status: ExperimentStatus
  timestamp: string
  branchLabel: string
  isSelected: boolean
  isDimmed: boolean
}

const statusClasses: Record<ExperimentStatus, string> = {
  success: 'bg-success/80 text-success-ink border-success/70',
  failed: 'bg-failed/75 text-failed-ink border-failed/70',
  running: 'bg-running/85 text-running-ink border-running/75',
  archived: 'bg-archived/90 text-archived-ink border-archived/85',
}

export function ExperimentNodeCard({ data, selected }: NodeProps<ExperimentNodeData>) {
  return (
    <div
      className={clsx(
        'min-w-[260px] max-w-[280px] rounded-[24px] border bg-note px-4 py-4 text-left shadow-note transition',
        selected || data.isSelected
          ? 'border-ink/60 ring-2 ring-sun/80 shadow-[0_24px_60px_rgba(97,75,48,0.20)]'
          : 'border-pencil/80',
        data.isDimmed && 'opacity-40 saturate-50',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-ink/50">
            {data.branchLabel || '实验节点'}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-ink">{data.title || '未命名实验'}</h3>
        </div>

        <span className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium', statusClasses[data.status])}>
          {statusLabels[data.status]}
        </span>
      </div>

      <div className="space-y-3 text-sm leading-6 text-ink/80">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink/45">改动内容</p>
          <p className="mt-1 line-clamp-3 min-h-[3.5rem]">{data.changeSummary || '尚未记录本次改动。'}</p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink/45">实验结论</p>
          <p className="mt-1 line-clamp-3 min-h-[3.5rem]">{data.conclusion || '尚未沉淀出明确结论。'}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-dashed border-pencil/80 pt-3 text-xs text-ink/55">
        记录时间：{data.timestamp || '未填写'}
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />
    </div>
  )
}

export type { ExperimentNodeData }
