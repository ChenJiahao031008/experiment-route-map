import { useRef, type ChangeEvent } from 'react'
import clsx from 'clsx'

import {
  experimentStatuses,
  statusLabels,
  type ExperimentStatus,
} from '../../types/experiment'

type ToolbarProps = {
  searchQuery: string
  activeFilters: ExperimentStatus[]
  onSearchChange: (query: string) => void
  onToggleFilter: (status: ExperimentStatus) => void
  onCreateExperiment: () => void
  onExport: () => void
  onImport: (file: File) => void
  importMessage: { kind: 'success' | 'error'; text: string } | null
}

export function Toolbar({
  searchQuery,
  activeFilters,
  onSearchChange,
  onToggleFilter,
  onCreateExperiment,
  onExport,
  onImport,
  importMessage,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file) {
      onImport(file)
    }
  }

  return (
    <header className="border-b border-pencil/70 bg-paper/90 px-6 py-5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-ink/55">实验记录板</p>
          <h1 className="font-title text-3xl text-ink">实验分支手账</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="note-button note-button-primary" type="button" onClick={onCreateExperiment}>
            新建实验
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button className="note-button" type="button" onClick={() => fileInputRef.current?.click()}>
            导入 JSON
          </button>
          <button className="note-button" type="button" onClick={onExport}>
            导出 JSON
          </button>
        </div>
      </div>

      {importMessage ? (
        <p
          className={clsx(
            'mt-3 text-sm',
            importMessage.kind === 'success' ? 'text-success-ink' : 'text-failed-ink',
          )}
        >
          {importMessage.text}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <label className="relative block xl:max-w-md xl:flex-1">
          <span className="sr-only">搜索实验</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索实验名称、改动内容、结论或标签"
            className="w-full rounded-2xl border border-pencil bg-white/90 px-4 py-3 text-sm text-ink shadow-[0_10px_30px_rgba(115,94,64,0.08)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-sun/60"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {experimentStatuses.map((status) => {
            const active = activeFilters.includes(status)
            return (
              <button
                key={status}
                type="button"
                onClick={() => onToggleFilter(status)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-sm transition',
                  active
                    ? 'border-ink bg-ink text-paper shadow-[0_8px_20px_rgba(63,52,44,0.18)]'
                    : 'border-pencil bg-note text-ink hover:border-ink/35 hover:bg-white',
                )}
              >
                {statusLabels[status]}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
