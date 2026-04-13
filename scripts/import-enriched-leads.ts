/**
 * import-enriched-leads.ts
 *
 * Run from fuzeatlas root:
 *   npx tsx scripts/import-enriched-leads.ts
 *
 * Imports Apollo-enriched leads into Atlas as Brand + Contact records.
 * Generated 2026-04-13 from Apollo prospecting session.
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface EnrichedLead {
  brand: {
    name: string;
    website: string;
    segment: string;
    employees: string;
    revenue: string;
    hq: string;
    currentAntimicrobial: string;
    fuzeRelevance: string;
    priorityTier: string;
    sustainabilityScore: string;
  };
  contacts: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    email: string;
    personalEmail: string;
    linkedinUrl: string;
    seniority: string;
    emailStatus: string;
    location: string;
    apolloId?: string;
    notes: string;
  }[];
}

const leads: EnrichedLead[] = [
  {
    brand: {
      name: "Cotton Incorporated",
      website: "https://cottoninc.com",
      segment: "Textiles Research",
      employees: "150",
      revenue: "$23.4M",
      hq: "Cary, NC",
      currentAntimicrobial: "N/A — research org",
      fuzeRelevance: "Industry research org — could validate/endorse FUZE for cotton textiles. CSO is academic with Duke/NC State ties.",
      priorityTier: "A",
      sustainabilityScore: "HIGH",
    },
    contacts: [{
      firstName: "Jesse",
      lastName: "Daystar",
      jobTitle: "Chief Sustainability Officer & VP Sustainability",
      email: "jdaystar@cottoninc.com",
      personalEmail: "",
      linkedinUrl: "http://www.linkedin.com/in/jdaystar",
      seniority: "c_suite",
      emailStatus: "verified",
      location: "Raleigh, NC",
      apolloId: "56377ceaa6da9864e1002132",
      notes: "Also teaches at Duke & NC State. Founder of Triangle Life Cycle Assessment. Since 2017.",
    }],
  },
  {
    brand: {
      name: "Columbia Sportswear",
      website: "https://columbia.com",
      segment: "Outdoor & Performance",
      employees: "9,800",
      revenue: "$3.5B+",
      hq: "Portland, OR",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Major outdoor brand — VP Sustainability + Director Sustainability both enriched with verified emails and LinkedIn.",
      priorityTier: "A",
      sustainabilityScore: "HIGH",
    },
    contacts: [
      {
        firstName: "Abel",
        lastName: "Navarrete",
        jobTitle: "Vice President, Sustainability, Product Safety and Community Impact",
        email: "anavarrete@columbia.com",
        personalEmail: "",
        linkedinUrl: "http://www.linkedin.com/in/abel-navarrete-7908263",
        seniority: "vp",
        emailStatus: "verified",
        location: "Portland, OR",
        apolloId: "60543be0c4ea1e0001c3e978",
        notes: "",
      },
      {
        firstName: "Guru",
        lastName: "Larson",
        jobTitle: "Director of Sustainability",
        email: "glarson@columbia.com",
        personalEmail: "",
        linkedinUrl: "http://www.linkedin.com/in/guruslarson",
        seniority: "director",
        emailStatus: "verified",
        location: "Portland, OR",
        apolloId: "5bcf14bca3ae61878856c0b6",
        notes: "Two-prong approach with Abel Navarrete",
      },
    ],
  },
  {
    brand: {
      name: "The LYCRA Company",
      website: "https://lycra.com",
      segment: "Textiles / Fiber",
      employees: "2,500",
      revenue: "",
      hq: "Wilmington, DE",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "LYCRA fiber touches every major apparel brand — a partnership here multiplies reach across the entire industry.",
      priorityTier: "A",
      sustainabilityScore: "MEDIUM",
    },
    contacts: [{
      firstName: "Jean",
      lastName: "Hegedus",
      jobTitle: "Director of Sustainability",
      email: "jean.t.hegedus@lycra.com",
      personalEmail: "jeanhegedus@aol.com",
      linkedinUrl: "http://www.linkedin.com/in/jean-hegedus-569b513a",
      seniority: "director",
      emailStatus: "verified",
      location: "New York, NY",
      apolloId: "5f0abe7d062d4500013d45bd",
      notes: "",
    }],
  },
  {
    brand: {
      name: "United Legwear & Apparel Co.",
      website: "https://unitedlegwear.com",
      segment: "Apparel & Legwear",
      employees: "",
      revenue: "",
      hq: "New York, NY",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Multi-brand legwear/apparel company — Director of Sustainability enriched with LinkedIn and verified email.",
      priorityTier: "B",
      sustainabilityScore: "MEDIUM",
    },
    contacts: [{
      firstName: "Angerra",
      lastName: "King-Hardy",
      jobTitle: "Director of Sustainability",
      email: "angerra@unitedlegwear.com",
      personalEmail: "",
      linkedinUrl: "http://www.linkedin.com/in/angerra-king-hardy-12a86052",
      seniority: "director",
      emailStatus: "verified",
      location: "United States",
      apolloId: "5f925ccbc22dba000126541b",
      notes: "",
    }],
  },
  {
    brand: {
      name: "Gap Inc.",
      website: "https://gap.com",
      segment: "Retail / Apparel",
      employees: "85,000",
      revenue: "$15B+",
      hq: "San Francisco, CA",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Parent of Athleta, Old Navy, Banana Republic. VP Global Sustainability + Director Product Sustainability both enriched.",
      priorityTier: "A",
      sustainabilityScore: "HIGH",
    },
    contacts: [
      {
        firstName: "Daniel",
        lastName: "Fibiger",
        jobTitle: "Vice President, Global Sustainability",
        email: "daniel_fibiger@gap.com",
        personalEmail: "daniel.fibiger@gmail.com",
        linkedinUrl: "",
        seniority: "vp",
        emailStatus: "verified",
        location: "San Francisco, CA",
        apolloId: "60dc1ad8cc707a0001870978",
        notes: "Covers Athleta, Old Navy, Banana Republic — massive volume potential",
      },
      {
        firstName: "Avery",
        lastName: "Lindeman",
        jobTitle: "Director, Product Sustainability",
        email: "avery_lindeman@gap.com",
        personalEmail: "",
        linkedinUrl: "",
        seniority: "director",
        emailStatus: "verified",
        location: "San Francisco, CA",
        apolloId: "54a223277468692e71852b10",
        notes: "Product sustainability focus — direct material decisions",
      },
    ],
  },
  {
    brand: {
      name: "Fabletics",
      website: "https://fabletics.com",
      segment: "Activewear & Athleisure",
      employees: "1,600",
      revenue: "$850M",
      hq: "El Segundo, CA",
      currentAntimicrobial: "Uses antimicrobial (partner unknown)",
      fuzeRelevance: "Largest digitally native activewear brand. Recently launched scrubs (medical textiles = huge antimicrobial opportunity).",
      priorityTier: "A",
      sustainabilityScore: "MEDIUM",
    },
    contacts: [{
      firstName: "Luis",
      lastName: "Velazquez",
      jobTitle: "SVP Product Development and Sourcing",
      email: "lvelazquez@fabletics.com",
      personalEmail: "",
      linkedinUrl: "",
      seniority: "vp",
      emailStatus: "verified",
      location: "Los Angeles, CA",
      apolloId: "6754fd219f726300011aede3",
      notes: "Scrubs launch = medical textile antimicrobial angle",
    }],
  },
  {
    brand: {
      name: "Beyond Yoga",
      website: "https://beyondyoga.com",
      segment: "Activewear & Athleisure",
      employees: "320",
      revenue: "",
      hq: "Los Angeles, CA",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Growing premium activewear brand. VP Product Dev/Sourcing enriched with verified email.",
      priorityTier: "B",
      sustainabilityScore: "MEDIUM",
    },
    contacts: [{
      firstName: "Kasey",
      lastName: "Mazzone",
      jobTitle: "VP Product Development/Sourcing and Product Operations",
      email: "kmazzone@beyondyoga.com",
      personalEmail: "kaseymazzone@yahoo.com",
      linkedinUrl: "",
      seniority: "vp",
      emailStatus: "verified",
      location: "Los Angeles, CA",
      apolloId: "56295b62a6da980ea80014bb",
      notes: "",
    }],
  },
  {
    brand: {
      name: "Pentland Brands",
      website: "https://pentlandbrands.com",
      segment: "Multi-brand (Speedo, Canterbury, Ellesse)",
      employees: "2,300",
      revenue: "",
      hq: "London, UK / California",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Owns Speedo, Canterbury, Ellesse — multiple brand entry points. VP Sourcing & Product Dev enriched.",
      priorityTier: "B",
      sustainabilityScore: "MEDIUM",
    },
    contacts: [{
      firstName: "Cory",
      lastName: "Patterson",
      jobTitle: "Vice President, Sourcing & Product Development",
      email: "cory.patterson@pentland.com",
      personalEmail: "corympatterson@me.com",
      linkedinUrl: "",
      seniority: "vp",
      emailStatus: "verified",
      location: "California",
      apolloId: "6076a656aedf8d0001f15cbf",
      notes: "Speedo = swimwear antimicrobial angle. Canterbury = rugby performance.",
    }],
  },
  {
    brand: {
      name: "JOLYN",
      website: "https://jolyn.com",
      segment: "Swimwear",
      employees: "160",
      revenue: "",
      hq: "Huntington Beach, CA",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Competitive swimwear — chlorine-exposed fabrics benefit from antimicrobial treatment.",
      priorityTier: "B",
      sustainabilityScore: "LOW",
    },
    contacts: [{
      firstName: "Kimberly",
      lastName: "Bucciero",
      jobTitle: "VP, Product Development and Sourcing",
      email: "kimberly@jolyn.com",
      personalEmail: "",
      linkedinUrl: "",
      seniority: "vp",
      emailStatus: "verified",
      location: "Huntington Beach, CA",
      apolloId: "63a5166bad531500016433f0",
      notes: "",
    }],
  },
  {
    brand: {
      name: "Title Nine",
      website: "https://titlenine.com",
      segment: "Women's Activewear",
      employees: "300",
      revenue: "",
      hq: "Emeryville, CA",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Women's active/outdoor brand — VP Product Development available via Apollo.",
      priorityTier: "B",
      sustainabilityScore: "MEDIUM",
    },
    contacts: [{
      firstName: "Alice",
      lastName: "Lee",
      jobTitle: "Vice President of Product Development",
      email: "",
      personalEmail: "",
      linkedinUrl: "",
      seniority: "vp",
      emailStatus: "verified",
      location: "California",
      apolloId: "60d38b290a664f0001d293a0",
      notes: "",
    }],
  },
  {
    brand: {
      name: "Perry Ellis International",
      website: "https://perryellis.com",
      segment: "Fashion / Apparel",
      employees: "2,500",
      revenue: "",
      hq: "Miami, FL",
      currentAntimicrobial: "Unknown",
      fuzeRelevance: "Multi-brand fashion company with deep sourcing team. Multiple VPs/Directors of Sourcing enriched.",
      priorityTier: "B",
      sustainabilityScore: "LOW",
    },
    contacts: [{
      firstName: "Weilin",
      lastName: "Jiang",
      jobTitle: "VP of Sourcing",
      email: "",
      personalEmail: "",
      linkedinUrl: "",
      seniority: "vp",
      emailStatus: "verified",
      location: "New York",
      apolloId: "66f14adbd5b32e0001b1ce9a",
      notes: "",
    }],
  },
];

async function main() {
  console.log("🚀 Starting enriched lead import...\n");

  let brandsCreated = 0;
  let brandsUpdated = 0;
  let contactsCreated = 0;
  let contactsUpdated = 0;

  for (const lead of leads) {
    const { brand: b, contacts } = lead;

    // Upsert Brand — create if new, update researchData if exists
    let brand = await prisma.brand.findFirst({
      where: { name: { equals: b.name, mode: "insensitive" } },
    });

    const researchData = {
      discoveredBy: ["Apollo"],
      validationCount: 1,
      category: b.segment,
      region: "Global",
      headquarters: b.hq,
      employeeCount: b.employees,
      revenue: b.revenue,
      currentAntimicrobial: b.currentAntimicrobial,
      sustainabilityScore: b.sustainabilityScore,
      priorityTier: b.priorityTier,
      enrichedAt: new Date().toISOString(),
      source: "apollo-prospecting-2026-04-13",
    };

    if (brand) {
      // Update existing brand with enrichment data
      brand = await prisma.brand.update({
        where: { id: brand.id },
        data: {
          website: b.website || brand.website,
          backgroundInfo: b.fuzeRelevance,
          researchData: {
            ...(brand.researchData as any || {}),
            ...researchData,
          },
          researchDate: new Date(),
        },
      });
      console.log(`  ✏️  Updated brand: ${brand.name} (${brand.id})`);
      brandsUpdated++;
    } else {
      brand = await prisma.brand.create({
        data: {
          name: b.name,
          website: b.website,
          customerType: b.segment,
          pipelineStage: "LEAD",
          backgroundInfo: b.fuzeRelevance,
          researchData,
          researchDate: new Date(),
        },
      });
      console.log(`  ✅ Created brand: ${brand.name} (${brand.id})`);
      brandsCreated++;
    }

    // Upsert Contacts linked to this brand
    for (const c of contacts) {
      if (!c.firstName && !c.email) continue;

      // Check for existing contact by apolloId or email
      let contact = null;
      if (c.apolloId) {
        contact = await prisma.contact.findFirst({
          where: { apolloId: c.apolloId },
        });
      }
      if (!contact && c.email) {
        contact = await prisma.contact.findFirst({
          where: { email: c.email },
        });
      }

      const contactData = {
        firstName: c.firstName,
        lastName: c.lastName,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email || null,
        personalEmail: c.personalEmail || null,
        linkedinUrl: c.linkedinUrl || null,
        jobTitle: c.jobTitle,
        seniority: c.seniority,
        emailStatus: c.emailStatus,
        enrichedAt: new Date(),
        enrichmentSource: "apollo",
        apolloId: c.apolloId || null,
        outreachStatus: "not_contacted",
        decisionMaker: true,
        vertical: b.segment.toLowerCase(),
        companyRevenue: b.revenue || null,
        brandId: brand.id,
      };

      if (contact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: contactData,
        });
        console.log(`    ✏️  Updated contact: ${c.firstName} ${c.lastName} (${c.jobTitle})`);
        contactsUpdated++;
      } else {
        await prisma.contact.create({ data: contactData });
        console.log(`    ✅ Created contact: ${c.firstName} ${c.lastName} (${c.jobTitle})`);
        contactsCreated++;
      }
    }
  }

  console.log(`\n📊 Import complete:`);
  console.log(`   Brands:   ${brandsCreated} created, ${brandsUpdated} updated`);
  console.log(`   Contacts: ${contactsCreated} created, ${contactsUpdated} updated`);
  console.log(`\n🔗 View in Atlas: https://fuzeatlas.com/brands`);
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
