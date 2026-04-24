import type { BranchDirection, ExperimentEdgeConnection } from '../types/experiment'

type CanvasPosition = {
  x: number
  y: number
}

type BranchEdgeHandles = {
  sourceHandle: string
  targetHandle: string
}

const oppositeDirections: Record<BranchDirection, BranchDirection> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
}

export const getBranchDirectionFromPositions = (
  sourcePosition: CanvasPosition,
  targetPosition: CanvasPosition,
): BranchDirection => {
  const deltaX = targetPosition.x - sourcePosition.x
  const deltaY = targetPosition.y - sourcePosition.y

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX < 0 ? 'left' : 'right'
  }

  return deltaY < 0 ? 'top' : 'bottom'
}

export const getBranchEdgeHandles = (
  sourcePosition: CanvasPosition,
  targetPosition: CanvasPosition,
  preferredDirection?: BranchDirection,
  edgeConnection?: ExperimentEdgeConnection,
): BranchEdgeHandles => {
  const sourceDirection = edgeConnection?.sourceDirection ?? preferredDirection ?? getBranchDirectionFromPositions(sourcePosition, targetPosition)
  const targetDirection = edgeConnection?.targetDirection ?? oppositeDirections[sourceDirection]

  return {
    sourceHandle: `source-${sourceDirection}`,
    targetHandle: `target-${targetDirection}`,
  }
}

export const getBranchDirectionFromHandle = (handleId: string | null | undefined): BranchDirection | undefined => {
  const direction = handleId?.replace(/^(source|target)-/, '')

  if (direction === 'left' || direction === 'right' || direction === 'top' || direction === 'bottom') {
    return direction
  }

  return undefined
}
