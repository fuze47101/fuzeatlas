// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * FZ-500 Solaris IR Heat Deflection Tests.
 *
 * GET  /api/admin/solaris-tests         — list recent
 * POST /api/admin/solaris-tests         — create a new test
 */

const ALLOWED = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];

function generateTestNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FUZE-SOL-${ymd}-${rand}`;
}

function computeMetrics(series: any[]) {
  // series: [{ t_sec, plateA, plateB, air }, ...]
  // Returns { maxPlateC, maxAirC, timeTo50, timeTo60, rampRateCps }
  if (!Array.isArray(series) || series.length === 0) return {};
  const plateTemps = series.map((s: any) => {
    const a = Number(s.plateA); const b = Number(s.plateB);
    const vals = [a, b].filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : NaN;
  });
  const airTemps = series.map((s: any) => Number(s.air)).filter((v) => Number.isFinite(v));
  const maxPlateC = Math.max(...plateTemps.filter((v) => Number.isFinite(v)));
  const maxAirC = airTemps.length ? Math.max(...airTemps) : null;
  const findCrossing = (target: number) => {
    for (let i = 0; i < series.length; i++) {
      if (plateTemps[i] >= target) return Number(series[i].t_sec);
    }
    return null;
  };
  const timeTo50 = findCrossing(50);
  const timeTo60 = findCrossing(60);
  // Ramp rate = slope of plate temp in first 60 seconds
  const first = series.find((s: any) => Number(s.t_sec) >= 0);
  const atSixty = series.find((s: any) => Number(s.t_sec) >= 60);
  let rampRateCps: number | null = null;
  if (first && atSixty) {
    const iFirst = series.indexOf(first);
    const iSixty = series.indexOf(atSixty);
    const dt = Number(atSixty.t_sec) - Number(first.t_sec);
    const dTemp = plateTemps[iSixty] - plateTemps[iFirst];
    if (dt > 0) rampRateCps = dTemp / dt;
  }
  return { maxPlateC, maxAirC, timeTo50, timeTo60, rampRateCps };
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }
    const tests = await prisma.solarisTest.findMany({
      orderBy: { testDate: "desc" },
      take: 50,
      include: { fabric: { select: { id: true, fuzeNumber: true, customerCode: true } } },
    });
    return NextResponse.json({ ok: true, tests });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }
    const body = await req.json();

    // Recompute metrics from series if provided
    const baselineMetrics = body.baselineSeries ? computeMetrics(body.baselineSeries) : {};
    const treatedMetrics = body.treatedSeries ? computeMetrics(body.treatedSeries) : {};

    // Deltas if both runs exist
    let deltaMaxPlateC: number | null = null;
    let deltaMaxAirC: number | null = null;
    let deltaRampRateCps: number | null = null;
    let irDeflectionPct: number | null = null;
    if (baselineMetrics.maxPlateC != null && treatedMetrics.maxPlateC != null) {
      deltaMaxPlateC = treatedMetrics.maxPlateC - baselineMetrics.maxPlateC;
      if (baselineMetrics.maxPlateC > 0) {
        irDeflectionPct = -(deltaMaxPlateC / baselineMetrics.maxPlateC) * 100; // positive = deflection
      }
    }
    if (baselineMetrics.maxAirC != null && treatedMetrics.maxAirC != null) {
      deltaMaxAirC = treatedMetrics.maxAirC - baselineMetrics.maxAirC;
    }
    if (baselineMetrics.rampRateCps != null && treatedMetrics.rampRateCps != null) {
      deltaRampRateCps = treatedMetrics.rampRateCps - baselineMetrics.rampRateCps;
    }

    // Pass/fail vs Nike spec
    let passFail: string | null = null;
    if (body.nikeSpecMaxDeltaC != null && deltaMaxPlateC != null) {
      const spec = Number(body.nikeSpecMaxDeltaC);
      if (deltaMaxPlateC <= spec) passFail = "PASS";
      else if (deltaMaxPlateC <= spec * 1.1) passFail = "MARGINAL";
      else passFail = "FAIL";
    }

    const safe = (v: any) => (v === undefined || v === "" || v === null ? null : v);
    const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

    const test = await prisma.solarisTest.create({
      data: {
        testNumber: body.testNumber || generateTestNumber(),
        testDate: body.testDate ? new Date(body.testDate) : new Date(),
        fabricId: safe(body.fabricId),
        fabricLabel: body.fabricLabel || "Solaris test",
        fabricType: safe(body.fabricType),
        fiberContent: safe(body.fiberContent),
        fabricWeightGsm: num(body.fabricWeightGsm),
        fabricColor: safe(body.fabricColor),
        treatedAtTier: safe(body.treatedAtTier),
        benchTestId: safe(body.benchTestId),
        deviceName: safe(body.deviceName),
        bulbWattage: num(body.bulbWattage),
        bulbType: safe(body.bulbType),
        bulbToFabricMm: num(body.bulbToFabricMm) ?? 200,
        fabricToPlateMm: num(body.fabricToPlateMm) ?? 45,
        hoopDiameterMm: num(body.hoopDiameterMm) ?? 150,
        hoopThicknessMm: num(body.hoopThicknessMm) ?? 10,
        plateWidthMm: num(body.plateWidthMm) ?? 175,
        plateHeightMm: num(body.plateHeightMm) ?? 175,
        plateMaterial: safe(body.plateMaterial),
        ambientTempC: num(body.ambientTempC),
        ambientHumidityPct: num(body.ambientHumidityPct),
        runDurationSec: num(body.runDurationSec) ?? 600,
        sampleIntervalMs: num(body.sampleIntervalMs) ?? 1000,
        baselineStartedAt: body.baselineStartedAt ? new Date(body.baselineStartedAt) : null,
        baselineCompletedAt: body.baselineCompletedAt ? new Date(body.baselineCompletedAt) : null,
        baselineMaxPlateTempC: baselineMetrics.maxPlateC ?? num(body.baselineMaxPlateTempC),
        baselineMaxAirTempC: baselineMetrics.maxAirC ?? num(body.baselineMaxAirTempC),
        baselineTimeTo50C_sec: baselineMetrics.timeTo50 ?? num(body.baselineTimeTo50C_sec),
        baselineTimeTo60C_sec: baselineMetrics.timeTo60 ?? num(body.baselineTimeTo60C_sec),
        baselineRampRateCps: baselineMetrics.rampRateCps ?? num(body.baselineRampRateCps),
        baselineSeries: body.baselineSeries ?? null,
        treatedStartedAt: body.treatedStartedAt ? new Date(body.treatedStartedAt) : null,
        treatedCompletedAt: body.treatedCompletedAt ? new Date(body.treatedCompletedAt) : null,
        treatedMaxPlateTempC: treatedMetrics.maxPlateC ?? num(body.treatedMaxPlateTempC),
        treatedMaxAirTempC: treatedMetrics.maxAirC ?? num(body.treatedMaxAirTempC),
        treatedTimeTo50C_sec: treatedMetrics.timeTo50 ?? num(body.treatedTimeTo50C_sec),
        treatedTimeTo60C_sec: treatedMetrics.timeTo60 ?? num(body.treatedTimeTo60C_sec),
        treatedRampRateCps: treatedMetrics.rampRateCps ?? num(body.treatedRampRateCps),
        treatedSeries: body.treatedSeries ?? null,
        deltaMaxPlateC, deltaMaxAirC, deltaRampRateCps, irDeflectionPct, passFail,
        nikeSpecMaxDeltaC: num(body.nikeSpecMaxDeltaC),
        notes: safe(body.notes),
        createdById: user.id || null,
      },
    });
    return NextResponse.json({ ok: true, test });
  } catch (e: any) {
    console.error("Solaris POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
