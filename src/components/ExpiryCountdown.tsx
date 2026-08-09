import React, { useEffect, useState } from 'react';

import { useTheme } from './runtime';
import { MyazaText } from './Typography';

// ---------------------------------------------------------------------------
// Live "expires in m:ss" ticker for a one-time code.
//
// Ticks once a second and stops at zero, so a stale challenge reads as expired
// instead of claiming minutes that already elapsed. Mirrors the web and Flutter
// SDKs — without it the user has no idea whether to keep waiting for a code or
// ask for a new one.
// ---------------------------------------------------------------------------

export function ExpiryCountdown({
  expiresAt,
  expiredLabel = 'The code has expired. Request a new one.',
}: {
  /** ISO timestamp from the send response. */
  expiresAt: string;
  expiredLabel?: string;
}): React.ReactElement | null {
  const { colors } = useTheme();
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    // Re-seed on a resend: the new challenge carries a later expiry.
    setRemaining(Math.max(0, target - Date.now()));
    const id = setInterval(() => {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  // An unparseable timestamp would render "NaN:aN" — show nothing instead.
  if (!Number.isFinite(target)) return null;

  const totalSeconds = Math.ceil(remaining / 1000);
  const label =
    remaining === 0
      ? expiredLabel
      : `The code expires in ${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;

  return (
    <MyazaText variant="bodySmall" color={colors.textMuted}>
      {label}
    </MyazaText>
  );
}
