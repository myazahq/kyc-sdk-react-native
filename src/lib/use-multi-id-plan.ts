import { useMemo } from 'react';

import { multiIdPlan, type MultiIdPlan } from './multi-id';
import { useEffectiveCountry, useFlowState, useVerificationConfig } from '../components/runtime';

/**
 * The active multi-ID plan for the current state, or null on an ordinary run.
 *
 * One hook so the picker and the position strip cannot disagree about which
 * check the applicant is on or what it may offer — the server validates the
 * pick sequence, so two answers here means submissions it rejects.
 */
export function useMultiIdPlan(): MultiIdPlan | null {
  const config = useVerificationConfig();
  const country = useEffectiveCountry();
  const multiIdSlotIndex = useFlowState((s) => s.multiIdSlotIndex);
  const multiIdSlots = useFlowState((s) => s.multiIdSlots);
  const serverConfig = useFlowState((s) => s.serverConfig);

  return useMemo(
    () =>
      multiIdPlan(
        { ...config, country },
        { multiIdSlotIndex, multiIdSlots },
        serverConfig.status === 'ready' ? serverConfig.idTypes : [],
      ),
    [config, country, multiIdSlotIndex, multiIdSlots, serverConfig],
  );
}
