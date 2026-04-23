import { describe, expect, it } from 'vitest'

import {
  addChildExperiment,
  buildBranchDraft,
  computeTreeLayout,
  createInitialDocument,
  createRootExperiment,
  deleteExperimentSubtree,
  getVisibleNodeIds,
  normalizeDocument,
  serializeExperimentDocument,
  updateExperimentNodeManualPosition,
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

  it('normalizes documents without attachments', () => {
    const normalized = normalizeDocument({
      rootId: 'root',
      nodesById: {
        root: {
          id: 'root',
          parentId: null,
          childIds: [],
          title: 'Root',
          changeSummary: '',
          result: '',
          conclusion: '',
          status: 'running',
          timestamp: '2026-04-23T09:00',
          tags: [],
          notes: '',
          branchLabel: '',
        },
      },
    })

    expect(normalized?.version).toBe(2)
    expect(normalized?.nodesById.root?.attachments).toEqual([])
    expect(normalized?.nodesById.root?.manualPosition).toBeUndefined()
  })

  it('preserves valid manual positions and ignores invalid ones during normalization', () => {
    const normalized = normalizeDocument({
      rootId: 'root',
      nodesById: {
        root: {
          id: 'root',
          parentId: null,
          childIds: ['child'],
          title: 'Root',
          changeSummary: '',
          result: '',
          conclusion: '',
          status: 'running',
          timestamp: '2026-04-23T09:00',
          tags: [],
          notes: '',
          branchLabel: '',
          manualPosition: { x: 120, y: 240 },
        },
        child: {
          id: 'child',
          parentId: 'root',
          childIds: [],
          title: 'Child',
          changeSummary: '',
          result: '',
          conclusion: '',
          status: 'running',
          timestamp: '2026-04-23T09:10',
          tags: [],
          notes: '',
          branchLabel: '',
          manualPosition: { x: 'bad', y: 20 },
        },
      },
    })

    expect(normalized?.nodesById.root?.manualPosition).toEqual({ x: 120, y: 240 })
    expect(normalized?.nodesById.child?.manualPosition).toBeUndefined()
  })

  it('computes subtree-aware layout without overlapping sibling branches', () => {
    const initial = createInitialDocument()
    const { document: rootDocument, createdNodeId: rootId } = createRootExperiment(initial, {
      title: 'Root',
    })
    const { document: firstBranchDocument, createdNodeId: childA } = addChildExperiment(
      rootDocument,
      rootId,
      { title: 'A' },
    )
    const { document: secondBranchDocument, createdNodeId: childB } = addChildExperiment(
      firstBranchDocument,
      rootId,
      { title: 'B' },
    )
    const { document: nestedDocument } = addChildExperiment(secondBranchDocument, childA, {
      title: 'A1',
    })

    const layout = computeTreeLayout(nestedDocument)

    expect(layout[rootId]?.x).toBe(0)
    expect(layout[childA]?.x).toBe(1)
    expect(layout[childB]?.x).toBe(1)
    expect(layout[childA]?.y).not.toBe(layout[childB]?.y)
  })

  it('updates manual positions without affecting serialization', () => {
    const initial = createInitialDocument()
    const { document, createdNodeId } = createRootExperiment(initial, {
      title: 'Root',
    })

    const nextDocument = updateExperimentNodeManualPosition(document, createdNodeId, {
      x: 420,
      y: 260,
    })

    expect(nextDocument.nodesById[createdNodeId]?.manualPosition).toEqual({ x: 420, y: 260 })
    expect(() => JSON.parse(serializeExperimentDocument(nextDocument))).not.toThrow()
  })
})
