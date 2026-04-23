import { describe, expect, it } from 'vitest'

import {
  addChildExperiment,
  buildBranchDraft,
  createInitialDocument,
  createRootExperiment,
  deleteExperimentSubtree,
  getVisibleNodeIds,
  serializeExperimentDocument,
} from '../lib/graph'

describe('graph helpers', () => {
  it('creates a root experiment', () => {
    const initial = createInitialDocument()
    const { document, createdNodeId } = createRootExperiment(initial, {
      title: '根实验',
    })

    expect(document.rootId).toBe(createdNodeId)
    expect(document.nodesById[createdNodeId]?.title).toBe('根实验')
  })

  it('creates a branch draft inheriting tags but not conclusions', () => {
    const initial = createInitialDocument()
    const { document, createdNodeId } = createRootExperiment(initial, {
      title: 'Baseline',
      tags: ['baseline'],
      conclusion: 'seed conclusion',
    })

    const branchDraft = buildBranchDraft(document, createdNodeId)

    expect(branchDraft.tags).toEqual(['baseline'])
    expect(branchDraft.conclusion).toBe('')
    expect(branchDraft.title).toContain('Baseline')
  })

  it('deletes an entire subtree', () => {
    const initial = createInitialDocument()
    const { document: rootDocument, createdNodeId: rootId } = createRootExperiment(initial, {
      title: 'Root',
    })
    const { document: childDocument, createdNodeId: childId } = addChildExperiment(
      rootDocument,
      rootId,
      { title: 'Child' },
    )
    const { document: branchDocument } = addChildExperiment(childDocument, childId, {
      title: 'Grandchild',
    })

    const { document: nextDocument, deletedIds, nextSelectedNodeId } = deleteExperimentSubtree(
      branchDocument,
      childId,
    )

    expect(deletedIds).toHaveLength(2)
    expect(nextDocument.nodesById[childId]).toBeUndefined()
    expect(nextDocument.nodesById[rootId]?.childIds).toEqual([])
    expect(nextSelectedNodeId).toBe(rootId)
  })

  it('filters nodes by search query and status', () => {
    const initial = createInitialDocument()
    const { document: rootDocument, createdNodeId: rootId } = createRootExperiment(initial, {
      title: 'Root',
      conclusion: 'stable baseline',
      status: 'success',
    })
    const { document: branchDocument } = addChildExperiment(rootDocument, rootId, {
      title: 'Branch',
      changeSummary: 'try lower lr',
      status: 'running',
    })

    expect(getVisibleNodeIds(branchDocument, 'baseline', [])).toEqual([rootId])
    expect(getVisibleNodeIds(branchDocument, '', ['running'])).toHaveLength(1)
  })

  it('serializes experiment document as JSON', () => {
    const initial = createInitialDocument()
    const { document } = createRootExperiment(initial, {
      title: 'Root',
    })

    expect(() => JSON.parse(serializeExperimentDocument(document))).not.toThrow()
  })
})
