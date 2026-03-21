// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/exchange-rates ── list latest rates or convert ────────── */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const doConvert = url.searchParams.get("convert") === "true";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const amount = url.searchParams.get("amount");

    if (doConvert && from && to && amount) {
      // Conversion mode
      const rate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: from,
          toCurrency: to,
        },
        orderBy: { effectiveDate: "desc" },
      });

      if (!rate) {
        return NextResponse.json(
          { ok: false, error: "Exchange rate not found" },
          { status: 404 }
        );
      }

      const converted = parseFloat(amount) * rate.rate;
      return NextResponse.json({
        ok: true,
        from,
        to,
        amount: parseFloat(amount),
        rate: rate.rate,
        converted,
        effectiveDate: rate.effectiveDate,
      });
    }

    // List all rates (base USD)
    const baseRate = "USD";
    const currencies = [
      "CNY",
      "TWD",
      "VND",
      "PKR",
      "INR",
      "LKR",
      "BDT",
      "EUR",
      "GBP",
      "KRW",
      "JPY",
    ];

    const rates = await Promise.all(
      currencies.map(async (currency) => {
        const rate = await prisma.exchangeRate.findFirst({
          where: {
            fromCurrency: baseRate,
            toCurrency: currency,
          },
          orderBy: { effectiveDate: "desc" },
        });
        return rate;
      })
    );

    return NextResponse.json({
      ok: true,
      rates: rates.filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}

/* ── POST /api/exchange-rates ── add/update exchange rate ────────── */
export async function POST(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    // Only admins can manage exchange rates
    if (userRole !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { fromCurrency, toCurrency, rate, effectiveDate, source } = body;

    if (!fromCurrency || !toCurrency || !rate) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await prisma.exchangeRate.create({
      data: {
        fromCurrency,
        toCurrency,
        rate,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        source,
      },
    });

    return NextResponse.json({ ok: true, rate: result });
  } catch (error) {
    console.error("Error creating exchange rate:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create exchange rate" },
      { status: 500 }
    );
  }
}
