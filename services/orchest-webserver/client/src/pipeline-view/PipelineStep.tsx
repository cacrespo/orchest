import { useForceUpdate } from "@/hooks/useForceUpdate";
import {
  MouseTracker,
  Offset,
  PipelineStepMetaData,
  PipelineStepState,
  PipelineStepStatus,
} from "@/types";
import Box from "@mui/material/Box";
import { hasValue } from "@orchest/lib-utils";
import classNames from "classnames";
import React from "react";
import { DRAG_CLICK_SENSITIVITY } from "./common";
import { EventVarsAction } from "./useEventVars";

export const STEP_WIDTH = 190;
export const STEP_HEIGHT = 105;

export type ExecutionState = {
  finished_time?: Date;
  server_time?: Date;
  started_time?: Date;
  status: PipelineStepStatus;
};

const formatSeconds = (seconds: number) => {
  // Hours, minutes and seconds
  let hrs = ~~(seconds / 3600);
  let mins = ~~((seconds % 3600) / 60);
  let secs = ~~seconds % 60;

  let ret = "";
  if (hrs > 0) {
    ret += hrs + "h ";
  }
  if (mins > 0) {
    ret += mins + "m ";
  }
  ret += secs + "s";
  return ret;
};

const getStateText = (executionState: ExecutionState) => {
  let stateText = "Ready";

  if (executionState.status === "SUCCESS") {
    let seconds = Math.round(
      (executionState.finished_time.getTime() -
        executionState.started_time.getTime()) /
        1000
    );

    stateText = "Completed (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status === "FAILURE") {
    let seconds = 0;

    if (executionState.started_time !== undefined) {
      seconds = Math.round(
        (executionState.finished_time.getTime() -
          executionState.started_time.getTime()) /
          1000
      );
    }

    stateText = "Failure (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status === "STARTED") {
    let seconds = 0;

    if (executionState.started_time !== undefined) {
      seconds = Math.round(
        (executionState.server_time.getTime() -
          executionState.started_time.getTime()) /
          1000
      );
    }

    stateText = "Running (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status == "PENDING") {
    stateText = "Pending";
  }
  if (executionState.status == "ABORTED") {
    stateText = "Aborted";
  }
  return stateText;
};

const PipelineStepComponent = React.forwardRef(function PipelineStep(
  {
    initialValue,
    scaleFactor,
    offset,
    executionState,
    selected,
    zIndexMax,
    isSelectorActive,
    isStartNodeOfNewConnection,
    eventVarsDispatch,
    mouseTracker,
    selectedSingleStep,
    disabledDragging,
    incomingDot,
    outgoingDot,
  }: {
    initialValue: PipelineStepState;
    scaleFactor: number;
    offset: Offset;
    selected: boolean;
    zIndexMax: number;
    isSelectorActive: boolean;
    isStartNodeOfNewConnection: boolean;
    executionState?: ExecutionState;
    eventVarsDispatch: (value: EventVarsAction) => void;
    mouseTracker: React.MutableRefObject<MouseTracker>;
    selectedSingleStep: React.MutableRefObject<string>;
    disabledDragging?: boolean;
    incomingDot: React.ReactNode;
    outgoingDot: React.ReactNode;
    // TODO: clean up these
    onDoubleClick?: any;
  },
  ref: React.MutableRefObject<HTMLDivElement>
) {
  const [, forceUpdate] = useForceUpdate();
  const [step, setStep] = React.useState<Omit<PipelineStepState, "meta_data">>(
    () => {
      const { meta_data, ...rest } = initialValue; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
    }
  );
  const [metadata, setMetadata] = React.useState<PipelineStepMetaData>(() => ({
    ...initialValue.meta_data,
  }));

  const stateText = React.useMemo(() => getStateText(executionState), [
    executionState,
  ]);

  const isMouseDown = React.useRef(false);

  const dragCount = React.useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isMouseDown.current = true;
    forceUpdate();
  };

  const resetDraggingVariables = React.useCallback(() => {
    selectedSingleStep.current = undefined;
    dragCount.current = 0;
    forceUpdate();
  }, [selectedSingleStep, dragCount, forceUpdate]);

  // we cannot use onClick in this component, but we need to achieve things alike
  const handleClickBehavior = (e: React.MouseEvent) => {
    const ctrlKeyPressed = e.ctrlKey || e.metaKey;

    // if this step (and possibly other steps) are selected,
    // press ctrl/cmd and select this step => remove this step from the selection
    if (selected && ctrlKeyPressed) {
      eventVarsDispatch({ type: "DESELECT_STEPS", payload: [step.uuid] });
      return;
    }
    // only need to re-render if step is not selected
    if (!selected) {
      eventVarsDispatch({
        type: "SELECT_STEPS",
        payload: { uuids: [step.uuid], inclusive: ctrlKeyPressed },
      });
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // we want this event to be propagated because Canvas also needs to be notified

    isMouseDown.current = false;

    // This is basically onClick, we cannot use onClick here
    // because onClick is always called after onMouseUp and we cannot distinguish them within React
    if (dragCount.current < DRAG_CLICK_SENSITIVITY && !isSelectorActive) {
      handleClickBehavior(e);
    }

    // this step could have been being dragged, when mouse up, simply reset all variables
    resetDraggingVariables();
    // TODO: save all steps to BE
  };

  const onMouseLeave = () => {
    // if cursor moves too fast, or move out of canvas, we need to remove the dragging state
    isMouseDown.current = false;
    if (selected) {
      resetDraggingVariables();
    }
  };

  // use mouseTracker to get mouse movements
  // mutate the local metadata without update the central state in useEventVars
  // so that we can ONLY re-render selected steps and get away from performance penalty
  React.useEffect(() => {
    const isBeingDragged = () => {
      if (!isMouseDown.current) return false;
      if (dragCount.current < DRAG_CLICK_SENSITIVITY) {
        dragCount.current += 1;
        return false;
      }

      selectedSingleStep.current = step.uuid;

      // if not selected, selectedSteps must be empty
      // we select current step
      if (!selected) {
        eventVarsDispatch({
          type: "SELECT_STEPS",
          payload: { uuids: [step.uuid] },
        });
      }

      return true;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (disabledDragging) {
        resetDraggingVariables();
        return;
      }

      const shouldFollowSelectedSingleStep =
        selected && !isSelectorActive && hasValue(selectedSingleStep.current);

      const shouldMoveWithCursor =
        isBeingDragged() || shouldFollowSelectedSingleStep;

      if (shouldMoveWithCursor) {
        setMetadata((current) => {
          const { x, y } = mouseTracker.current.delta;
          const updatedPosition = [
            current.position[0] + x,
            current.position[1] + y,
          ];
          return {
            ...current,
            position: updatedPosition as [number, number],
          };
        });
      }
    };
    document.body.addEventListener("mousemove", onMouseMove);
    return () => document.body.removeEventListener("mousemove", onMouseMove);
  }, [
    scaleFactor,
    mouseTracker,
    step.uuid,
    isSelectorActive,
    selected,
    selectedSingleStep,
    resetDraggingVariables,
    offset,
    dragCount,
    disabledDragging,
    eventVarsDispatch,
  ]);

  const [x, y] = metadata.position;
  const transform = `translateX(${x}px) translateY(${y}px)`;
  const shouldExpandBackground = selectedSingleStep.current === step.uuid;
  return (
    <Box
      data-uuid={step.uuid}
      data-test-title={step.title}
      data-test-id={"pipeline-step"}
      ref={ref}
      className={classNames(
        "pipeline-step",
        executionState.status,
        selected && "selected",
        metadata.hidden && "hidden",
        isStartNodeOfNewConnection && "creating-connection"
      )}
      style={{
        transform,
        zIndex:
          dragCount.current === DRAG_CLICK_SENSITIVITY ||
          isMouseDown.current ||
          (!isSelectorActive && selected)
            ? zIndexMax + 1
            : "unset",
      }}
      sx={{
        // create a transparent background to prevent mouse leave occur unexpectedly
        "&::after": shouldExpandBackground
          ? {
              content: "''",
              minWidth: STEP_WIDTH * 5,
              minHeight: STEP_HEIGHT * 5,
              display: "block",
              position: "absolute",
              left: -STEP_WIDTH * 2,
              top: -STEP_HEIGHT * 2,
            }
          : null,
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {incomingDot}
      <div className={"execution-indicator"}>
        {{
          SUCCESS: <span className="success">✓ </span>,
          FAILURE: <span className="failure">✗ </span>,
          ABORTED: <span className="aborted">❗ </span>,
        }[executionState.status] || null}
        {stateText}
      </div>
      <div className="step-label-holder">
        <div className={"step-label"}>
          {step.title}
          <span className="filename">{step.file_path}</span>
          <span className="filename">{step.uuid}</span>
        </div>
      </div>
      {outgoingDot}
    </Box>
  );
});

export const PipelineStep = React.memo(PipelineStepComponent);
