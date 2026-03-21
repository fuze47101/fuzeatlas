import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const factories = [
  {
    name: "Shenzhou Knitting Co., Ltd.",
    chineseName: "申洲针织有限公司",
    millType: "Vertical Knit Mill",
    specialty: "Performance knits, jersey, fleece",
    country: "China",
    city: "Ningbo",
    state: "Zhejiang",
    address: "88 Binhai Industrial Road, Beilun District",
    productTypes: JSON.stringify(["activewear", "knits", "outerwear"]),
    capabilities: JSON.stringify(["dyeing", "finishing", "knitting", "cut_sew", "coating"]),
    certifications: JSON.stringify(["oeko_tex_100", "bluesign", "higg", "iso_9001", "iso_14001"]),
    fabricTypes: JSON.stringify(["jersey", "interlock", "fleece", "mesh", "rib", "polyester", "nylon", "blends"]),
    moqMeters: 3000,
    leadTimeDays: 45,
    capacityMtMonth: 850,
    yearEstablished: 1997,
    employeeCount: 6200,
    fuzeEnabled: false,
    fuzeApplications: JSON.stringify([]),
    website: "https://www.shenzhouknitting.com",
    description: "One of the largest vertically integrated knit mills in Zhejiang province. Specializes in performance fabrics for global sportswear brands. Full dye house with reactive and disperse capabilities.",
    profileComplete: true,
  },
  {
    name: "Thai Textile Alliance Co., Ltd.",
    chineseName: null,
    millType: "Woven Mill",
    specialty: "Shirting, twill, technical wovens",
    country: "Thailand",
    city: "Samut Prakan",
    state: "Samut Prakan",
    address: "142/7 Moo 3, Bangplee Industrial Estate",
    productTypes: JSON.stringify(["wovens", "activewear", "outerwear", "medical"]),
    capabilities: JSON.stringify(["weaving", "dyeing", "finishing", "printing", "coating", "laminating"]),
    certifications: JSON.stringify(["oeko_tex_100", "grs", "iso_9001", "bsci", "sedex"]),
    fabricTypes: JSON.stringify(["twill", "poplin", "satin", "nylon", "polyester", "cotton", "blends", "recycled"]),
    moqMeters: 2000,
    leadTimeDays: 35,
    capacityMtMonth: 420,
    yearEstablished: 2004,
    employeeCount: 1800,
    fuzeEnabled: false,
    fuzeApplications: JSON.stringify([]),
    website: "https://www.thaitextilealliance.co.th",
    description: "Premium woven mill serving international outdoor and workwear brands. Strong in technical finishes including water repellent, wrinkle-free, and antimicrobial applications. GRS certified for recycled content.",
    profileComplete: true,
  },
  {
    name: "Vina Pacific Textiles JSC",
    chineseName: null,
    millType: "Circular Knit Mill",
    specialty: "Cotton blends, pique, terry",
    country: "Vietnam",
    city: "Ho Chi Minh City",
    state: "Binh Duong",
    address: "99 DT743 Street, VSIP II Industrial Park, Thu Dau Mot",
    productTypes: JSON.stringify(["activewear", "knits", "intimates", "socks"]),
    capabilities: JSON.stringify(["knitting", "dyeing", "finishing", "printing", "digital_printing", "cut_sew"]),
    certifications: JSON.stringify(["oeko_tex_100", "gots", "grs", "wrap", "iso_9001"]),
    fabricTypes: JSON.stringify(["jersey", "pique", "terry", "rib", "cotton", "polyester", "blends", "recycled"]),
    moqMeters: 1500,
    leadTimeDays: 30,
    capacityMtMonth: 310,
    yearEstablished: 2010,
    employeeCount: 2400,
    fuzeEnabled: false,
    fuzeApplications: JSON.stringify([]),
    website: "https://www.vinapacifictex.vn",
    description: "Fast-growing circular knit specialist in VSIP II park. GOTS and GRS certified with strong sustainability focus. Expertise in cotton-rich performance blends for athleisure and basics.",
    profileComplete: true,
  },
  {
    name: "Pratibha Syntex Ltd.",
    chineseName: null,
    millType: "Vertical Integrated Mill",
    specialty: "Organic cotton, sustainable knits",
    country: "India",
    city: "Indore",
    state: "Madhya Pradesh",
    address: "Plot No. 5-6, Sector C, Sanwer Road Industrial Area",
    productTypes: JSON.stringify(["activewear", "knits", "intimates", "home_textiles"]),
    capabilities: JSON.stringify(["knitting", "dyeing", "finishing", "cut_sew", "embroidery"]),
    certifications: JSON.stringify(["oeko_tex_100", "gots", "grs", "iso_9001", "iso_14001", "sedex", "higg"]),
    fabricTypes: JSON.stringify(["jersey", "interlock", "fleece", "rib", "cotton", "blends", "recycled"]),
    moqMeters: 2500,
    leadTimeDays: 40,
    capacityMtMonth: 540,
    yearEstablished: 1997,
    employeeCount: 4100,
    fuzeEnabled: false,
    fuzeApplications: JSON.stringify([]),
    website: "https://www.pratibhasyntex.com",
    description: "Vertically integrated from ginning to finished garment. One of India's leading organic cotton processors with Fairtrade certification. Strong expertise in sustainable knits for European and North American markets.",
    profileComplete: true,
  },
];

async function seed() {
  for (const f of factories) {
    const created = await prisma.factory.create({ data: f });
    console.log("✅ Created:", created.name, "—", created.id);
  }
  console.log("\nDone! 4 factories seeded.");
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
