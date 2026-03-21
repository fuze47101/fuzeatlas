// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/reports/weekly?start=2026-02-24&end=2026-03-02 ── */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let startStr = url.searchParams.get("start");
    let endStr = url.searchParams.get("end");

    // Default to current week (Monday–Sunday)
    const now = new Date();
    if (!endStr) {
      endStr = now.toISOString().split("T")[0];
    }
    if (!startStr) {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      startStr = monday.toISOString().split("T")[0];
    }

    const start = new Date(startStr + "T00:00:00Z");
    const end = new Date(endStr + "T23:59:59Z");
    const range = { gte: start, lte: end };

    // ── Brands ──────────────────────────────────
    const brandsAdded = await prisma.brand.findMany({
      where: { createdAt: range },
      select: { id: true, name: true, pipelineStage: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const brandsUpdated = await prisma.brand.findMany({
      where: { updatedAt: range, NOT: { createdAt: range } },
      select: { id: true, name: true, pipelineStage: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    // ── Pipeline stage changes (brands that moved stages) ───
    // We look at brands updated this week and check their notes for stage changes
    const pipelineChanges = brandsUpdated.filter(b => b.pipelineStage !== undefined);

    // ── Contacts ─────────────────────────────────
    const contactsAdded = await prisma.contact.findMany({
      where: { createdAt: range },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const contactsUpdated = await prisma.contact.findMany({
      where: { updatedAt: range, NOT: { createdAt: range } },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // ── Test Runs ────────────────────────────────
    const testsCompleted = await prisma.testRun.findMany({
      where: { createdAt: range },
      select: {
        id: true, testType: true, testReportNumber: true, testMethodStd: true,
        testDate: true, washCount: true,
        lab: { select: { name: true } },
        submission: {
          select: {
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
            fuzeFabricNumber: true,
          },
        },
        icpResult: { select: { agValue: true, auValue: true } },
        abResult: { select: { organism: true, percentReduction: true, activityValue: true, methodPass: true, organism1: true, result1: true, pass: true } },
        fungalResult: { select: { pass: true } },
        odorResult: { select: { pass: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Test type breakdown
    const testBreakdown: Record<string, { total: number; passed: number; failed: number }> = {};
    for (const tr of testsCompleted) {
      if (!testBreakdown[tr.testType]) testBreakdown[tr.testType] = { total: 0, passed: 0, failed: 0 };
      testBreakdown[tr.testType].total++;
      const pass = tr.icpResult?.agValue > 50
        || tr.abResult?.methodPass || tr.abResult?.pass
        || tr.fungalResult?.pass
        || tr.odorResult?.pass;
      const fail = tr.icpResult?.agValue !== undefined && tr.icpResult.agValue <= 50
        || tr.abResult?.methodPass === false || tr.abResult?.pass === false
        || tr.fungalResult?.pass === false
        || tr.odorResult?.pass === false;
      if (pass) testBreakdown[tr.testType].passed++;
      if (fail) testBreakdown[tr.testType].failed++;
    }

    // ── Fabrics ──────────────────────────────────
    const fabricsAdded = await prisma.fabric.findMany({
      where: { createdAt: range },
      select: {
        id: true, fuzeNumber: true, construction: true, color: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const fabricsUpdated = await prisma.fabric.findMany({
      where: { updatedAt: range, NOT: { createdAt: range } },
      select: {
        id: true, fuzeNumber: true, construction: true,
        brand: { select: { id: true, name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // ── Submissions ──────────────────────────────
    const submissionsNew = await prisma.fabricSubmission.findMany({
      where: { createdAt: range },
      select: {
        id: true, fuzeFabricNumber: true, status: true, testStatus: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const submissionsUpdated = await prisma.fabricSubmission.findMany({
      where: { updatedAt: range, NOT: { createdAt: range } },
      select: {
        id: true, fuzeFabricNumber: true, status: true, testStatus: true,
        brand: { select: { id: true, name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // ── SOWs ─────────────────────────────────────
    const sowsNew = await prisma.sOW.findMany({
      where: { createdAt: range },
      select: {
        id: true, title: true, status: true,
        brand: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const sowsUpdated = await prisma.sOW.findMany({
      where: { updatedAt: range, NOT: { createdAt: range } },
      select: {
        id: true, title: true, status: true,
        brand: { select: { id: true, name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // ── Notes / Activity ─────────────────────────
    const notesAdded = await prisma.note.findMany({
      where: { createdAt: range },
      select: {
        id: true, content: true, noteType: true, date: true, contactName: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // ── Factories ────────────────────────────────
    const factoriesAdded = await prisma.factory.findMany({
      where: { createdAt: range },
      select: { id: true, name: true, country: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // ── Summary Stats ────────────────────────────
    const summary = {
      brandsAdded: brandsAdded.length,
      brandsUpdated: brandsUpdated.length,
      contactsAdded: contactsAdded.length,
      contactsUpdated: contactsUpdated.length,
      testsCompleted: testsCompleted.length,
      fabricsAdded: fabricsAdded.length,
      fabricsUpdated: fabricsUpdated.length,
      submissionsNew: submissionsNew.length,
      submissionsUpdated: submissionsUpdated.length,
      sowsNew: sowsNew.length,
      sowsUpdated: sowsUpdated.length,
      notesAdded: notesAdded.length,
      factoriesAdded: factoriesAdded.length,
    };

    return NextResponse.json({
      ok: true,
      period: { start: startStr, end: endStr },
      summary,
      testBreakdown,
      brands: { added: brandsAdded, updated: brandsUpdated },
      contacts: { added: contactsAdded, updated: contactsUpdated },
      tests: testsCompleted,
      fabrics: { added: fabricsAdded, updated: fabricsUpdated },
      submissions: { new: submissionsNew, updated: submissionsUpdated },
      sows: { new: sowsNew, updated: sowsUpdated },
      notes: notesAdded,
      factories: { added: factoriesAdded },
    });
  } catch (e: any) {
    console.error("Weekly report error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
