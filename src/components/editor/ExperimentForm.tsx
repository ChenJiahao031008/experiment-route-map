import { useMemo, useState, type ReactNode } from 'react'

import {
  experimentStatuses,
  statusLabels,
  type ExperimentDraft,
  type ExperimentNode,
} from '../../types/experiment'

type ExperimentFormProps = {
  node: ExperimentNode
  draft: ExperimentDraft
  hasUnsavedChanges: boolean
  onChange: (patch: Partial<ExperimentDraft>) => void
  onSave: () => void
  onReset: () => void
  onBranch: () => void
  onDelete: () => void
  deleteImpactCount: number
}

export function ExperimentForm({
  node,
  draft,
  hasUnsavedChanges,
  onChange,
  onSave,
  onReset,
  onBranch,
  onDelete,
  deleteImpactCount,
}: ExperimentFormProps) {
  const [tagInput, setTagInput] = useState('')

  const parentLabel = useMemo(() => (node.parentId ? node.parentId : '根实验'), [node.parentId])

  const addTag = () => {
    const nextTag = tagInput.trim()
    if (!nextTag || draft.tags.includes(nextTag)) {
      setTagInput('')
      return
    }

    onChange({ tags: [...draft.tags, nextTag] })
    setTagInput('')
  }

  const removeTag = (tagToRemove: string) => {
    onChange({ tags: draft.tags.filter((tag) => tag !== tagToRemove) })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-pencil bg-white/85 p-5 shadow-note">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">当前实验</p>
            <h2 className="mt-2 font-title text-2xl text-ink">{node.title || '未命名实验'}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              父实验：{parentLabel} · 创建于 {new Date(node.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="note-button" onClick={onBranch}>
              从这里分叉
            </button>
            <button type="button" className="note-button note-button-danger" onClick={onDelete}>
              删除子树（{deleteImpactCount}）
            </button>
          </div>
        </div>
      </div>

      <section className="space-y-4 rounded-[28px] border border-pencil bg-white/85 p-5 shadow-note">
        <Field label="实验名称" htmlFor="title">
          <input
            id="title"
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className="note-input"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="分支标签" htmlFor="branchLabel">
            <input
              id="branchLabel"
              value={draft.branchLabel}
              onChange={(event) => onChange({ branchLabel: event.target.value })}
              className="note-input"
            />
          </Field>

          <Field label="记录时间" htmlFor="timestamp">
            <input
              id="timestamp"
              type="datetime-local"
              value={draft.timestamp}
              onChange={(event) => onChange({ timestamp: event.target.value })}
              className="note-input"
            />
          </Field>
        </div>

        <Field label="状态" htmlFor="status">
          <select
            id="status"
            value={draft.status}
            onChange={(event) => onChange({ status: event.target.value as ExperimentDraft['status'] })}
            className="note-input"
          >
            {experimentStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="改动内容" htmlFor="changeSummary" hint="回答“这次改了什么”，这是节点卡片中最优先展示的信息。">
          <textarea
            id="changeSummary"
            value={draft.changeSummary}
            onChange={(event) => onChange({ changeSummary: event.target.value })}
            className="note-input min-h-32 resize-y"
          />
        </Field>

        <Field label="实验结果" htmlFor="result">
          <textarea
            id="result"
            value={draft.result}
            onChange={(event) => onChange({ result: event.target.value })}
            className="note-input min-h-28 resize-y"
          />
        </Field>

        <Field label="实验结论" htmlFor="conclusion" hint="回答“这次实验说明了什么”，建议写成一句明确判断。">
          <textarea
            id="conclusion"
            value={draft.conclusion}
            onChange={(event) => onChange({ conclusion: event.target.value })}
            className="note-input min-h-28 resize-y"
          />
        </Field>

        <Field label="补充备注" htmlFor="notes">
          <textarea
            id="notes"
            value={draft.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            className="note-input min-h-24 resize-y"
          />
        </Field>

        <Field label="标签" htmlFor="tagInput">
          <div className="flex gap-2">
            <input
              id="tagInput"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTag()
                }
              }}
              placeholder="输入标签后回车"
              className="note-input"
            />
            <button type="button" className="note-button" onClick={addTag}>
              添加
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {draft.tags.length === 0 ? (
              <span className="text-sm text-ink/45">暂无标签</span>
            ) : (
              draft.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full border border-pencil bg-note px-3 py-1 text-sm text-ink transition hover:border-ink/35 hover:bg-white"
                >
                  #{tag}
                </button>
              ))
            )}
          </div>
        </Field>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-pencil bg-note/70 p-4">
        <p className="text-sm text-ink/60">
          {hasUnsavedChanges ? '有未保存修改，保存后节点摘要会同步更新。' : '当前内容已与实验树同步。'}
        </p>
        <div className="flex gap-2">
          <button type="button" className="note-button" onClick={onReset} disabled={!hasUnsavedChanges}>
            撤销修改
          </button>
          <button
            type="button"
            className="note-button note-button-primary"
            onClick={onSave}
            disabled={!hasUnsavedChanges}
          >
            保存记录
          </button>
        </div>
      </div>
    </div>
  )
}

type FieldProps = {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}

function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className="block space-y-2">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint ? <p className="mt-1 text-xs leading-5 text-ink/50">{hint}</p> : null}
      </div>
      {children}
    </label>
  )
}
