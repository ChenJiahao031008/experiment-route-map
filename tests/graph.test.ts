import { describe, expect, it } from 'vitest'

import { getBranchEdgeHandles } from '../src/lib/edgeHandles'
import type { BranchDirection } from '../src/types/experiment'
import {
  addChildExperiment,
  buildBranchDraft,
  computeTreeLayout,
  createInitialDocument,
  createRootExperiment,
  deleteExperimentSubtree,
  getVisibleNodeIds,
  moveExperimentSubtree,
  normalizeDocument,
  serializeExperimentDocument,
  updateExperimentEdgeConnection,
  updateExperimentNodeManualPosition,
} from '../src/lib/graph'

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

  it('normalizes invalid imported document fields', () => {
    const normalized = normalizeDocument({
      rootId: 'missing-root',
      nodesById: {
        root: {
          id: 'root',
          parentId: null,
          childIds: [],
          title: 'Root',
          status: 'unknown',
          tags: ['valid', 123, null],
        },
      },
    })

    expect(normalized?.rootId).toBe('root')
    expect(normalized?.nodesById.root?.status).toBe('running')
    expect(normalized?.nodesById.root?.tags).toEqual(['valid'])
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

  it('can create a child experiment with an initial manual position and branch direction', () => {
    const initial = createInitialDocument()
    const { document, createdNodeId: rootId } = createRootExperiment(initial, {
      title: 'Root',
    })

    const { document: nextDocument, createdNodeId: childId } = addChildExperiment(
      document,
      rootId,
      { title: 'Child' },
      { manualPosition: { x: 120, y: -220 }, branchDirection: 'top' },
    )

    expect(nextDocument.nodesById[childId]?.manualPosition).toEqual({ x: 120, y: -220 })
    expect(nextDocument.nodesById[childId]?.branchDirection).toBe('top')
  })

  it('selects edge handles from the branch direction', () => {
    const source = { x: 100, y: 100 }

    expect(getBranchEdgeHandles(source, { x: 100, y: -80 })).toEqual({
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
    })
    expect(getBranchEdgeHandles(source, { x: 100, y: 280 })).toEqual({
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
    })
    expect(getBranchEdgeHandles(source, { x: -200, y: 100 })).toEqual({
      sourceHandle: 'source-left',
      targetHandle: 'target-right',
    })
    expect(getBranchEdgeHandles(source, { x: 400, y: 100 })).toEqual({
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
    })
  })

  it('prefers saved branch direction when selecting edge handles', () => {
    const source = { x: 100, y: 100 }
    const target = { x: 380, y: -80 }

    expect(getBranchEdgeHandles(source, target, 'top' satisfies BranchDirection)).toEqual({
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
    })
  })

  it('prefers manual edge connection when selecting edge handles', () => {
    const source = { x: 100, y: 100 }
    const target = { x: 380, y: -80 }

    expect(getBranchEdgeHandles(source, target, 'top', {
      sourceDirection: 'bottom',
      targetDirection: 'right',
    })).toEqual({
      sourceHandle: 'source-bottom',
      targetHandle: 'target-right',
    })
  })

  it('updates a node edge connection without changing tree structure', () => {
    const initial = createInitialDocument()
    const { document: rootDocument, createdNodeId: rootId } = createRootExperiment(initial, {
      title: 'Root',
    })
    const { document: childDocument, createdNodeId: childId } = addChildExperiment(
      rootDocument,
      rootId,
      { title: 'Child' },
    )

    const nextDocument = updateExperimentEdgeConnection(childDocument, childId, {
      sourceDirection: 'top',
      targetDirection: 'left',
    })

    expect(nextDocument.nodesById[rootId]?.childIds).toEqual([childId])
    expect(nextDocument.nodesById[childId]?.parentId).toBe(rootId)
    expect(nextDocument.nodesById[childId]?.edgeConnection).toEqual({
      sourceDirection: 'top',
      targetDirection: 'left',
    })
  })

  it('moves a subtree to a different parent without changing descendants', () => {
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
    const { document: nestedDocument, createdNodeId: grandchild } = addChildExperiment(
      secondBranchDocument,
      childA,
      { title: 'A1' },
    )

    const movedDocument = moveExperimentSubtree(nestedDocument, childA, childB, {
      manualPosition: { x: 640, y: 220 },
      branchDirection: 'right',
    })

    expect(movedDocument.nodesById[rootId]?.childIds).toEqual([childB])
    expect(movedDocument.nodesById[childB]?.childIds).toContain(childA)
    expect(movedDocument.nodesById[childA]?.parentId).toBe(childB)
    expect(movedDocument.nodesById[childA]?.childIds).toEqual([grandchild])
    expect(movedDocument.nodesById[childA]?.manualPosition).toEqual({ x: 640, y: 220 })
    expect(movedDocument.nodesById[childA]?.branchDirection).toBe('right')
  })

  it('prevents moving a node below itself or its descendants', () => {
    const initial = createInitialDocument()
    const { document: rootDocument, createdNodeId: rootId } = createRootExperiment(initial, {
      title: 'Root',
    })
    const { document: childDocument, createdNodeId: childId } = addChildExperiment(
      rootDocument,
      rootId,
      { title: 'Child' },
    )
    const { document: nestedDocument, createdNodeId: grandchildId } = addChildExperiment(
      childDocument,
      childId,
      { title: 'Grandchild' },
    )

    expect(() => moveExperimentSubtree(nestedDocument, childId, childId)).toThrow()
    expect(() => moveExperimentSubtree(nestedDocument, childId, grandchildId)).toThrow()
    expect(() => moveExperimentSubtree(nestedDocument, rootId, childId)).toThrow()
  })
})
