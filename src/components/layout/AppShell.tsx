import { useState } from 'react'

import { downloadExperimentDocument } from '../../lib/export'
import { normalizeDocument } from '../../lib/graph'
import { useExperimentStore } from '../../store/experimentStore'
import { ExperimentFlow } from '../flow/ExperimentFlow'
import { RightDetailPanel } from './RightDetailPanel'
import { Toolbar } from './Toolbar'

export function AppShell() {
  const [importMessage, setImportMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const document = useExperimentStore((state) => state.document)
  const searchQuery = useExperimentStore((state) => state.searchQuery)
  const statusFilters = useExperimentStore((state) => state.statusFilters)
  const setSearchQuery = useExperimentStore((state) => state.setSearchQuery)
  const toggleStatusFilter = useExperimentStore((state) => state.toggleStatusFilter)
  const createExperiment = useExperimentStore((state) => state.createExperiment)
  const importDocument = useExperimentStore((state) => state.importDocument)

  const handleImport = async (file: File) => {
    try {
      const rawDocument = JSON.parse(await file.text())
      const nextDocument = normalizeDocument(rawDocument)

      if (!nextDocument) {
        setImportMessage({ kind: 'error', text: '导入失败：JSON 不是有效的实验文档。' })
        return
      }

      const confirmed = window.confirm('导入 JSON 会替换当前实验树，确认继续？')
      if (!confirmed) {
        return
      }

      importDocument(nextDocument)
      setImportMessage({ kind: 'success', text: `已导入 ${Object.keys(nextDocument.nodesById).length} 个实验节点。` })
    } catch {
      setImportMessage({ kind: 'error', text: '导入失败：请检查文件是否为合法 JSON。' })
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Toolbar
        searchQuery={searchQuery}
        activeFilters={statusFilters}
        onSearchChange={setSearchQuery}
        onToggleFilter={toggleStatusFilter}
        onCreateExperiment={createExperiment}
        onExport={() => downloadExperimentDocument(document)}
        onImport={handleImport}
        importMessage={importMessage}
      />

      <main className="grid min-h-[calc(100vh-168px)] gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.35fr)_clamp(24rem,30vw,36rem)] 2xl:gap-8 2xl:px-8 2xl:py-8">
        <section className="rounded-[32px] border border-pencil/70 bg-paper-deep/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          <div className="mb-4 flex items-start justify-between gap-4 px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Branch tree</p>
              <h2 className="mt-2 font-title text-2xl text-ink">实验路线演化图</h2>
            </div>
            <p className="max-w-xs text-right text-sm leading-6 text-ink/60">
              点击任意节点后，右侧会同步打开完整记录区。搜索和筛选会弱化不相关节点，而不是破坏分支上下文。
            </p>
          </div>
          <ExperimentFlow onCreateRoot={createExperiment} />
        </section>

        <RightDetailPanel onCreateRoot={createExperiment} />
      </main>
    </div>
  )
}
