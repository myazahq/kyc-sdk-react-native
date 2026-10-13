import React from 'react';
import { View } from 'react-native';

import { Spinner } from './Spinner';
import { loaderSpinnerSize } from './spinnerShape';

// The SDK's larger loading indicator. It used to be a pulsing ring around a
// tinted circle; it is now the one spinner every surface shares
// (components/Spinner.tsx), centred in the same box so no screen's layout
// moves. The name is kept because a dozen screens mount it.

export interface UiPulseLoaderProps {
  /** The box the loader sits in. The spinner fills a small box and half of a large one. */
  size?: number;
}

export function UiPulseLoader({ size = 80 }: UiPulseLoaderProps): React.ReactElement {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={loaderSpinnerSize(size)} />
    </View>
  );
}
