import React, { useEffect, useRef } from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import { advanceTarget, easeToward, mixHex } from '../../lib/captureRing';

// A single line traced around the camera circle's edge for the length of the
// liveness test: empty when it starts, closed at the shutter, one way only, no
// rotation. The frame's own border filling in, not a spinner on top of it.
//
// Driven OUTSIDE React. `getTarget` is read every frame in a requestAnimationFrame
// loop and the arc is written with setNativeProps — no state, no re-render.
// react-native-reanimated is deliberately not a dependency of this SDK, and a
// native module is the wrong price for one ring; setNativeProps per frame is
// the no-render path core React Native offers, and the write is a single prop
// on a single leaf node. Judge it on a release build on the slowest Android
// you support.

const STROKE = 4; // the frame's own border width
const GREEN_MS = 300;

export function CaptureRing({
  size,
  getTarget,
  color,
  successColor,
  complete,
}: {
  size: number;
  /** Latest 0..1 progress. Read every frame; must be a stable function. */
  getTarget: () => number;
  color: string;
  successColor: string;
  /** Turns the closed ring green — on the same frame as the shutter. */
  complete: boolean;
}) {
  const ref = useRef<React.ElementRef<typeof Circle>>(null);
  const targetRef = useRef(0);
  const shownRef = useRef(0);
  const completeRef = useRef(complete);
  const greenSinceRef = useRef<number | null>(null);
  completeRef.current = complete;

  const r = size / 2 - STROKE / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.1); // a backgrounded app must not jump
      last = now;
      targetRef.current = advanceTarget(targetRef.current, getTarget());
      shownRef.current = easeToward(shownRef.current, targetRef.current, dt);
      if (completeRef.current && greenSinceRef.current == null) greenSinceRef.current = now;
      const green = greenSinceRef.current == null ? 0 : (now - greenSinceRef.current) / GREEN_MS;
      ref.current?.setNativeProps({
        strokeDashoffset: circumference * (1 - shownRef.current),
        stroke: green > 0 ? mixHex(color, successColor, green) : color,
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getTarget, circumference, color, successColor]);

  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0 }}
      width={size}
      height={size}
    >
      {/* Static origin, not motion: the arc starts AND closes at twelve
          o'clock, matching Flutter's `drawArc(rect, -pi / 2, ...)`.

          The rotation sits on a <G>, not on the root <Svg>. react-native-svg
          silently drops transform props on the root: its render applies a
          transform only `if (transform)` — a `rotation`/`originX`/`originY`
          triple leaves that undefined, so the branch never runs — and the
          inner group it wraps children in is built from style/fill/stroke
          props alone, so nothing forwards them there either. `SvgProps
          extends GProps`, so the compiler accepts it and the arc quietly
          starts at three o'clock, which is where the web SDK's CSS
          `-rotate-90` would have put it had CSS applied here.

          It is also deliberately not on the <Circle>: that node takes a
          setNativeProps write every frame, and the transform has no business
          sharing a node with the animation. */}
      <G rotation={-90} originX={size / 2} originY={size / 2}>
        <Circle
          ref={ref}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="butt"
          strokeDasharray={[circumference]}
          strokeDashoffset={circumference}
        />
      </G>
    </Svg>
  );
}
