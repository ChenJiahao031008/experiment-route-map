import { serializeExperimentDocument } from './graph'
import type { ExperimentDocument } from '../types/experiment'

export const downloadExperimentDocument = (experimentDocument: ExperimentDocument) => {
  const content = serializeExperimentDocument(experimentDocument)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')

  anchor.href = url
  anchor.download = `experiment-notebook-${new Date().toISOString()}.json`
  anchor.click()

  URL.revokeObjectURL(url)
}
