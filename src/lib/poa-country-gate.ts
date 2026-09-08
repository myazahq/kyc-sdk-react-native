// ---------------------------------------------------------------------------
// The Proof of Address step's country gate.
//
// On the ADDRESS scope the declared country is the applicant's own claim about
// their market: it picks the document kinds on offer, the PoA vendor market and
// rides the submission as the verification's country, and the scope seeds none
// (see AddressCountryControl). A document uploaded with no country behind it is
// not yet a complete answer, so Continue holds until one is declared (user
// decision 2026-09-08). Elsewhere the flow's own country stands and the gate
// never bites; an org that accepts exactly ONE country has the control show it
// as a settled fact, which counts as declared.
//
// A THREE-WAY MIRROR of the web SDK's lib/poa-country-gate.ts and Flutter's
// config/poa_country_gate.dart; change the rule in one and change all three.
// ---------------------------------------------------------------------------

/** Whether the Proof of Address step may continue as far as the COUNTRY is
 *  concerned (the upload has its own gate). */
export function poaCountryDeclared(facts: {
  scope: string | null;
  selectedCountry: string | null | undefined;
  offered: readonly string[];
}): boolean {
  if (facts.scope !== 'address') return true;
  if (facts.selectedCountry?.trim()) return true;
  return facts.offered.length === 1;
}
