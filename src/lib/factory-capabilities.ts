// ─────────────────────────────────────────────────────────────
// Factory capability taxonomy (brand-facing factory profiles).
//
// Grouped capability options a mill checks on registration. The `id`
// values are STABLE — they are persisted into Factory.capabilities (a JSON
// string[]) and drive the search facets on /factories. Change labels freely;
// do NOT change an id without migrating stored values.
//
// Structured across the nine stages of textile manufacturing (A–I):
// Knitting, Weaving, Spinning / Yarn, Dyeing, Finishing, Printing,
// Garment / Cut & Sew, Nonwovens, and Fibers. Content is a comprehensive
// industry-standard default and can be extended per Andrew's direction.
// ─────────────────────────────────────────────────────────────

export interface CapabilityOption {
  id: string;
  label: string;
}

export interface CapabilityGroup {
  key: string;
  label: string;
  icon: string;
  options: CapabilityOption[];
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  // ── A. Knitting ──
  {
    key: "knitting",
    label: "Knitting",
    icon: "🧶",
    options: [
      { id: "knit_circular", label: "Circular Knit" },
      { id: "knit_single_jersey", label: "Single Jersey" },
      { id: "knit_double_jersey_interlock", label: "Double Jersey / Interlock" },
      { id: "knit_rib", label: "Rib Knit" },
      { id: "knit_flat_vbed", label: "Flat / V-Bed Knit" },
      { id: "knit_fully_fashioned", label: "Fully Fashioned" },
      { id: "knit_seamless", label: "Seamless" },
      { id: "knit_warp_tricot", label: "Warp Knit — Tricot" },
      { id: "knit_warp_raschel", label: "Warp Knit — Raschel" },
      { id: "knit_jacquard", label: "Jacquard Knit" },
      { id: "knit_terry_fleece", label: "Terry / Fleece Knit" },
      { id: "knit_spacer", label: "Spacer Fabric" },
      { id: "knit_socks_hosiery", label: "Socks / Hosiery" },
    ],
  },
  // ── B. Weaving ──
  {
    key: "weaving",
    label: "Weaving",
    icon: "🪡",
    options: [
      { id: "weave_air_jet", label: "Air-Jet Loom" },
      { id: "weave_water_jet", label: "Water-Jet Loom" },
      { id: "weave_rapier", label: "Rapier Loom" },
      { id: "weave_projectile", label: "Projectile Loom" },
      { id: "weave_shuttle", label: "Shuttle Loom" },
      { id: "weave_dobby", label: "Dobby" },
      { id: "weave_jacquard", label: "Jacquard Weave" },
      { id: "weave_plain", label: "Plain Weave / Poplin" },
      { id: "weave_twill_denim", label: "Twill / Denim" },
      { id: "weave_satin_sateen", label: "Satin / Sateen" },
      { id: "weave_dobby_terry", label: "Terry / Toweling" },
      { id: "weave_narrow_tape", label: "Narrow / Tape / Webbing" },
    ],
  },
  // ── C. Spinning / Yarn ──
  {
    key: "spinning",
    label: "Spinning / Yarn",
    icon: "🧵",
    options: [
      { id: "spin_ring", label: "Ring Spinning" },
      { id: "spin_open_end_rotor", label: "Open-End / Rotor" },
      { id: "spin_compact", label: "Compact Spinning" },
      { id: "spin_vortex_airjet", label: "Vortex / Air-Jet Spinning" },
      { id: "spin_slub_fancy", label: "Slub / Fancy Yarn" },
      { id: "spin_core_spun", label: "Core-Spun (Elastane)" },
      { id: "yarn_air_texturing", label: "Air Texturing" },
      { id: "yarn_draw_texturing_dty", label: "Draw Texturing (DTY)" },
      { id: "yarn_twisting", label: "Twisting / Doubling" },
      { id: "yarn_dyeing_package", label: "Package / Yarn Dyeing" },
      { id: "yarn_mercerized", label: "Mercerized Yarn" },
      { id: "yarn_recycled", label: "Recycled Yarn" },
    ],
  },
  // ── D. Dyeing ──
  {
    key: "dyeing",
    label: "Dyeing",
    icon: "🎨",
    options: [
      { id: "dye_yarn", label: "Yarn Dyeing" },
      { id: "dye_package", label: "Package Dyeing" },
      { id: "dye_beam", label: "Beam Dyeing" },
      { id: "dye_piece_jet", label: "Piece Dyeing — Jet / Overflow" },
      { id: "dye_piece_jig", label: "Piece Dyeing — Jigger" },
      { id: "dye_continuous_pad", label: "Continuous / Pad Dyeing" },
      { id: "dye_garment", label: "Garment Dyeing" },
      { id: "dye_cold_pad_batch", label: "Cold Pad Batch" },
      { id: "dye_reactive", label: "Reactive Dyes" },
      { id: "dye_disperse", label: "Disperse Dyes (Polyester)" },
      { id: "dye_vat", label: "Vat Dyes" },
      { id: "dye_acid", label: "Acid Dyes (Wool / Nylon)" },
      { id: "dye_indigo_denim", label: "Indigo / Denim Dyeing" },
      { id: "dye_dope_solution", label: "Dope / Solution Dyeing" },
    ],
  },
  // ── E. Finishing ──
  {
    key: "finishing",
    label: "Finishing",
    icon: "✨",
    options: [
      { id: "finish_stenter_heatset", label: "Stenter / Heat Setting" },
      { id: "finish_sanforize", label: "Sanforizing / Compacting" },
      { id: "finish_calendaring", label: "Calendaring" },
      { id: "finish_brushing_sueding", label: "Brushing / Sueding" },
      { id: "finish_peaching", label: "Peaching" },
      { id: "finish_mercerizing", label: "Mercerizing" },
      { id: "finish_dwr", label: "DWR / Water Repellent" },
      { id: "finish_antimicrobial", label: "Antimicrobial Finish" },
      { id: "finish_wicking", label: "Moisture Wicking" },
      { id: "finish_softening", label: "Softening / Hand Feel" },
      { id: "finish_wrinkle_resist", label: "Wrinkle / Easy-Care" },
      { id: "finish_flame_retardant", label: "Flame Retardant" },
      { id: "finish_coating_lamination", label: "Coating / Lamination" },
      { id: "finish_garment_wash", label: "Garment / Denim Wash" },
    ],
  },
  // ── F. Printing ──
  {
    key: "printing",
    label: "Printing",
    icon: "🖨️",
    options: [
      { id: "print_rotary_screen", label: "Rotary Screen" },
      { id: "print_flat_screen", label: "Flat-Bed Screen" },
      { id: "print_digital_textile", label: "Digital Textile Print" },
      { id: "print_sublimation", label: "Sublimation" },
      { id: "print_pigment", label: "Pigment Print" },
      { id: "print_reactive", label: "Reactive Print" },
      { id: "print_discharge", label: "Discharge Print" },
      { id: "print_burnout_devore", label: "Burnout / Devoré" },
      { id: "print_transfer", label: "Heat Transfer" },
      { id: "print_placement_garment", label: "Placement / Garment Print" },
      { id: "print_foil_flock", label: "Foil / Flock" },
    ],
  },
  // ── G. Garment / Cut & Sew ──
  {
    key: "garment",
    label: "Garment / Cut & Sew",
    icon: "👕",
    options: [
      { id: "garment_cmt", label: "Cut, Make & Trim (CMT)" },
      { id: "garment_full_package", label: "Full-Package (FOB / OEM)" },
      { id: "garment_odm_design", label: "ODM / Design" },
      { id: "garment_knitwear", label: "Knitwear Assembly" },
      { id: "garment_woven_tops", label: "Woven Tops / Shirts" },
      { id: "garment_bottoms_denim", label: "Bottoms / Denim" },
      { id: "garment_outerwear", label: "Outerwear / Jackets" },
      { id: "garment_activewear", label: "Activewear / Performance" },
      { id: "garment_intimates", label: "Intimates / Lingerie" },
      { id: "garment_seamless_bonding", label: "Seamless / Bonding" },
      { id: "garment_embroidery", label: "Embroidery" },
      { id: "garment_sampling", label: "Sampling / Prototyping" },
    ],
  },
  // ── H. Nonwovens ──
  {
    key: "nonwovens",
    label: "Nonwovens",
    icon: "🧻",
    options: [
      { id: "nonwoven_spunbond", label: "Spunbond" },
      { id: "nonwoven_meltblown", label: "Meltblown" },
      { id: "nonwoven_smms", label: "SMS / SMMS" },
      { id: "nonwoven_needle_punch", label: "Needle Punch" },
      { id: "nonwoven_spunlace", label: "Spunlace / Hydroentangled" },
      { id: "nonwoven_thermal_bond", label: "Thermal Bonded" },
      { id: "nonwoven_chemical_bond", label: "Chemical / Resin Bonded" },
      { id: "nonwoven_airlaid", label: "Airlaid" },
      { id: "nonwoven_wetlaid", label: "Wetlaid" },
      { id: "nonwoven_medical_ppe", label: "Medical / PPE" },
      { id: "nonwoven_wipes", label: "Wipes / Hygiene" },
      { id: "nonwoven_geotextile", label: "Geotextile / Industrial" },
    ],
  },
  // ── I. Fibers ──
  {
    key: "fibers",
    label: "Fibers",
    icon: "🪵",
    options: [
      { id: "fiber_cotton", label: "Cotton" },
      { id: "fiber_organic_cotton", label: "Organic Cotton" },
      { id: "fiber_polyester", label: "Polyester" },
      { id: "fiber_recycled_polyester", label: "Recycled Polyester (rPET)" },
      { id: "fiber_nylon", label: "Nylon / Polyamide" },
      { id: "fiber_elastane", label: "Elastane / Spandex" },
      { id: "fiber_wool", label: "Wool / Merino" },
      { id: "fiber_silk", label: "Silk" },
      { id: "fiber_linen_hemp", label: "Linen / Hemp" },
      { id: "fiber_viscose_rayon", label: "Viscose / Rayon" },
      { id: "fiber_modal_tencel", label: "Modal / Lyocell (Tencel)" },
      { id: "fiber_bamboo", label: "Bamboo" },
      { id: "fiber_acrylic", label: "Acrylic" },
      { id: "fiber_blends", label: "Blends" },
      { id: "fiber_biobased_recycled", label: "Bio-based / Recycled" },
    ],
  },
];

// Flat lookup: id → { label, groupKey, groupLabel } for rendering stored ids.
export const CAPABILITY_BY_ID: Record<
  string,
  { label: string; groupKey: string; groupLabel: string }
> = (() => {
  const map: Record<string, { label: string; groupKey: string; groupLabel: string }> = {};
  for (const g of CAPABILITY_GROUPS) {
    for (const o of g.options) {
      map[o.id] = { label: o.label, groupKey: g.key, groupLabel: g.label };
    }
  }
  return map;
})();

/** All valid capability ids (used to validate/sanitize incoming values). */
export const ALL_CAPABILITY_IDS: string[] = Object.keys(CAPABILITY_BY_ID);

/** Parse a JSON string[] capabilities field into a clean id array. */
export function parseCapabilities(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const arr = typeof val === "string" ? JSON.parse(val) : val;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Country select options for factory registration. Textile-manufacturing
// hubs first, then a broader set. Values are stored on Factory.country.
export const FACTORY_COUNTRIES: string[] = [
  "China", "Taiwan", "Hong Kong", "Vietnam", "Bangladesh", "India", "Pakistan",
  "Sri Lanka", "Indonesia", "Malaysia", "Thailand", "Cambodia", "Myanmar",
  "Korea", "Japan", "Turkey", "Italy", "Portugal", "Spain", "Germany",
  "United Kingdom", "Poland", "United States", "Mexico", "Canada", "Brazil",
  "Peru", "Colombia", "Egypt", "Morocco", "Tunisia", "Ethiopia",
  "United Arab Emirates", "Other",
];

/** Group a flat list of selected ids back into { group, options } for display. */
export function groupCapabilities(
  ids: string[],
): { key: string; label: string; icon: string; options: CapabilityOption[] }[] {
  const selected = new Set(ids);
  return CAPABILITY_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    icon: g.icon,
    options: g.options.filter((o) => selected.has(o.id)),
  })).filter((g) => g.options.length > 0);
}
