/**
 * Curated list of common test organisms.
 *
 * Source: the FUZE Certified Testing Protocol page (May 22, 2026) —
 * "Use the right test organism per method." Used as autocomplete
 * suggestions on the TestRequest creation forms; free-text fallback
 * still allowed (labs use slightly different naming conventions).
 */

export interface CommonOrganism {
  id: string;
  label: string;
  testTypes: string[]; // matches TestType enum (ANTIBACTERIAL, FUNGAL, etc.)
}

export const COMMON_ORGANISMS: CommonOrganism[] = [
  { id: "staph_aureus_6538", label: "Staphylococcus aureus (ATCC 6538)", testTypes: ["ANTIBACTERIAL"] },
  { id: "kleb_pneumoniae_4352", label: "Klebsiella pneumoniae (ATCC 4352)", testTypes: ["ANTIBACTERIAL"] },
  { id: "ecoli_25922", label: "E. coli (ATCC 25922)", testTypes: ["ANTIBACTERIAL"] },
  { id: "ecoli_8739", label: "E. coli (ATCC 8739)", testTypes: ["ANTIBACTERIAL"] },
  { id: "moraxella_19976", label: "Moraxella osloensis (ATCC 19976)", testTypes: ["ANTIBACTERIAL", "ODOR"] },
  { id: "aspergillus_brasiliensis", label: "Aspergillus brasiliensis (ATCC 9642)", testTypes: ["FUNGAL"] },
  { id: "candida_albicans_10231", label: "Candida albicans (ATCC 10231)", testTypes: ["FUNGAL"] },
  { id: "influenza_h1n1", label: "Influenza A H1N1", testTypes: ["ANTIVIRAL"] },
  { id: "influenza_h3n2", label: "Influenza A H3N2", testTypes: ["ANTIVIRAL"] },
];

export function suggestionsFor(testType?: string | null): CommonOrganism[] {
  if (!testType) return COMMON_ORGANISMS;
  return COMMON_ORGANISMS.filter((o) => o.testTypes.includes(testType));
}
