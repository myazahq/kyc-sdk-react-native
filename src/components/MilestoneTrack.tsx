import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { Icon, type IconName } from './Icon';
import { MyazaText } from './Typography';

// ---------------------------------------------------------------------------
// The presence story's three-node track, shared by the intro gate (the promise)
// and the success card (the same promise, now running) so the two read as two
// frames of ONE story rather than two unrelated notices.
//
// Nodes ahead of the active one are TINTED, not greyed out: they are the plan,
// not disabled controls. Flat fills only.
// ---------------------------------------------------------------------------

export interface Milestone {
  icon: IconName;
  /** The when: "Your part", "Today", "Then". */
  stage: string;
  title: string;
  caption: string;
  state: 'active' | 'ahead';
}

export function MilestoneTrack({
  milestones,
  numbered = false,
  nodeSize = 40,
}: {
  milestones: readonly Milestone[];
  /** Wear the step number on each node — the sequence is the point on the
   *  intro screen, where nothing has happened yet. */
  numbered?: boolean;
  /** Node diameter, and therefore where the connecting rail has to sit: 40 on
   *  the primer (web h-10), 32 on the success card (web h-8). */
  nodeSize?: number;
}): React.ReactElement {
  const { colors } = useTheme();
  const NODE = nodeSize;
  // The active node's halo: web's `shadow-[0_0_0_5px] shadow-primary/15`
  // (4px on the smaller success-card node), drawn as a ring behind it.
  const halo = NODE >= 40 ? 5 : 4;
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
      {milestones.map((m, i) => {
        const active = m.state === 'active';
        const last = i === milestones.length - 1;
        return (
          <View
            key={m.title}
            style={{ flexDirection: 'row', gap: spacing.md, paddingBottom: last ? 0 : spacing.md }}
          >
            {!last ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: NODE / 2 - 0.5,
                  top: NODE + 4,
                  bottom: 0,
                  width: 1,
                  backgroundColor: `${colors.primary}33`,
                }}
              />
            ) : null}

            <View style={{ width: NODE }}>
              {active ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: -halo,
                    top: -halo,
                    width: NODE + halo * 2,
                    height: NODE + halo * 2,
                    borderRadius: radius.full,
                    backgroundColor: `${colors.primary}26`,
                  }}
                />
              ) : null}
              <View
                style={{
                  width: NODE,
                  height: NODE,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.primary : `${colors.primary}1A`,
                  ...(active ? {} : { borderWidth: 1, borderColor: `${colors.primary}33` }),
                }}
              >
                <Icon name={m.icon} size={NODE * 0.45} color={active ? colors.onPrimary : colors.primary} />
              </View>
              {numbered ? (
                <View
                  style={{
                    position: 'absolute',
                    right: -4,
                    top: -4,
                    width: 18,
                    height: 18,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MyazaText
                    variant="bodySmall"
                    color={active ? colors.primary : colors.textSecondary}
                    style={{ fontSize: 9, fontWeight: '700', lineHeight: 11 }}
                  >
                    {i + 1}
                  </MyazaText>
                </View>
              ) : null}
            </View>

            <View style={{ flex: 1, paddingTop: 2 }}>
              {/* Uppercased by STYLE, not by the string: a screen reader
                  should hear the words, not shouted initials. */}
              <MyazaText
                variant="bodySmall"
                color={active ? colors.primary : colors.textSecondary}
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {m.stage}
              </MyazaText>
              <MyazaText variant="bodyMedium" style={{ fontWeight: '600', marginTop: 1 }}>
                {m.title}
              </MyazaText>
              <MyazaText
                variant="bodySmall"
                color={colors.textSecondary}
                style={{ marginTop: 2 }}
              >
                {m.caption}
              </MyazaText>
            </View>
          </View>
        );
      })}
    </View>
  );
}
