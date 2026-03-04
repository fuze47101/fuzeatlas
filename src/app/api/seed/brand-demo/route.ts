// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getCurrentUser } from "@/lib/auth";

// POST /api/seed/brand-demo — Create Acme Clothing Company with full demo data
// Admin-only endpoint
export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "EMPLOYEE")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // ─── 1. Create or find the brand ─────────────────────────
    let brand = await prisma.brand.findUnique({
      where: { name: "Acme Clothing Company" },
    });

    if (!brand) {
      brand = await prisma.brand.create({
        data: {
          name: "Acme Clothing Company",
          pipelineStage: "QUALIFIED",
          customerType: "Enterprise",
          website: "https://acmeclothing.com",
          backgroundInfo: "Leading sportswear and activewear brand with global distribution. Interested in antimicrobial treatment for their performance athletic line and hospitality uniform division.",
          dateOfInitialContact: new Date("2025-09-15"),
        },
      });
    }

    // ─── 2. Create or find the brand user ─────────────────────────
    const email = "brand@acmeclothing.com";
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const hashed = await hashPassword("acme2025!");
      user = await prisma.user.create({
        data: {
          name: "Sarah Chen",
          email,
          password: hashed,
          role: "BRAND_USER",
          status: "ACTIVE",
          brandId: brand.id,
        },
      });
    } else if (!user.brandId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { brandId: brand.id },
      });
    }

    // ─── 3. Create contacts ─────────────────────────
    const existingContacts = await prisma.contact.count({ where: { brandId: brand.id } });
    if (existingContacts === 0) {
      await prisma.contact.createMany({
        data: [
          { name: "Sarah Chen", email: "sarah.chen@acmeclothing.com", role: "Product Development Manager", phone: "+1-555-0101", brandId: brand.id, isApprover: false },
          { name: "James Rodriguez", email: "j.rodriguez@acmeclothing.com", role: "VP of Sourcing", phone: "+1-555-0102", brandId: brand.id, isApprover: true },
          { name: "Min Liu", email: "min.liu@acmeclothing.com", role: "Quality Assurance Director", phone: "+1-555-0103", brandId: brand.id, isApprover: true },
        ],
      });
    }

    // ─── 4. Create sample fabrics ─────────────────────────
    const existingFabrics = await prisma.fabric.count({ where: { brandId: brand.id } });
    let fabrics = [];
    if (existingFabrics === 0) {
      const fabricData = [
        {
          customerCode: "ACME-PF-001",
          construction: "Single Jersey Knit",
          color: "Black",
          weightGsm: 180,
          widthInches: 60,
          yarnType: "100% Polyester Microfiber",
          finishNote: "Moisture-wicking finish, brushed interior",
          note: "Performance athletic tee fabric — main fabric for running collection",
          brandId: brand.id,
        },
        {
          customerCode: "ACME-PF-002",
          construction: "Interlock Knit",
          color: "Navy",
          weightGsm: 220,
          widthInches: 58,
          yarnType: "87% Polyester / 13% Spandex",
          finishNote: "4-way stretch, moisture management",
          note: "Compression legging fabric — yoga and training line",
          brandId: brand.id,
        },
        {
          customerCode: "ACME-HU-001",
          construction: "Twill Weave",
          color: "White",
          weightGsm: 260,
          widthInches: 62,
          yarnType: "65% Polyester / 35% Cotton",
          finishNote: "Wrinkle-resistant, industrial laundering rated",
          note: "Hospitality uniform shirt fabric — hotel chain program",
          brandId: brand.id,
        },
        {
          customerCode: "ACME-HU-002",
          construction: "Poplin Weave",
          color: "Light Blue",
          weightGsm: 140,
          widthInches: 60,
          yarnType: "60% Cotton / 40% Polyester",
          finishNote: "Easy-care, wrinkle-free",
          note: "Restaurant server uniform blouse fabric",
          brandId: brand.id,
        },
        {
          customerCode: "ACME-PF-003",
          construction: "Mesh Knit",
          color: "Red",
          weightGsm: 120,
          widthInches: 56,
          yarnType: "100% Polyester",
          finishNote: "Open mesh construction, sublimation-ready",
          note: "Ventilation panel fabric for performance jerseys",
          brandId: brand.id,
        },
      ];

      for (const fd of fabricData) {
        const f = await prisma.fabric.create({ data: fd });
        fabrics.push(f);
      }
    } else {
      fabrics = await prisma.fabric.findMany({ where: { brandId: brand.id }, take: 5 });
    }

    // ─── 5. Create projects ─────────────────────────
    const existingProjects = await prisma.project.count({ where: { brandId: brand.id } });
    let projects = [];
    if (existingProjects === 0) {
      const p1 = await prisma.project.create({
        data: {
          name: "Acme Performance Athletic Line — FUZE F2",
          description: "Antimicrobial treatment for Acme's performance athletic wear collection including moisture-wicking shirts, shorts, and compression gear. Targeting F2 tier for 75-wash durability.",
          brandId: brand.id,
          stage: "TESTING",
          projectedValue: 85000,
          probability: 70,
          fuzeTier: "F2",
          annualVolumeMeters: 250000,
          currency: "USD",
        },
      });
      const p2 = await prisma.project.create({
        data: {
          name: "Acme Hospitality Uniforms — FUZE F1",
          description: "Premium F1 treatment for hotel and restaurant uniform line. High durability requirement for industrial laundering.",
          brandId: brand.id,
          stage: "SAMPLING",
          projectedValue: 120000,
          probability: 45,
          fuzeTier: "F1",
          annualVolumeMeters: 180000,
          currency: "USD",
        },
      });
      projects = [p1, p2];
    } else {
      projects = await prisma.project.findMany({ where: { brandId: brand.id }, take: 2 });
    }

    // ─── 6. Create fabric submissions ─────────────────────────
    const existingSubs = await prisma.fabricSubmission.count({ where: { brandId: brand.id } });
    let submissions = [];
    if (existingSubs === 0 && fabrics.length >= 3) {
      const subData = [
        {
          brandId: brand.id,
          fabricId: fabrics[0]?.id,
          customerFabricCode: "ACME-PF-001",
          applicationMethod: "Exhaust",
          washTarget: 75,
          status: "TESTED",
          programName: "Acme Athletic F2 Program",
          developmentStage: "Testing",
          applicationDate: new Date("2025-11-10"),
        },
        {
          brandId: brand.id,
          fabricId: fabrics[1]?.id,
          customerFabricCode: "ACME-PF-002",
          applicationMethod: "Exhaust",
          washTarget: 75,
          status: "TESTED",
          programName: "Acme Athletic F2 Program",
          developmentStage: "Testing",
          applicationDate: new Date("2025-11-10"),
        },
        {
          brandId: brand.id,
          fabricId: fabrics[2]?.id,
          customerFabricCode: "ACME-HU-001",
          applicationMethod: "Pad-Dry-Cure",
          washTarget: 100,
          status: "IN_PROGRESS",
          programName: "Acme Hospitality F1 Program",
          developmentStage: "Sampling",
          applicationDate: new Date("2025-12-05"),
        },
        {
          brandId: brand.id,
          fabricId: fabrics[3]?.id,
          customerFabricCode: "ACME-HU-002",
          applicationMethod: "Pad-Dry-Cure",
          washTarget: 100,
          status: "SUBMITTED",
          programName: "Acme Hospitality F1 Program",
          developmentStage: "Sampling",
        },
        {
          brandId: brand.id,
          fabricId: fabrics[4]?.id,
          customerFabricCode: "ACME-PF-003",
          applicationMethod: "Exhaust",
          washTarget: 75,
          status: "TESTED",
          programName: "Acme Athletic F2 Program",
          developmentStage: "Testing",
          applicationDate: new Date("2025-11-15"),
        },
      ];

      for (const sd of subData) {
        const s = await prisma.fabricSubmission.create({ data: sd });
        submissions.push(s);
      }
    } else {
      submissions = await prisma.fabricSubmission.findMany({ where: { brandId: brand.id }, take: 5 });
    }

    // ─── 7. Create test runs with results ─────────────────────────
    const existingTests = await prisma.testRun.count({
      where: { submission: { brandId: brand.id } },
    });

    if (existingTests === 0 && submissions.length >= 3) {
      // Find or reference a lab
      let lab = await prisma.lab.findFirst();

      // Test runs for submission 0 (ACME-PF-001 — Performance Polyester)
      if (submissions[0]) {
        // AATCC 100 Antibacterial — PASSED
        const t1 = await prisma.testRun.create({
          data: {
            submissionId: submissions[0].id,
            projectId: projects[0]?.id,
            labId: lab?.id,
            testType: "ANTIBACTERIAL",
            testMethodStd: "AATCC 100",
            testMethodRaw: "AATCC TM100-2019",
            testDate: new Date("2025-12-01"),
            washCount: 75,
            washLabelRaw: "75 washes at 60°C",
          },
        });
        await prisma.antibacterialResult.create({
          data: {
            testRunId: t1.id,
            organism1: "S. aureus (ATCC 6538)",
            organism2: "K. pneumoniae (ATCC 4352)",
            result1: 99.98,
            result2: 99.95,
            pass: true,
          },
        });

        // ICP Silver content test
        const t2 = await prisma.testRun.create({
          data: {
            submissionId: submissions[0].id,
            projectId: projects[0]?.id,
            labId: lab?.id,
            testType: "ICP",
            testMethodStd: "ICP-OES",
            testMethodRaw: "EPA 6010D",
            testDate: new Date("2025-12-01"),
            washCount: 0,
            washLabelRaw: "Before wash",
          },
        });
        await prisma.icpResult.create({
          data: {
            testRunId: t2.id,
            agValue: 42.5,
            unit: "ppm",
          },
        });
      }

      // Test runs for submission 1 (ACME-PF-002 — Compression Fabric)
      if (submissions[1]) {
        const t3 = await prisma.testRun.create({
          data: {
            submissionId: submissions[1].id,
            projectId: projects[0]?.id,
            labId: lab?.id,
            testType: "ANTIBACTERIAL",
            testMethodStd: "AATCC 100",
            testMethodRaw: "AATCC TM100-2019",
            testDate: new Date("2025-12-03"),
            washCount: 75,
            washLabelRaw: "75 washes at 60°C",
          },
        });
        await prisma.antibacterialResult.create({
          data: {
            testRunId: t3.id,
            organism1: "S. aureus (ATCC 6538)",
            organism2: "E. coli (ATCC 25922)",
            result1: 99.92,
            result2: 99.87,
            pass: true,
          },
        });

        // Fungal test
        const t4 = await prisma.testRun.create({
          data: {
            submissionId: submissions[1].id,
            projectId: projects[0]?.id,
            labId: lab?.id,
            testType: "FUNGAL",
            testMethodStd: "AATCC 30",
            testMethodRaw: "AATCC TM30-2017 Part III",
            testDate: new Date("2025-12-05"),
            washCount: 75,
            washLabelRaw: "75 washes at 60°C",
          },
        });
        await prisma.fungalResult.create({
          data: {
            testRunId: t4.id,
            writtenResult: "A. niger (ATCC 6275) — No growth observed, zone of inhibition 15mm",
            pass: true,
          },
        });
      }

      // Test runs for submission 2 (ACME-HU-001 — Hospitality Twill)
      if (submissions[2]) {
        const t5 = await prisma.testRun.create({
          data: {
            submissionId: submissions[2].id,
            projectId: projects[1]?.id,
            labId: lab?.id,
            testType: "ANTIBACTERIAL",
            testMethodStd: "AATCC 100",
            testMethodRaw: "AATCC TM100-2019",
            testDate: new Date("2026-01-15"),
            washCount: 50,
            washLabelRaw: "50 washes at 60°C (interim)",
          },
        });
        await prisma.antibacterialResult.create({
          data: {
            testRunId: t5.id,
            organism1: "S. aureus (ATCC 6538)",
            organism2: "K. pneumoniae (ATCC 4352)",
            result1: 99.99,
            result2: 99.97,
            pass: true,
          },
        });

        // ICP pre-wash
        const t6 = await prisma.testRun.create({
          data: {
            submissionId: submissions[2].id,
            projectId: projects[1]?.id,
            labId: lab?.id,
            testType: "ICP",
            testMethodStd: "ICP-OES",
            testMethodRaw: "EPA 6010D",
            testDate: new Date("2026-01-10"),
            washCount: 0,
            washLabelRaw: "Pre-wash baseline",
          },
        });
        await prisma.icpResult.create({
          data: {
            testRunId: t6.id,
            agValue: 58.3,
            unit: "ppm",
          },
        });
      }

      // Test for submission 4 (ACME-PF-003 — Mesh Panel)
      if (submissions[4]) {
        // One failed test to show mixed results
        const t7 = await prisma.testRun.create({
          data: {
            submissionId: submissions[4].id,
            projectId: projects[0]?.id,
            labId: lab?.id,
            testType: "ANTIBACTERIAL",
            testMethodStd: "AATCC 100",
            testMethodRaw: "AATCC TM100-2019",
            testDate: new Date("2025-12-08"),
            washCount: 75,
            washLabelRaw: "75 washes at 60°C",
          },
        });
        await prisma.antibacterialResult.create({
          data: {
            testRunId: t7.id,
            organism1: "S. aureus (ATCC 6538)",
            organism2: "K. pneumoniae (ATCC 4352)",
            result1: 97.2,
            result2: 85.3,
            pass: false,
          },
        });

        // Retest that passed
        const t8 = await prisma.testRun.create({
          data: {
            submissionId: submissions[4].id,
            projectId: projects[0]?.id,
            labId: lab?.id,
            testType: "ANTIBACTERIAL",
            testMethodStd: "AATCC 100",
            testMethodRaw: "AATCC TM100-2019 (Retest)",
            testDate: new Date("2026-01-20"),
            washCount: 75,
            washLabelRaw: "75 washes at 60°C — retreated sample",
          },
        });
        await prisma.antibacterialResult.create({
          data: {
            testRunId: t8.id,
            organism1: "S. aureus (ATCC 6538)",
            organism2: "K. pneumoniae (ATCC 4352)",
            result1: 99.94,
            result2: 99.88,
            pass: true,
          },
        });
      }
    }

    // ─── Summary ─────────────────────────
    const totalFabrics = await prisma.fabric.count({ where: { brandId: brand.id } });
    const totalSubs = await prisma.fabricSubmission.count({ where: { brandId: brand.id } });
    const totalTests = await prisma.testRun.count({ where: { submission: { brandId: brand.id } } });
    const totalProjects = await prisma.project.count({ where: { brandId: brand.id } });

    return NextResponse.json({
      ok: true,
      brand: { id: brand.id, name: brand.name },
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        loginPassword: "acme2025!",
      },
      stats: {
        fabrics: totalFabrics,
        submissions: totalSubs,
        testRuns: totalTests,
        projects: totalProjects,
        contacts: await prisma.contact.count({ where: { brandId: brand.id } }),
      },
      message: "Acme Clothing Company demo data created successfully",
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
