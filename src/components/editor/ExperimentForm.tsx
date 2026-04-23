import { useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'

import {
  experimentStatuses,
  statusLabels,
  type ExperimentAttachment,
  type ExperimentDraft,
  type ExperimentNode,
} from '../../types/experiment'

type ExperimentFormProps = {
  node: ExperimentNode
  compareNode: ExperimentNode | null
  draft: ExperimentDraft
  hasUnsavedChanges: boolean
  deleteImpactCount: number
  onChange: (patch: Partial<ExperimentDraft>) => void
  onSave: () => void
  onReset: () => void
  onBranch: () => void
  onDelete: () => void
  onClearCompare: () => void
}

const markdownFields = [
  { key: 'result', label: '实验结果' },
  { key: 'conclusion', label: '实验结论' },
  { key: 'notes', label: '补充备注' },
] as const

const maxAttachmentSize = 220 * 1024
const maxAttachmentCount = 4

type MarkdownFieldKey = (typeof markdownFields)[number]['key']

export function ExperimentForm({
  node,
  compareNode,
  draft,
  hasUnsavedChanges,
  onChange,
  onSave,
  onReset,
  onBranch,
  onDelete,
  onClearCompare,
  deleteImpactCount,
}: ExperimentFormProps) {
  const [tagInput, setTagInput] = useState('')
  const [previewField, setPreviewField] = useState<MarkdownFieldKey | null>(null)
  const [attachmentError, setAttachmentError] = useState('')

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

  const removeAttachment = (attachmentId: string) => {
    onChange({
      attachments: draft.attachments.filter((attachment) => attachment.id !== attachmentId),
    })
  }

  const addAttachment = async (file: File | null) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setAttachmentError('当前仅支持图片附件。')
      return
    }

    if (file.size > maxAttachmentSize) {
      setAttachmentError('单张图片需小于 220KB，避免超出本地存储限制。')
      return
    }

    if (draft.attachments.length >= maxAttachmentCount) {
      setAttachmentError(`每个实验最多保留 ${maxAttachmentCount} 张图片。`)
      return
    }

    const dataUrl = await readFileAsDataUrl(file)
    const nextAttachment: ExperimentAttachment = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      kind: 'image',
      dataUrl,
      createdAt: new Date().toISOString(),
    }

    setAttachmentError('')
    onChange({ attachments: [...draft.attachments, nextAttachment] })
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

      {compareNode ? (
        <section className="rounded-[28px] border border-[#b9d3db] bg-[#f2fbfd] p-5 shadow-note">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#53707b]">对比模式</p>
              <h3 className="mt-2 font-title text-2xl text-ink">当前节点 vs 对比目标</h3>
            </div>
            <button type="button" className="note-button" onClick={onClearCompare}>
              关闭对比
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <CompareCard title="当前节点" node={node} />
            <CompareCard title="对比目标" node={compareNode} />
          </div>
        </section>
      ) : null}

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

        {markdownFields.map(({ key, label }) => {
          const value = draft[key]
          const isPreview = previewField === key
          const hint =
            key === 'conclusion' ? '回答“这次实验说明了什么”，建议写成一句明确判断。' : undefined

          return (
            <Field key={key} label={label} htmlFor={key} hint={hint}>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  className="node-chip"
                  onClick={() => setPreviewField((current) => (current === key ? null : key))}
                >
                  {isPreview ? '返回编辑' : 'Markdown 预览'}
                </button>
              </div>

              {isPreview ? (
                <div className="markdown-note min-h-28 rounded-2xl border border-pencil bg-note px-4 py-3">
                  {value.trim() ? <ReactMarkdown>{value}</ReactMarkdown> : '暂无内容可预览。'}
                </div>
              ) : (
                <textarea
                  id={key}
                  value={value}
                  onChange={(event) => onChange({ [key]: event.target.value } as Partial<ExperimentDraft>)}
                  className="note-input min-h-28 resize-y"
                />
              )}
            </Field>
          )
        })}

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

        <Field
          label="图片附件"
          htmlFor="attachments"
          hint={`支持最多 ${maxAttachmentCount} 张图片；单张需小于 ${Math.round(maxAttachmentSize / 1024)}KB。`}
        >
          <input
            id="attachments"
            type="file"
            accept="image/*"
            className="note-input file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-paper"
            onChange={async (event) => {
              const input = event.currentTarget
              const [file] = Array.from(input.files ?? [])
              await addAttachment(file ?? null)
              input.value = ''
            }}
          />
          {attachmentError ? <p className="mt-2 text-sm text-[#9e5f55]">{attachmentError}</p> : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {draft.attachments.length === 0 ? (
              <span className="text-sm text-ink/45">暂无图片附件</span>
            ) : (
              draft.attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-2xl border border-pencil bg-note p-3">
                  <img src={attachment.dataUrl} alt={attachment.name} className="h-32 w-full rounded-xl object-cover" />
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm text-ink/70">
                    <span className="truncate">{attachment.name}</span>
                    <button type="button" className="node-chip" onClick={() => removeAttachment(attachment.id)}>
                      删除
                    </button>
                  </div>
                </div>
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

type CompareCardProps = {
  title: string
  node: ExperimentNode
}

function CompareCard({ title, node }: CompareCardProps) {
  return (
    <div className="rounded-[24px] border border-[#c7dfe6] bg-white/85 p-4">
      <div className="mb-3 border-b border-dashed border-[#c7dfe6] pb-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[#53707b]">{title}</p>
        <h4 className="mt-2 text-lg font-semibold text-ink">{node.title}</h4>
      </div>

      <dl className="space-y-3 text-sm text-ink/75">
        <CompareItem label="状态" value={statusLabels[node.status]} />
        <CompareItem label="时间" value={node.timestamp} />
        <CompareItem label="标签" value={node.tags.length ? node.tags.join(', ') : '暂无'} />
        <CompareItem label="改动内容" value={node.changeSummary || '暂无'} />
        <CompareItem label="实验结果" value={node.result || '暂无'} markdown />
        <CompareItem label="实验结论" value={node.conclusion || '暂无'} markdown />
        <CompareItem label="补充备注" value={node.notes || '暂无'} markdown />
      </dl>

      {node.attachments.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {node.attachments.map((attachment) => (
            <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} className="h-24 w-full rounded-xl object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  )
}

type CompareItemProps = {
  label: string
  value: string
  markdown?: boolean
}

function CompareItem({ label, value, markdown = false }: CompareItemProps) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.2em] text-ink/45">{label}</dt>
      <dd className="mt-1">
        {markdown ? <div className="markdown-note"><ReactMarkdown>{value}</ReactMarkdown></div> : value}
      </dd>
    </div>
  )
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
