import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../../components/runtime';
import { useReduceMotion } from '../../components/StaggerIn';
import { MyazaPulseLoader } from '../../components/MyazaPulseLoader';
import type { Size } from '../../lib/livenessCutout';
import type { LivenessPhase } from '../../liveness/types';
import { StyleAbsFill } from './constants';
import { SCAN_DELAY_MS, SCAN_MS, ScanSweep } from './ScanSweep';
import { ShutterFlash } from './ShutterFlash';
import { WindowRing } from './WindowRing';

// ---------------------------------------------------------------------------
// The face window of the full-screen camera: its line on the edge and the
// marks that land inside it. The window itself is empty. The camera is behind
// it, full screen, and shows through sharp because the blur leaves this shape
// out (Backdrop).
// ---------------------------------------------------------------------------

/** How long the frame is held after the photo before the step moves on:
 *  the shutter, then the scan, then a breath before the review. */
export const SCAN_HOLD_MS = SCAN_DELAY_MS + SCAN_MS + 100;

const zeroProgress = (): number => 0;

export function LivenessWindow({
  window,
  phase,
  warning,
  loading,
  getRingTarget,
  segments,
  windowRef,
}: {
  window: Size;
  phase: LivenessPhase;
  /** Something is in the way: the line's bed turns red under it. */
  warning: boolean;
  loading: boolean;
  getRingTarget: () => number;
  /** Stages of the test: the line is cut into this many parts. */
  segments: number;
  /** Measured for the flash, which paints everywhere but here. */
  windowRef: React.RefObject<View | null>;
}): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const failed = phase === 'failed';
  const track = loading ? colors.gray300 : warning || failed ? colors.error : `${colors.primary}55`;
  return (
    <View ref={windowRef} collapsable={false} style={{ width: window.width, height: window.height }}>
      <View
        pointerEvents="none"
        style={[
          StyleAbsFill,
          { borderRadius: window.width / 2, overflow: 'hidden' },
        ]}
      >
        {loading ? (
          <View style={[StyleAbsFill, { backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }]}>
            <MyazaPulseLoader size={64} />
          </View>
        ) : null}

        {/* A step landed: a green wash and a tick. */}
        {phase === 'challenge_passed' ? (
          <View style={[StyleAbsFill, { backgroundColor: `${colors.success}33`, alignItems: 'center', justifyContent: 'center' }]}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={36} height={36} viewBox="0 0 24 24">
                <Path d="M5 13l4 4L19 7" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </View>
        ) : null}

        {/* The shutter, then one pass of light. The pass is skipped when the
            person asked for less motion. */}
        {phase === 'complete' ? <ShutterFlash /> : null}
        {phase === 'complete' && !reduceMotion ? <ScanSweep window={window} /> : null}

      </View>
      {loading ? null : (
        <WindowRing
          // A failed check has no progress to show: only the bed, in red.
          window={window}
          getTarget={failed ? zeroProgress : getRingTarget}
          color={colors.success}
          track={track}
          segments={segments}
        />
      )}
    </View>
  );
}
