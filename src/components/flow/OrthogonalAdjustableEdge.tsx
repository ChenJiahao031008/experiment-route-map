import { memo, useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useReactFlow,
  type EdgeProps,
  type XYPosition,
} from 'reactflow'

import type { ExperimentEdgeBend, ExperimentNodeId } from '../../types/experiment'

type BendAxis = 'x' | 'y'
type BendKey = keyof ExperimentEdgeBend

type BendHandle = {
  axis: BendAxis
  controls: Array<{
    key: BendKey
    baseValue: number
  }>
  from: XYPosition
  to: XYPosition
  position: XYPosition
  label: string
}

export type OrthogonalAdjustableEdgeData = {
  targetNodeId: ExperimentNodeId
  edgeBend?: ExperimentEdgeBend
  onBendChange: (nodeId: ExperimentNodeId, edgeBend: ExperimentEdgeBend) => void
  onBendReset: (nodeId: ExperimentNodeId) => void
}

const straightLineThreshold = 0.5
const cardStemLength = 28

const isHorizontalHandle = (position: Position) =>
  position === Position.Left || position === Position.Right

const isSameCoordinate = (left: number, right: number) =>
  Math.abs(left - right) <= straightLineThreshold

const shouldRouteLeftRight = (sourcePosition: Position, targetPosition: Position) =>
  isHorizontalHandle(sourcePosition) || isHorizontalHandle(targetPosition)

const getStemPoint = (point: XYPosition, position: Position): XYPosition => {
  if (position === Position.Left) {
    return { x: point.x - cardStemLength, y: point.y }
  }

  if (position === Position.Right) {
    return { x: point.x + cardStemLength, y: point.y }
  }

  if (position === Position.Top) {
    return { x: point.x, y: point.y - cardStemLength }
  }

  return { x: point.x, y: point.y + cardStemLength }
}

const midpoint = (from: XYPosition, to: XYPosition): XYPosition => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2,
})

const compactPoints = (points: XYPosition[]) =>
  points.reduce<XYPosition[]>((compact, point) => {
    const previousPoint = compact.at(-1)

    if (previousPoint && isSameCoordinate(previousPoint.x, point.x) && isSameCoordinate(previousPoint.y, point.y)) {
      return compact
    }

    return [...compact, point]
  }, [])

const toPath = (rawPoints: XYPosition[]) => {
  const points = compactPoints(rawPoints)

  if (points.length === 0) {
    return ''
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`
    }

    const previousPoint = points[index - 1]!
    const nextPoint = points[index + 1]

    if (!nextPoint) {
      return `${path} L ${point.x} ${point.y}`
    }

    const previousDistance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y)
    const nextDistance = Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y)
    const radius = Math.min(10, previousDistance / 2, nextDistance / 2)

    if (radius <= straightLineThreshold) {
      return `${path} L ${point.x} ${point.y}`
    }

    const beforeTurn = {
      x: point.x + ((previousPoint.x - point.x) / previousDistance) * radius,
      y: point.y + ((previousPoint.y - point.y) / previousDistance) * radius,
    }
    const afterTurn = {
      x: point.x + ((nextPoint.x - point.x) / nextDistance) * radius,
      y: point.y + ((nextPoint.y - point.y) / nextDistance) * radius,
    }

    return `${path} L ${beforeTurn.x} ${beforeTurn.y} Q ${point.x} ${point.y} ${afterTurn.x} ${afterTurn.y}`
  }, '')
}

const getHandleLength = (handle: BendHandle) =>
  handle.axis === 'x'
    ? Math.abs(handle.from.y - handle.to.y)
    : Math.abs(handle.from.x - handle.to.x)

const isSameControlLine = (left: BendHandle, right: BendHandle) => {
  if (left.axis !== right.axis) {
    return false
  }

  if (left.axis === 'x') {
    return isSameCoordinate(left.from.x, right.from.x) && isSameCoordinate(left.to.y, right.from.y)
  }

  return isSameCoordinate(left.from.y, right.from.y) && isSameCoordinate(left.to.x, right.from.x)
}

const mergeControlHandles = (handles: BendHandle[]) =>
  handles.reduce<BendHandle[]>((mergedHandles, handle) => {
    if (getHandleLength(handle) <= straightLineThreshold) {
      return mergedHandles
    }

    const lastHandle = mergedHandles.at(-1)

    if (!lastHandle || !isSameControlLine(lastHandle, handle)) {
      return [...mergedHandles, handle]
    }

    return [
      ...mergedHandles.slice(0, -1),
      {
        ...lastHandle,
        controls: [...lastHandle.controls, ...handle.controls],
        to: handle.to,
        position: midpoint(lastHandle.from, handle.to),
      },
    ]
  }, [])

const withBendValue = (
  edgeBend: ExperimentEdgeBend | undefined,
  handle: BendHandle,
  point: XYPosition,
): ExperimentEdgeBend => {
  const nextBend = { ...(edgeBend ?? {}) }

  handle.controls.forEach(({ key, baseValue }) => {
    nextBend[key] = handle.axis === 'x' ? point.x - baseValue : point.y - baseValue
  })

  return nextBend
}

const buildLeftRightRoute = (
  source: XYPosition,
  target: XYPosition,
  sourcePosition: Position,
  targetPosition: Position,
  edgeBend: ExperimentEdgeBend | undefined,
) => {
  const sourceStem = getStemPoint(source, sourcePosition)
  const targetStem = getStemPoint(target, targetPosition)
  const baseCenterX = (sourceStem.x + targetStem.x) / 2
  const centerX = baseCenterX + (edgeBend?.centerXOffset ?? 0)

  if (
    isHorizontalHandle(sourcePosition) &&
    isHorizontalHandle(targetPosition) &&
    isSameCoordinate(source.y, target.y) &&
    isSameCoordinate(centerX, baseCenterX)
  ) {
    return {
      path: toPath([source, target]),
      handles: [] satisfies BendHandle[],
    }
  }

  const points = [
    source,
    sourceStem,
    { x: centerX, y: sourceStem.y },
    { x: centerX, y: targetStem.y },
    targetStem,
    target,
  ]

  return {
    path: toPath(points),
    handles: mergeControlHandles([
      {
        axis: 'x',
        controls: [{ key: 'centerXOffset', baseValue: baseCenterX }],
        from: points[2]!,
        to: points[3]!,
        position: midpoint(points[2]!, points[3]!),
        label: '左右拖动调整中间竖线',
      },
    ] satisfies BendHandle[]),
  }
}

const buildTopBottomRoute = (
  source: XYPosition,
  target: XYPosition,
  sourcePosition: Position,
  targetPosition: Position,
  edgeBend: ExperimentEdgeBend | undefined,
) => {
  const sourceStem = getStemPoint(source, sourcePosition)
  const targetStem = getStemPoint(target, targetPosition)
  const baseCenterY = (sourceStem.y + targetStem.y) / 2
  const centerY = baseCenterY + (edgeBend?.centerYOffset ?? 0)

  if (
    !isHorizontalHandle(sourcePosition) &&
    !isHorizontalHandle(targetPosition) &&
    isSameCoordinate(source.x, target.x) &&
    isSameCoordinate(centerY, baseCenterY)
  ) {
    return {
      path: toPath([source, target]),
      handles: [] satisfies BendHandle[],
    }
  }

  const points = [
    source,
    sourceStem,
    { x: sourceStem.x, y: centerY },
    { x: targetStem.x, y: centerY },
    targetStem,
    target,
  ]

  return {
    path: toPath(points),
    handles: mergeControlHandles([
      {
        axis: 'y',
        controls: [{ key: 'centerYOffset', baseValue: baseCenterY }],
        from: points[2]!,
        to: points[3]!,
        position: midpoint(points[2]!, points[3]!),
        label: '上下拖动调整中间横线',
      },
    ] satisfies BendHandle[]),
  }
}

export const OrthogonalAdjustableEdge = memo(function OrthogonalAdjustableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  style,
  interactionWidth,
  data,
}: EdgeProps<OrthogonalAdjustableEdgeData>) {
  const { screenToFlowPosition } = useReactFlow()
  const [draftBend, setDraftBend] = useState<ExperimentEdgeBend | null>(null)
  const [draggingHandle, setDraggingHandle] = useState<BendHandle | null>(null)
  const activeBend = draftBend ?? data?.edgeBend
  const source = useMemo(() => ({ x: sourceX, y: sourceY }), [sourceX, sourceY])
  const target = useMemo(() => ({ x: targetX, y: targetY }), [targetX, targetY])
  const route = useMemo(
    () =>
      shouldRouteLeftRight(sourcePosition, targetPosition)
        ? buildLeftRightRoute(source, target, sourcePosition, targetPosition, activeBend)
        : buildTopBottomRoute(source, target, sourcePosition, targetPosition, activeBend),
    [activeBend, source, sourcePosition, target, targetPosition],
  )
  const canEditBend = Boolean(data?.targetNodeId && data.onBendChange)

  const getPointerPosition = useCallback(
    (event: PointerEvent | ReactPointerEvent) =>
      screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }),
    [screenToFlowPosition],
  )

  useEffect(() => {
    if (!draggingHandle || !data) {
      return undefined
    }

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault()
      setDraftBend(withBendValue(activeBend, draggingHandle, getPointerPosition(event)))
    }

    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault()
      const nextBend = withBendValue(activeBend, draggingHandle, getPointerPosition(event))
      setDraftBend(null)
      setDraggingHandle(null)
      data.onBendChange(data.targetNodeId, nextBend)
    }

    const handlePointerCancel = () => {
      setDraftBend(null)
      setDraggingHandle(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [activeBend, data, draggingHandle, getPointerPosition])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, handle: BendHandle) => {
      if (!canEditBend) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setDraftBend(withBendValue(activeBend, handle, getPointerPosition(event)))
      setDraggingHandle(handle)
    },
    [activeBend, canEditBend, getPointerPosition],
  )

  const handleDoubleClick = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!data?.targetNodeId) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setDraftBend(null)
      setDraggingHandle(null)
      data.onBendReset(data.targetNodeId)
    },
    [data],
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={route.path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
        interactionWidth={interactionWidth}
      />
      {canEditBend && route.handles.length ? (
        <EdgeLabelRenderer>
          {route.handles.map((handle) => (
            <button
              key={handle.controls.map((control) => control.key).join('-')}
              type="button"
              className={`edge-bend-handle edge-bend-handle-${handle.axis} nodrag nopan${handle.controls.some((control) => activeBend?.[control.key] !== undefined) ? ' is-set' : ''}`}
              title={`${handle.label}，双击恢复自动折线`}
              aria-label={handle.label}
              onPointerDown={(event) => handlePointerDown(event, handle)}
              onDoubleClick={handleDoubleClick}
              style={{
                width: handle.axis === 'x' ? undefined : `${Math.max(getHandleLength(handle), 14)}px`,
                height: handle.axis === 'x' ? `${Math.max(getHandleLength(handle), 14)}px` : undefined,
                transform: `translate(-50%, -50%) translate(${handle.position.x}px, ${handle.position.y}px)`,
              }}
            />
          ))}
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
})
