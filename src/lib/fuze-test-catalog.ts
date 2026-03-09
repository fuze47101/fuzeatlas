export interface FuzeTestService {
  id: string;
  name: string;
  description: string;
  category: "recipe_build" | "performance" | "quality" | "certification";
  moqMeters: number; // minimum sample required
  controlRequired: boolean; // needs matching untreated control fabric
  controlNote?: string;
  turnaroundDays: number;
  estimatedCostUsd?: number;
  methods?: string[]; // test methods included
}

export const FUZE_TEST_CATALOG: FuzeTestService[] = [
  {
    id: "recipe-build",
    name: "FUZE Recipe Build",
    description:
      "Full format build including wet-to-wet and dry-to-wet application levels across multiple FUZE tiers (F1-F4). Determines optimal treatment recipe for the fabric.",
    category: "recipe_build",
    moqMeters: 1,
    controlRequired: true,
    controlNote:
      "CRITICAL: If the sample has ANY prior FUZE treatment (exhaust, spray, or other method), you MUST supply an equal yardage of UNTREATED control fabric from the same lot/batch. Without a matching control, results cannot be validated.",
    turnaroundDays: 10,
    methods: [
      "Pad application",
      "Exhaust application",
      "Spray application",
      "Multi-tier evaluation (F1-F4)",
    ],
  },
  {
    id: "antibacterial-screen",
    name: "Antibacterial Screening",
    description:
      "Quick antibacterial efficacy screening using AATCC 100 or ASTM E2149 to verify antimicrobial activity.",
    category: "performance",
    moqMeters: 0.5,
    controlRequired: true,
    controlNote: "Supply matching untreated control fabric.",
    turnaroundDays: 7,
    methods: ["AATCC 100", "ASTM E2149"],
  },
  {
    id: "icp-analysis",
    name: "ICP Metal Content Analysis",
    description:
      "Inductively Coupled Plasma analysis to measure allotrope metal content (Ag/Au) in treated fabric.",
    category: "quality",
    moqMeters: 0.25,
    controlRequired: false,
    turnaroundDays: 5,
    methods: ["ICP-OES", "ICP-MS"],
  },
  {
    id: "wash-durability",
    name: "Wash Durability Testing",
    description:
      "Test antimicrobial efficacy retention after multiple wash cycles (10, 25, 50 washes). Validates treatment permanence.",
    category: "performance",
    moqMeters: 2,
    controlRequired: true,
    controlNote: "Supply matching untreated control fabric.",
    turnaroundDays: 14,
    methods: ["AATCC 100 post-wash", "ICP post-wash"],
  },
  {
    id: "full-certification",
    name: "Full Certification Package",
    description:
      "Complete test suite for brand compliance: ICP, Antibacterial (AATCC 100 + ASTM E2149), Fungal, and wash durability. Generates Certificate of Compliance.",
    category: "certification",
    moqMeters: 3,
    controlRequired: true,
    controlNote: "Supply matching untreated control fabric of equal yardage.",
    turnaroundDays: 21,
    estimatedCostUsd: 2500,
    methods: [
      "ICP-OES",
      "AATCC 100",
      "ASTM E2149",
      "ASTM G21 (Fungal)",
      "Wash durability (50 cycles)",
    ],
  },
  {
    id: "fungal-test",
    name: "Antifungal Testing",
    description:
      "ASTM G21 or AATCC 30 antifungal efficacy testing against common mold and mildew organisms.",
    category: "performance",
    moqMeters: 0.5,
    controlRequired: true,
    controlNote: "Supply matching untreated control fabric.",
    turnaroundDays: 14,
    methods: ["ASTM G21", "AATCC 30"],
  },
  {
    id: "odor-test",
    name: "Odor Resistance Testing",
    description:
      "Evaluates fabric's resistance to odor-causing bacteria after treatment.",
    category: "performance",
    moqMeters: 0.5,
    controlRequired: true,
    controlNote: "Supply matching untreated control fabric.",
    turnaroundDays: 10,
    methods: ["Modified AATCC 100 (odor panel)"],
  },
];

// Shipping addresses for sample submission
export interface ShippingAddress {
  label: string;
  region: "international" | "domestic";
  company: string;
  attention: string;
  address1: string;
  address2?: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export const FUZE_SHIPPING_ADDRESSES: ShippingAddress[] = [
  {
    label: "FUZE Testing Services — Salt Lake City (Primary)",
    region: "domestic",
    company: "FUZE Testing Services",
    attention: "Lab Sample Receiving",
    address1: "1895 West 2100 South",
    city: "Salt Lake City",
    stateProvince: "Utah",
    postalCode: "84119",
    country: "United States",
    email: "lab@fuze47.com",
    notes:
      "Primary sample receiving address for all domestic and international shipments. Mark international packages: 'TEXTILE SAMPLES — NO COMMERCIAL VALUE — FOR TESTING PURPOSES ONLY'",
  },
];

// Shipping instructions
export const SHIPPING_INSTRUCTIONS = [
  "Label each fabric sample clearly with: Brand Name, Fabric Name/Style, Customer Code, and Lot Number",
  "Include a printed copy of the Fabric Intake Form with each shipment",
  "If the fabric has been pre-treated with FUZE or any antimicrobial, you MUST include matching untreated control fabric of equal yardage from the same production lot",
  "Mark all international packages as: 'TEXTILE SAMPLES — NO COMMERCIAL VALUE — FOR TESTING PURPOSES ONLY'",
  "Include HS Code 5911.90 (textile articles for technical use) on customs declaration",
  "Use DHL, FedEx, or UPS for international shipments. Include tracking number in your FUZE Atlas submission",
  "Minimum sample size varies by test type — refer to the test catalog for specific requirements",
  "All samples must be from the same production batch/lot to ensure consistent test results",
  "Do NOT fold samples along the center — roll or fold in accordion style to prevent permanent crease marks in the test area",
];
