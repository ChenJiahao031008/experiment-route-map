import { memo, type FocusEvent, type KeyboardEvent, type MouseEvent, useState } from 'react'
import clsx from 'clsx'
import { Handle, Position, type NodeProps } from 'reactflow'

import { statusLabels, type ExperimentStatus } from '../../types/experiment'

type BranchDirection = 'left' | 'right' | 'top' | 'bottom'

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
  onBranch: (nodeId: string, direction?: BranchDirection) => void
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

type ExperimentNodeCardBodyProps = {
  branchLabel: string
  isCompareTarget: boolean
  status: ExperimentStatus
  title: string
  isEditingTitle: boolean
  draftTitle: string
  stopCardEvent: (event: MouseEvent | KeyboardEvent | FocusEvent) => void
  setDraftTitle: (title: string) => void
  commitTitle: () => void
  onSelect: () => void
  onBranch: (direction?: BranchDirection) => void
  onCycleStatus: () => void
  onSetCompare: () => void
  onStartEditing: () => void
  changeSummary: string
  conclusion: string
  timestamp: string
  attachmentCount: number
  isDragging: boolean
}

const ExperimentNodeCardBody = memo(function ExperimentNodeCardBody({
  branchLabel,
  isCompareTarget,
  status,
  title,
  isEditingTitle,
  draftTitle,
  stopCardEvent,
  setDraftTitle,
  commitTitle,
  onSelect,
  onBranch,
  onCycleStatus,
  onSetCompare,
  onStartEditing,
  changeSummary,
  conclusion,
  timestamp,
  attachmentCount,
  isDragging,
}: ExperimentNodeCardBodyProps) {
  return (
    <>
      <div
        className={clsx(
          'drag-handle__custom relative mb-2 flex cursor-grab items-center justify-between rounded-xl border border-dashed border-transparent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/45 active:cursor-grabbing before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:translate-x-[-12px] before:translate-y-[12px] before:rounded-2xl before:border before:border-dashed before:border-ink/35 before:bg-white/40 before:content-[""]',
          isDragging ? 'border-ink/20 bg-white/65 before:hidden' : 'hover:border-ink/15 hover:bg-white/55 before:opacity-0',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p>{branchLabel || '实验节点'}</p>
            {isCompareTarget ? (
              <span className="rounded-full border border-[#8bb8c8] bg-[#e6f3f7] px-1.5 py-0.5 text-[9px] text-[#45697a] normal-case tracking-normal">
                对比目标
              </span>
            ) : null}
          </div>
        </div>

        <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal', statusClasses[status])}>
          {statusLabels[status]}
        </span>
      </div>

      <div className="mb-2">
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
            className="nodrag nopan mt-1 w-full rounded-xl border border-pencil bg-white px-2 py-1 text-sm font-semibold text-ink outline-none focus:border-ink/40"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onMouseDown={stopCardEvent}
            onClick={(event) => {
              stopCardEvent(event)
              onSelect()
            }}
            className="nodrag nopan mt-1 line-clamp-2 text-left text-sm font-semibold leading-5 text-ink"
          >
            {title || '未命名实验'}
          </button>
        )}
      </div>

      <div className={clsx('mb-2 flex flex-wrap gap-1.5', isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}>
        <button
          type="button"
          className="node-chip nodrag nopan"
          onMouseDown={stopCardEvent}
          onClick={(event) => {
            stopCardEvent(event)
            onBranch('right')
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
            onCycleStatus()
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
            onSetCompare()
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
            onStartEditing()
          }}
        >
          改标题
        </button>
      </div>

      <div className="space-y-2 text-xs leading-5 text-ink/80">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/45">改动内容</p>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem]">{changeSummary || '尚未记录本次改动。'}</p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/45">实验结论</p>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem]">{conclusion || '尚未沉淀出明确结论。'}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-pencil/80 pt-2 text-[11px] text-ink/55">
        <span>记录时间：{timestamp || '未填写'}</span>
        <span>{attachmentCount > 0 ? `${attachmentCount} 张图` : '无附件'}</span>
      </div>
    </>
  )
})

const branchDirectionButtons: Array<{
  direction: BranchDirection
  label: string
  className: string
}> = [
  {
    direction: 'top',
    label: '向上新增',
    className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  },
  {
    direction: 'right',
    label: '向右新增',
    className: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
  },
  {
    direction: 'bottom',
    label: '向下新增',
    className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  },
  {
    direction: 'left',
    label: '向左新增',
    className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  },
]

function ExperimentNodeCardComponent({ data, selected }: NodeProps<ExperimentNodeData>) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(data.title)

  const stopCardEvent = (event: MouseEvent | KeyboardEvent | FocusEvent) => {
    event.stopPropagation()
  }

  const commitTitle = () => {
    const nextTitle = draftTitle.trim()

    setIsEditingTitle(false)

    if (!nextTitle || nextTitle === data.title) {
      setDraftTitle(data.title)
      return
    }

    data.onRename(data.nodeId, nextTitle)
  }

  const selectNode = () => data.onSelect(data.nodeId)
  const startEditingTitle = () => {
    setIsEditingTitle(true)
    selectNode()
  }

  const cardClassName = data.isDragging
    ? clsx(
        'group isolate relative min-w-[220px] max-w-[240px] rounded-[20px] border bg-note px-3 py-3 text-left border-ink/20 shadow-none will-change-transform [transform:translateZ(0)] [backface-visibility:hidden]',
        data.isDimmed && 'opacity-40 saturate-50',
      )
    : clsx(
        'group isolate relative min-w-[220px] max-w-[240px] rounded-[20px] border bg-note px-3 py-3 text-left shadow-note',
        selected || data.isSelected
          ? 'border-ink/60 ring-2 ring-sun/80 shadow-[0_24px_60px_rgba(97,75,48,0.20)]'
          : 'border-pencil/80',
        data.isCompareTarget && 'ring-2 ring-[#8bb8c8]/70',
        data.isDimmed && 'opacity-40 saturate-50',
      )

  return (
    <div
      className={cardClassName}
      onDoubleClick={startEditingTitle}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />

      <ExperimentNodeCardBody
        branchLabel={data.branchLabel}
        isCompareTarget={data.isCompareTarget}
        status={data.status}
        title={data.title}
        isEditingTitle={isEditingTitle}
        draftTitle={draftTitle}
        stopCardEvent={stopCardEvent}
        setDraftTitle={setDraftTitle}
        commitTitle={commitTitle}
        onSelect={selectNode}
        onBranch={(direction) => data.onBranch(data.nodeId, direction)}
        onCycleStatus={() => data.onCycleStatus(data.nodeId)}
        onSetCompare={() => data.onSetCompare(data.nodeId)}
        onStartEditing={startEditingTitle}
        changeSummary={data.changeSummary}
        conclusion={data.conclusion}
        timestamp={data.timestamp}
        attachmentCount={data.attachmentCount}
        isDragging={data.isDragging}
      />

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-paper !bg-ink" />

      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        {branchDirectionButtons.map((button) => (
          <button
            key={button.direction}
            type="button"
            aria-label={button.label}
            title={button.label}
            className={clsx(
              'pointer-events-none nodrag nopan absolute flex h-7 w-7 items-center justify-center rounded-full border border-pencil bg-white/95 text-base font-semibold leading-none text-ink shadow-[0_10px_24px_rgba(97,75,48,0.18)] transition hover:border-ink/35 hover:bg-sun focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/45 group-hover:pointer-events-auto group-focus-within:pointer-events-auto',
              button.className,
            )}
            onMouseDown={stopCardEvent}
            onClick={(event) => {
              stopCardEvent(event)
              data.onBranch(data.nodeId, button.direction)
            }}
          >
            +
          </button>
        ))}
      </div>
    </div>
  )
}

export const ExperimentNodeCard = memo(ExperimentNodeCardComponent)

export type { BranchDirection, ExperimentNodeData }
