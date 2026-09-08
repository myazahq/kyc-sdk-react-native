import React from 'react';
import { View } from 'react-native';

import { radius } from '../config/theme';

/** The terminal screens' 88px circular badge: a tinted disc with a 2px ring,
 *  holding the outcome icon. Shared by the submitted and result screens. */
export function Badge({ bg, border, children }: { bg: string; border: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View
      style={{
        width: 88,
        height: 88,
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
