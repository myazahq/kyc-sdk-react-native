import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';
import type { KeyPeopleSection } from './keyPeopleSections';
import type { WorkflowBusinessConfig } from '../types/business';

// The step's section definitions — which sections show and what they say.
// Split from keyPeopleSections.ts (200-line rule).

/**
 * The register's default beneficial-ownership line, when the workflow does
 * not set its own. Mirrors the server's `uboThresholdFor`: 25 is the
 * FATF/EU/FinCEN indicative figure; Nigeria's CAMA files significant control
 * from a lower bar, so NG defaults to 10. Keep in lockstep with the web SDK.
 */
export function defaultUboThreshold(country?: string | null): number {
  return (country ?? '').toUpperCase() === 'NG' ? 10 : 25;
}

export interface KeyPeopleSectionDef {
  key: KeyPeopleSection;
  title: string;
  description: string;
  addLabel: string;
}

/**
 * Which sections the step shows, with their plain-language definitions. The
 * definitions carry the REAL threshold (workflow override or the register's
 * default) — a printed band the server does not enforce would be a lie the
 * applicant plans around. Scope follows the workflow's `keyPeople.roles`.
 */
export function keyPeopleSectionList(
  business: WorkflowBusinessConfig | undefined,
  threshold: number,
  t: TextFn = defaultText,
): KeyPeopleSectionDef[] {
  const scoped = business?.keyPeople?.roles;
  const inScope = (roles: string[]): boolean =>
    !scoped || scoped.length === 0 || roles.some((r) => scoped.includes(r as never));

  const pct = String(threshold);
  const out: KeyPeopleSectionDef[] = [];
  if (inScope(['beneficial_owner'])) {
    out.push({
      key: 'ubos',
      title: 'Beneficial owners',
      description: `Individuals who own ${pct}% or more of the company.`,
      addLabel: t('keyPeople.section.ubos.add'),
    });
  }
  if (inScope(['shareholder'])) {
    out.push({
      key: 'shareholders',
      title: 'Shareholders',
      description: `People or companies holding under ${pct}%.`,
      addLabel: t('keyPeople.section.shareholders.add'),
    });
  }
  if (inScope(['director', 'signatory'])) {
    out.push({
      key: 'representatives',
      title: 'Directors & representatives',
      description: t('keyPeople.section.representatives.description'),
      addLabel: t('keyPeople.section.representatives.add'),
    });
  }
  return out;
}
