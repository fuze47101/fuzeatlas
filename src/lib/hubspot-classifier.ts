// @ts-nocheck
/**
 * HubSpot CSV migration classifier.
 *
 * Splits HubSpot Companies into three buckets so we don't drag every
 * medical / pharma / hospital / financial-services row into Atlas:
 *
 *   KEEP    — textile / apparel / sporting goods / surface disinfectant
 *             customers. Import direct, no manual review.
 *   REVIEW  — borderline industries (chemicals, retail, consumer goods)
 *             OR rows with no industry tag at all. Import with
 *             validationStatus="pending_review" so they show up in a
 *             review queue but aren't surfaced in BD wizard until a
 *             human signs off.
 *   EXCLUDE — medical, pharma, hospital, biotech, finance, software,
 *             higher-ed, etc. Do NOT import. We log them so the
 *             /admin/hubspot-import audit shows what got dropped.
 *
 * Strategy:
 *   1. Industry tag is the primary signal — HubSpot has a ~140-value
 *      industry picklist. Most rows have one and it's reasonably
 *      reliable.
 *   2. Name-pattern matching is the fallback when industry is empty
 *      (1,578 rows in this export). It catches the obvious medical /
 *      pharma / biotech outfits and lets Champion Athleticwear through.
 *   3. Business Type column adds "Brand" / "Manufacturer" / "Hospital"
 *      etc. signal — used as a tiebreaker.
 *
 * If you change a list here, also update the corresponding admin UI
 * audit panel so the review counts match what the importer does.
 */

export type ClassificationBucket = "KEEP" | "REVIEW" | "EXCLUDE";

export type ClassificationReason =
  | "keep_textile"
  | "keep_surface_disinfectant"
  | "keep_business_type_brand"
  | "review_borderline_industry"
  | "review_no_industry"
  | "review_unknown_industry"
  | "exclude_industry_medical"
  | "exclude_industry_finance"
  | "exclude_industry_software"
  | "exclude_industry_education"
  | "exclude_industry_other"
  | "exclude_name_medical"
  | "exclude_name_pharma"
  | "exclude_name_finance";

export type ClassificationResult = {
  bucket: ClassificationBucket;
  reason: ClassificationReason;
  matchedTerm?: string;
};

/**
 * KEEP industries — textile + adjacent.
 * Anything in this set imports directly.
 */
const KEEP_TEXTILE_INDUSTRIES = new Set<string>(
  [
    "Apparel & Fashion",
    "Apparel and Fashion",
    "Textiles",
    "Sporting Goods",
    "Cosmetics", // makeup brushes, applicators — niche but valid
    "Furniture",
    "Wholesale",
    "Wholesale Trade",
    "Manufacturing",
    "Industrial Manufacturing",
    "Outdoor Recreation",
    "Outdoor",
    "Performance Apparel",
    "Activewear",
    "Footwear",
    "Leisure, Travel & Tourism",
    "Wine and Spirits", // hospitality napkins/linens
    "Plastics", // some yarn/fiber producers
    "Mechanical or Industrial Engineering", // industrial weaving / coating
  ].map((s) => s.toLowerCase()),
);

/**
 * KEEP — surface disinfectant prospects.
 * Hospitality, restaurants, food & beverage, fitness, etc.
 * These are surface-finish customers, not textile.
 */
const KEEP_SURFACE_INDUSTRIES = new Set<string>(
  [
    "Restaurants",
    "Food & Beverages",
    "Food Production",
    "Health, Wellness and Fitness",
    "Hospitality",
    "Hotels and Motels",
    "Hotels & Motels",
    "Hotels",
    "Recreational Facilities and Services",
    "Sports",
    "Fitness",
    "Gym",
    "Cleaning Services",
  ].map((s) => s.toLowerCase()),
);

/**
 * EXCLUDE — definitely-not-our-customer industries.
 * Medical / pharma / biotech / finance / software / higher-ed / etc.
 */
const EXCLUDE_INDUSTRIES = new Set<string>(
  [
    // Medical / pharma — top exclusion category
    "Medical Devices",
    "Medical Device",
    "Medical Practice",
    "Medical Equipment & Supplies",
    "Medical Equipment Manufacturing",
    "Medical Imaging",
    "Pharmaceuticals",
    "Pharmaceutical Manufacturing",
    "Hospital & Health Care",
    "Hospital and Health Care",
    "Health Care",
    "Healthcare",
    "Biotechnology",
    "Biotechnology Research",
    "Veterinary",
    "Mental Health Care",
    "Nanotechnology",
    "Research",
    "Pharmaceutical & Bio-Tech",
    "Pharmaceutical and Bio-Tech",
    "Dentistry",
    "Alternative Medicine",
    // Finance / insurance — not a customer
    "Banking",
    "Capital Markets",
    "Investment Banking",
    "Investment Management",
    "Venture Capital & Private Equity",
    "Venture Capital and Private Equity",
    "Insurance",
    "Financial Services",
    "Real Estate",
    "Commercial Real Estate",
    "Accounting",
    // Software / IT / telecom — not a customer for textile finishing
    "Computer Software",
    "Computer Hardware",
    "Information Technology and Services",
    "Information Technology & Services",
    "Internet",
    "Computer Networking",
    "Computer & Network Security",
    "Computer Network Security",
    "Computer Games",
    "Telecommunications",
    "Wireless",
    "Semiconductors",
    "Information Services",
    "Online Media",
    "Computer Hardware Manufacturing",
    "Software Development",
    // Higher ed / non-profit / govt
    "Higher Education",
    "Education Management",
    "Education",
    "Primary/Secondary Education",
    "E-Learning",
    "Non-profit Organization Management",
    "Non-Profit Organization Management",
    "Non-profit",
    "Nonprofit",
    "Government Administration",
    "Public Policy",
    "Public Safety",
    "Public Relations and Communications",
    "Religious Institutions",
    "Think Tanks",
    "Defense & Space",
    "Military",
    "International Affairs",
    "Government Relations",
    "Civic & Social Organization",
    "Legal Services",
    "Law Practice",
    "Judiciary",
    // Energy / mining / utilities — not relevant
    "Oil & Energy",
    "Oil and Energy",
    "Mining & Metals",
    "Mining and Metals",
    "Utilities",
    "Renewables & Environment",
    "Renewables and Environment",
    "Environmental Services",
    "Power Generation",
    // Media / entertainment / professional services
    "Marketing and Advertising",
    "Marketing & Advertising",
    "Media Production",
    "Newspapers",
    "Broadcast Media",
    "Entertainment",
    "Music",
    "Motion Pictures and Film",
    "Performing Arts",
    "Photography",
    "Publishing",
    "Writing and Editing",
    "Translation and Localization",
    "Design",
    "Graphic Design",
    "Architecture & Planning",
    "Civil Engineering",
    "Management Consulting",
    "Staffing and Recruiting",
    "Human Resources",
    "Professional Training & Coaching",
    "Professional Training and Coaching",
    "Research Services",
    "Outsourcing/Offshoring",
    "Outsourcing/Off-shoring",
    // Travel / transport
    "Airlines/Aviation",
    "Aviation & Aerospace",
    "Maritime",
    "Logistics & Supply Chain",
    "Logistics and Supply Chain",
    "Transportation/Trucking/Railroad",
    "Package/Freight Delivery",
    "Warehousing",
    // Misc
    "Automotive",
    "Construction",
    "Building Materials",
    "Glass, Ceramics & Concrete",
    "Glass, Ceramics and Concrete",
    "Farming",
    "Dairy",
    "Fishery",
    "Ranching",
    "Apiary",
    "Tobacco",
    "Wholesale Building Materials",
    "Wholesale Electronic Markets and Agents and Brokers",
    "Logistics, Supply Chain and Storage",
    "Animation",
    "Gambling & Casinos",
    "Events Services",
    "Library",
    "Museums and Institutions",
    "Computer & Network Security",
  ].map((s) => s.toLowerCase()),
);

/**
 * REVIEW — borderline industries that need a human eye.
 * "Chemicals" includes both textile-finishing chemicals AND industrial
 * solvents — can't auto-decide. Same for "Retail" (could be apparel
 * retail or auto parts).
 */
const REVIEW_INDUSTRIES = new Set<string>(
  [
    "Chemicals",
    "Retail",
    "Consumer Goods",
    "Consumer Services",
    "Luxury Goods & Jewelry",
    "Luxury Goods and Jewelry",
    "Paper & Forest Products",
    "Paper and Forest Products",
    "Packaging and Containers",
    "Packaging & Containers",
    "Wholesale", // overlaps with KEEP — kept here so unclear wholesalers are reviewed
    "Mechanical or Industrial Engineering", // overlaps — review borderline
  ].map((s) => s.toLowerCase()),
);

/**
 * Name-pattern matching for the ~28% of rows with no industry tag.
 * Order matters — first match wins. EXCLUDE patterns run before
 * KEEP patterns because medical company names are noisier than
 * textile names.
 */
const EXCLUDE_NAME_PATTERNS: Array<{
  bucket: "EXCLUDE";
  reason: ClassificationReason;
  pattern: RegExp;
}> = [
  {
    bucket: "EXCLUDE",
    reason: "exclude_name_medical",
    pattern:
      /\b(medical|hospital|clinic|surgery|surgical|orthopedic|orthopaedic|dental|dentistry|veterinary|veterinarian|psychiatric|psychiatry|cardiology|oncology|radiology|urology|neurology|dermatology|ophthalmology|gastroenterology|pediatric|pediatrics|geriatric|geriatrics|nursing|hospice|infusion|imaging center|wound care|prosthetic|implant|stent|catheter|biomed|biomedical|medtech|med-tech|medi-?spa)\b/i,
  },
  {
    bucket: "EXCLUDE",
    reason: "exclude_name_pharma",
    pattern:
      /\b(pharma|pharmaceutic|biopharm|biotech|life sciences|laboratories|laboratory|diagnostic|therapeutic|therapeutics|genomics|genetics|vaccine|antibody|antibodies|immunology|immunolog|cell therapy|gene therapy|drug discovery|cro\b|contract research|clinical research|clinical trial)\b/i,
  },
  {
    bucket: "EXCLUDE",
    reason: "exclude_name_finance",
    pattern:
      /\b(capital partners|capital management|asset management|wealth management|hedge fund|venture capital|private equity|investments?|securities|bancorp|bank corp|insurance|reinsurance|underwriters|brokerage)\b/i,
  },
];

/**
 * Hostnames (from email domain or company website) that are obviously
 * not textile — gmail, yahoo, etc., or common email-only HubSpot ghost
 * rows. These should probably be REVIEW (no clear company), not
 * EXCLUDE.
 */
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "comcast.net",
  "att.net",
  "verizon.net",
]);

export function isPersonalEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase().trim());
}

function normaliseIndustry(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

/**
 * Main entry point — classify a single HubSpot company row.
 */
export function classifyCompany(input: {
  name: string | null;
  industry: string | null;
  businessType?: string | null;
  description?: string | null;
}): ClassificationResult {
  const ind = normaliseIndustry(input.industry);
  const name = (input.name || "").trim();

  // 1. Industry tag is primary signal
  if (ind) {
    if (KEEP_TEXTILE_INDUSTRIES.has(ind)) {
      return { bucket: "KEEP", reason: "keep_textile", matchedTerm: ind };
    }
    if (KEEP_SURFACE_INDUSTRIES.has(ind)) {
      return {
        bucket: "KEEP",
        reason: "keep_surface_disinfectant",
        matchedTerm: ind,
      };
    }
    if (EXCLUDE_INDUSTRIES.has(ind)) {
      // Bucket the exclusion into a sub-reason for the audit log
      let r: ClassificationReason = "exclude_industry_other";
      if (
        /medical|hospital|health|pharm|biotech|veterinary|nano|dent|alternative medicine/i.test(
          ind,
        )
      ) {
        r = "exclude_industry_medical";
      } else if (
        /bank|capital|insurance|invest|financial|real estate|account/i.test(ind)
      ) {
        r = "exclude_industry_finance";
      } else if (
        /software|computer|internet|telecom|wireless|semiconductor|information/i.test(
          ind,
        )
      ) {
        r = "exclude_industry_software";
      } else if (/education|learning|library|museum|nonprofit|non-profit/i.test(ind)) {
        r = "exclude_industry_education";
      }
      return { bucket: "EXCLUDE", reason: r, matchedTerm: ind };
    }
    if (REVIEW_INDUSTRIES.has(ind)) {
      return {
        bucket: "REVIEW",
        reason: "review_borderline_industry",
        matchedTerm: ind,
      };
    }
    // Unknown industry that didn't match any list — REVIEW so a human eyeballs it
    return { bucket: "REVIEW", reason: "review_unknown_industry", matchedTerm: ind };
  }

  // 2. No industry tag — fall back to name-pattern matching
  if (name) {
    for (const p of EXCLUDE_NAME_PATTERNS) {
      const m = name.match(p.pattern);
      if (m) {
        return {
          bucket: p.bucket,
          reason: p.reason,
          matchedTerm: m[0],
        };
      }
    }
  }

  // 3. Business Type tiebreaker — "Brand" / "Manufacturer" → KEEP-ish
  const bt = (input.businessType || "").trim().toLowerCase();
  if (bt === "brand" || bt === "manufacturer") {
    return {
      bucket: "KEEP",
      reason: "keep_business_type_brand",
      matchedTerm: bt,
    };
  }

  // 4. Default — no industry, no name match, no business type → REVIEW
  return { bucket: "REVIEW", reason: "review_no_industry" };
}

/**
 * Convenience — classify a HubSpot CSV row by column header lookup.
 * Assumes you've already mapped the row into a key→value object.
 */
export function classifyHubSpotCompanyRow(row: Record<string, string>): ClassificationResult {
  return classifyCompany({
    name: row["Company name"] || row["Company Name"] || null,
    industry: row["Industry"] || null,
    businessType: row["Business Type"] || null,
    description: row["Description"] || row["About Us"] || null,
  });
}

/**
 * Pretty-print bucket counts for the admin UI.
 */
export function summariseClassifications(
  results: ClassificationResult[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of results) {
    out[r.reason] = (out[r.reason] || 0) + 1;
    out[r.bucket] = (out[r.bucket] || 0) + 1;
  }
  return out;
}
