// ─────────────────────────────────────────────────
// Factory Discovery — Structured Tags & Search
// ─────────────────────────────────────────────────

export type TagCategory = {
  key: string;
  label: string;
  icon: string;
  tags: { value: string; label: string }[];
};

export const PRODUCT_TYPES: TagCategory = {
  key: "productTypes",
  label: "Product Types",
  icon: "👕",
  tags: [
    { value: "activewear", label: "Activewear / Performance" },
    { value: "denim", label: "Denim" },
    { value: "intimates", label: "Intimates / Lingerie" },
    { value: "socks", label: "Socks / Hosiery" },
    { value: "wovens", label: "Wovens / Dress Shirts" },
    { value: "knits", label: "Knits / T-shirts" },
    { value: "outerwear", label: "Outerwear / Jackets" },
    { value: "home_textiles", label: "Home Textiles / Bedding" },
    { value: "non_woven", label: "Non-Woven" },
    { value: "medical", label: "Medical / PPE" },
    { value: "industrial", label: "Industrial Textiles" },
    { value: "swimwear", label: "Swimwear" },
    { value: "uniforms", label: "Uniforms / Workwear" },
    { value: "athleisure", label: "Athleisure" },
    { value: "circular_knit", label: "Circular Knit" },
  ],
};

export const CAPABILITIES: TagCategory = {
  key: "capabilities",
  label: "Capabilities",
  icon: "⚙️",
  tags: [
    { value: "dyeing", label: "Dyeing" },
    { value: "finishing", label: "Finishing" },
    { value: "printing", label: "Printing" },
    { value: "knitting", label: "Knitting" },
    { value: "weaving", label: "Weaving" },
    { value: "cut_sew", label: "Cut & Sew (CMT)" },
    { value: "coating", label: "Coating / Laminating" },
    { value: "embroidery", label: "Embroidery" },
    { value: "digital_printing", label: "Digital Printing" },
    { value: "screen_printing", label: "Screen Printing" },
    { value: "yarn_spinning", label: "Yarn Spinning" },
    { value: "converting", label: "Converting" },
    { value: "testing_lab", label: "In-house Testing" },
    { value: "sampling", label: "Sampling / Prototyping" },
    { value: "garment_wash", label: "Garment Wash" },
  ],
};

export const CERTIFICATIONS: TagCategory = {
  key: "certifications",
  label: "Certifications",
  icon: "✅",
  tags: [
    { value: "oeko_tex_100", label: "OEKO-TEX 100" },
    { value: "oeko_tex_step", label: "OEKO-TEX STeP" },
    { value: "bluesign", label: "bluesign" },
    { value: "gots", label: "GOTS (Organic)" },
    { value: "grs", label: "GRS (Recycled)" },
    { value: "iso_9001", label: "ISO 9001" },
    { value: "iso_14001", label: "ISO 14001" },
    { value: "wrap", label: "WRAP" },
    { value: "bsci", label: "BSCI / amfori" },
    { value: "sedex", label: "Sedex / SMETA" },
    { value: "higg", label: "Higg FEM / SAC" },
    { value: "sa8000", label: "SA8000" },
    { value: "zdhc", label: "ZDHC MRSL" },
    { value: "reach", label: "EU REACH" },
  ],
};

export const FABRIC_TYPES: TagCategory = {
  key: "fabricTypes",
  label: "Fabric Types",
  icon: "🧵",
  tags: [
    { value: "jersey", label: "Jersey" },
    { value: "interlock", label: "Interlock" },
    { value: "pique", label: "Piqué" },
    { value: "fleece", label: "Fleece" },
    { value: "terry", label: "Terry / French Terry" },
    { value: "mesh", label: "Mesh" },
    { value: "rib", label: "Rib" },
    { value: "twill", label: "Twill" },
    { value: "poplin", label: "Poplin" },
    { value: "satin", label: "Satin" },
    { value: "denim_fabric", label: "Denim" },
    { value: "nylon", label: "Nylon" },
    { value: "polyester", label: "Polyester" },
    { value: "cotton", label: "Cotton" },
    { value: "blends", label: "Blends" },
    { value: "recycled", label: "Recycled Fibers" },
    { value: "spandex", label: "Spandex / Elastane" },
    { value: "modal", label: "Modal / Tencel" },
    { value: "bamboo", label: "Bamboo" },
    { value: "wool", label: "Wool / Merino" },
  ],
};

export const FUZE_APPLICATIONS: TagCategory = {
  key: "fuzeApplications",
  label: "FUZE Application Methods",
  icon: "🔬",
  tags: [
    { value: "bath_exhaust", label: "Bath / Exhaust" },
    { value: "spray_finish", label: "Spray on Finished Fabric" },
    { value: "spray_garment", label: "Spray on Finished Garments" },
    { value: "jeanologia", label: "Jeanologia Digital Spray" },
    { value: "wash_cycle", label: "Wash Cycle (Socks/Circular)" },
    { value: "yarn_dye", label: "Yarn Dye Application" },
    { value: "padding", label: "Padding / Foulard" },
  ],
};

export const ALL_TAG_CATEGORIES: TagCategory[] = [
  PRODUCT_TYPES,
  CAPABILITIES,
  CERTIFICATIONS,
  FABRIC_TYPES,
  FUZE_APPLICATIONS,
];

// ── Helper: Parse JSON string field to string array ──
export function parseTags(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ── Helper: Get display label for a tag value ──
export function getTagLabel(categoryKey: string, tagValue: string): string {
  const cat = ALL_TAG_CATEGORIES.find((c) => c.key === categoryKey);
  if (!cat) return tagValue;
  const tag = cat.tags.find((t) => t.value === tagValue);
  return tag ? tag.label : tagValue;
}

// ── Search Filter Types ──
export type FactorySearchFilters = {
  query?: string;
  country?: string;
  millType?: string;
  productTypes?: string[];
  capabilities?: string[];
  certifications?: string[];
  fabricTypes?: string[];
  fuzeEnabled?: boolean;
  fuzeApplications?: string[];
  moqMax?: number;
  leadTimeMax?: number;
};

// ── Client-side filter function ──
export function filterFactories(
  factories: any[],
  filters: FactorySearchFilters,
): any[] {
  return factories.filter((f) => {
    // Text search
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const searchable = [
        f.name,
        f.chineseName,
        f.millType,
        f.specialty,
        f.country,
        f.city,
        f.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    // Country
    if (filters.country && f.country !== filters.country) return false;

    // Mill type
    if (filters.millType && f.millType !== filters.millType) return false;

    // Tag-based filters (any match = include)
    const tagFilters: [string[], string | null | undefined][] = [
      [filters.productTypes || [], f.productTypes],
      [filters.capabilities || [], f.capabilities],
      [filters.certifications || [], f.certifications],
      [filters.fabricTypes || [], f.fabricTypes],
      [filters.fuzeApplications || [], f.fuzeApplications],
    ];

    for (const [wanted, stored] of tagFilters) {
      if (wanted.length > 0) {
        const tags = parseTags(stored as string);
        // Must match ALL selected tags
        if (!wanted.every((w) => tags.includes(w))) return false;
      }
    }

    // FUZE enabled
    if (filters.fuzeEnabled !== undefined && f.fuzeEnabled !== filters.fuzeEnabled) return false;

    // MOQ
    if (filters.moqMax && f.moqMeters && f.moqMeters > filters.moqMax) return false;

    // Lead time
    if (filters.leadTimeMax && f.leadTimeDays && f.leadTimeDays > filters.leadTimeMax) return false;

    return true;
  });
}

// ── Calculate profile completeness ──
export function calcProfileCompleteness(factory: any): number {
  let filled = 0;
  let total = 10;

  if (factory.millType) filled++;
  if (factory.country) filled++;
  if (factory.description) filled++;
  if (parseTags(factory.productTypes).length > 0) filled++;
  if (parseTags(factory.capabilities).length > 0) filled++;
  if (parseTags(factory.certifications).length > 0) filled++;
  if (parseTags(factory.fabricTypes).length > 0) filled++;
  if (factory.moqMeters) filled++;
  if (factory.leadTimeDays) filled++;
  if (factory.fuzeEnabled !== null && factory.fuzeEnabled !== undefined) filled++;

  return Math.round((filled / total) * 100);
}
