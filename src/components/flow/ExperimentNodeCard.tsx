import { type FocusEvent, type KeyboardEvent, type MouseEvent, useState } from 'react'
import clsx from 'clsx'
import { Handle, Position, type NodeProps } from 'reactflow'

import { statusLabels, type ExperimentStatus } from '../../types/experiment'

type ExperimentNodeData = {
  nodeId: string
  title: string
  changeSummary: string
  conclusion: string
  status: ExperimentStatus
  timestamp: string
  branchLabel: string
  isSelected: boolean
  isCompareTarget: boolean
  isDragging: boolean
  isDimmed: boolean
  attachmentCount: number
  onSelect: (nodeId: string) => void
  onBranch: (nodeId: string) => void
  onCycleStatus: (nodeId: string) => void
  onSetCompare: (nodeId: string) => void
  onRename: (nodeId: string, title: string) => void
}

const statusClasses: Record<ExperimentStatus, string> = {
  success: 'bg-success/80 text-success-ink border-success/70',
  failed: 'bg-failed/75 text-failed-ink border-failed/70',
  running: 'bg-running/85 text-running-ink border-running/75',
  archived: 'bg-archived/90 text-archived-ink border-archived/85',
}

export function ExperimentNodeCard({ data, selected }: NodeProps<ExperimentNodeData>) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(data.title)

  const stopCardEvent = (event: MouseEvent | KeyboardEvent | FocusEvent) => {
    event.stopPropagation()
  }

  const commitTitle = () => {
    setIsEditingTitle(false)
    if (draftTitle.trim() && draftTitle !== data.title) {
      data.onRename(data.nodeId, draftTitle.trim())
    } else {
      setDraftTitle(data.title)
    }
  }

  return (
    <div
      className={clsx(
        'group isolate relative min-w-[260px] max-w-[280px] rounded-[24px] border bg-note px-4 py-4 text-left shadow-note',
        selected || data.isSelected
          ? 'border-ink/60 ring-2 ring-sun/80 shadow-[0_24px_60px_rgba(97,75,48,0.20)]'
          : 'border-pencil/80',
        data.isCompareTarget && 'ring-2 ring-[#8bb8c8]/70',
        data.isDragging && 'will-change-transform',
        data.isDimmed && 'opacity-40 saturate-50',
      )}
      onDoubleClick={() => {
        setIsEditingTitle(true)
        data.onSelect(data.nodeId)
      }}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />

      <div
        className={clsx(
          'drag-handle__custom relative mb-3 flex cursor-grab items-center justify-between rounded-2xl border border-dashed border-transparent px-2 py-1 text-[11px] uppercase tracking-[0.24em] text-ink/45 active:cursor-grabbing before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:translate-x-[-16px] before:translate-y-[16px] before:rounded-[20px] before:border before:border-dashed before:border-ink/35 before:bg-white/40 before:content-[""]',
          data.isDragging
            ? 'border-ink/25 bg-white/75 before:opacity-100'
            : 'hover:border-ink/15 hover:bg-white/55 before:opacity-0',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p>{data.branchLabel || '实验节点'}</p>
            {data.isCompareTarget ? (
              <span className="rounded-full border border-[#8bb8c8] bg-[#e6f3f7] px-2 py-0.5 text-[10px] text-[#45697a] normal-case tracking-normal">
                对比目标
              </span>
            ) : null}
          </div>
        </div>

        <span className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium normal-case tracking-normal', statusClasses[data.status])}>
          {statusLabels[data.status]}
        </span>
      </div>

      <div className="mb-3">
        {isEditingTitle ? (
          <input
            value={draftTitle}
            onClick={stopCardEvent}
            onMouseDown={stopCardEvent}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={(event) => {
              stopCardEvent(event)
              commitTitle()
            }}
            onKeyDown={(event) => {
              stopCardEvent(event)
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTitle()
              }
            }}
            className="nodrag nopan mt-1 w-full rounded-xl border border-pencil bg-white px-2 py-1 text-base font-semibold text-ink outline-none focus:border-ink/40"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onMouseDown={stopCardEvent}
            onClick={(event) => {
              stopCardEvent(event)
              data.onSelect(data.nodeId)
            }}
            className="nodrag nopan mt-1 line-clamp-2 text-left text-base font-semibold text-ink"
          >
            {data.title || '未命名实验'}
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          className="node-chip nodrag nopan"
          onMouseDown={stopCardEvent}
          onClick={(event) => {
            stopCardEvent(event)
            data.onBranch(data.nodeId)
          }}
        >
          分叉
        </button>
        <button
          type="button"
          className="node-chip nodrag nopan"
          onMouseDown={stopCardEvent}
          onClick={(event) => {
            stopCardEvent(event)
            data.onCycleStatus(data.nodeId)
          }}
        >
          切换状态
        </button>
        <button
          type="button"
          className="node-chip nodrag nopan"
          onMouseDown={stopCardEvent}
          onClick={(event) => {
            stopCardEvent(event)
            data.onSetCompare(data.nodeId)
          }}
        >
          对比
        </button>
        <button
          type="button"
          className="node-chip nodrag nopan"
          onMouseDown={stopCardEvent}
          onClick={(event) => {
            stopCardEvent(event)
            setIsEditingTitle(true)
            data.onSelect(data.nodeId)
          }}
        >
          改标题
        </button>
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

      <div className="mt-4 flex items-center justify-between border-t border-dashed border-pencil/80 pt-3 text-xs text-ink/55">
        <span>记录时间：{data.timestamp || '未填写'}</span>
        <span>{data.attachmentCount > 0 ? `${data.attachmentCount} 张图` : '无附件'}</span>
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />
    </div>
  )
}

export type { ExperimentNodeData }
