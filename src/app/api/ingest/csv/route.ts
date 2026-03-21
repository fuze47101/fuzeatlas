import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parse } from "csv-parse/sync";

export const runtime = "nodejs";

/**
 * Expected CSVs (from Knack exports) will vary.
 * We ingest “best-effort”:
 * - Creates/updates Fabric
 * - Creates FabricSubmission when FUZE # exists
 * - Creates FabricContent rows if "contents" or material/% fields exist
 * - Stores raw row in SourceRecord for traceability
 *
 * Upload via multipart/form-data with field name: "file"
 * Optional form fields:
 *  - sourceTable (string): e.g. "knack_fabrics", "knack_tests_icp"
 *  - sourceSystem (string): "CSV" (default)
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const f = form.get("file");

    if (!f || !(f instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Missing multipart file field 'file'." },
        { status: 400 }
      );
    }

    const sourceTable = String(form.get("sourceTable") || "CSV_UPLOAD").trim();
    const sourceSystem = String(form.get("sourceSystem") || "CSV").trim();

    const buf = Buffer.from(await f.arrayBuffer());
    const text = buf.toString("utf-8");

    const records: Record<string, any>[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true,
    });

    // Helpers
    const norm = (v: any) => (v === null || v === undefined ? "" : String(v)).trim();
    const toInt = (v: any) => {
      const s = norm(v);
      if (!s) return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    };
    const toFloat = (v: any) => {
      const s = norm(v);
      if (!s) return null;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };

    // Flexible column mapping (Knack exports are inconsistent)
    const pick = (row: any, keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && norm(row[k]) !== "") return row[k];
      }
      return null;
    };

    let createdFabrics = 0;
    let updatedFabrics = 0;
    let createdSubmissions = 0;
    let createdContents = 0;
    let sourceRecords = 0;
    const errors: any[] = [];

    // Process sequentially (safe + predictable)
    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      try {
        // ---- Fabric fields ----
        const construction = pick(row, ["construction", "Construction", "Fabric Construction"]);
        const color = pick(row, ["color", "Color"]);
        const widthInches = toFloat(pick(row, ["widthInches", "Width (in)", "Width", "width_in"]));
        const weightGsm = toFloat(pick(row, ["weightGsm", "GSM", "Weight (gsm)", "weight_gsm"]));

        // ---- Submission identifiers ----
        const fuzeFabricNumber = toInt(
          pick(row, ["fuzeFabricNumber", "FUZE #", "FUZE", "Fuze #", "FUZE Fabric #"])
        );
        const customerFabricCode = norm(pick(row, ["customerFabricCode", "Customer Code", "Cust Code", "Customer Fabric Code"]));
        const factoryFabricCode = norm(pick(row, ["factoryFabricCode", "Factory Code", "Factory Fabric Code"]));

        // ---- Process fields ----
        const applicationMethod = norm(pick(row, ["applicationMethod", "Process", "Method", "Application Method"]));
        const treatmentLocation = norm(pick(row, ["treatmentLocation", "Location", "Treatment Location"]));
        const applicationDateRaw = pick(row, ["applicationDate", "Application Date", "Date"]);
        const applicationDate = applicationDateRaw ? new Date(String(applicationDateRaw)) : null;

        // ---- Contents parsing (very flexible) ----
        // Common patterns:
        //  - "contents": "Wool 41%; Nylon 55%; Spandex 4%"
        //  - separate columns like material1/percent1...
        const contentsRaw = norm(pick(row, ["contents", "Contents", "Composition"]));

        // Find-or-create Fabric
        // Strategy: If FUZE # exists, use it as primary identity through FabricSubmission,
        // otherwise create fabric by a signature of construction/color/width/gsm/raw.
        let fabricId: string | null = null;

        if (fuzeFabricNumber) {
          // Try locate existing submission by FUZE #
          const existingSub = await prisma.fabricSubmission.findFirst({
            where: { fuzeFabricNumber },
            select: { fabricId: true, id: true },
          });
          if (existingSub?.fabricId) fabricId = existingSub.fabricId;
        }

        // If still unknown, create new Fabric
        if (!fabricId) {
          const created = await prisma.fabric.create({
            data: {
              construction: construction ? String(construction) : null,
              color: color ? String(color) : null,
              widthInches: widthInches ?? null,
              weightGsm: weightGsm ?? null,
              raw: row,
            },
            select: { id: true },
          });
          fabricId = created.id;
          createdFabrics++;
        } else {
          // Update fabric with any missing canonical fields (don’t overwrite good data)
          const current = await prisma.fabric.findUnique({
            where: { id: fabricId },
            select: { construction: true, color: true, widthInches: true, weightGsm: true },
          });
          const data: any = {};
          if (!current?.construction && construction) data.construction = String(construction);
          if (!current?.color && color) data.color = String(color);
          if (current?.widthInches == null && widthInches != null) data.widthInches = widthInches;
          if (current?.weightGsm == null && weightGsm != null) data.weightGsm = weightGsm;

          if (Object.keys(data).length) {
            await prisma.fabric.update({ where: { id: fabricId }, data });
            updatedFabrics++;
          }
        }

        // Create/Upsert Submission if FUZE # exists (this is how we show codes!)
        if (fuzeFabricNumber && fabricId) {
          const existing = await prisma.fabricSubmission.findFirst({
            where: { fuzeFabricNumber },
            select: { id: true },
          });

          if (!existing) {
            await prisma.fabricSubmission.create({
              data: {
                fabricId,
                fuzeFabricNumber,
                customerFabricCode: customerFabricCode || null,
                factoryFabricCode: factoryFabricCode || null,
                applicationMethod: applicationMethod || null,
                treatmentLocation: treatmentLocation || null,
                applicationDate: applicationDate && !isNaN(applicationDate.getTime()) ? applicationDate : null,
                raw: row,
              },
            });
            createdSubmissions++;
          }
        }

        // Contents: parse if provided and Fabric has no contents yet
        if (fabricId) {
          const existingCount = await prisma.fabricContent.count({ where: { fabricId } });

          if (existingCount === 0) {
            const toCreate: { material: string; percent?: number | null; rawText?: string | null }[] = [];

            // If "contents" string exists, parse pairs like "Wool 41%" or "Polyamide (Nylon) 55%"
            if (contentsRaw) {
              const parts = contentsRaw
                .split(/[,;]+/)
                .map((p) => p.trim())
                .filter(Boolean);

              for (const p of parts) {
                const m = p.match(/^(.*?)(\d+(\.\d+)?)\s*%?\s*$/);
                if (m) {
                  const material = m[1].trim();
                  const pct = parseFloat(m[2]);
                  toCreate.push({ material: material || p, percent: Number.isFinite(pct) ? pct : null, rawText: p });
                } else {
                  toCreate.push({ material: p, percent: null, rawText: p });
                }
              }
            }

            // Fallback: material1/percent1 style columns
            for (let k = 1; k <= 6; k++) {
              const mat = norm(row[`material${k}`] ?? row[`Material ${k}`]);
              const pct = toFloat(row[`percent${k}`] ?? row[`Percent ${k}`]);
              if (mat) toCreate.push({ material: mat, percent: pct, rawText: null });
            }

            if (toCreate.length) {
              await prisma.fabricContent.createMany({
                data: toCreate.map((c) => ({
                  fabricId,
                  material: c.material,
                  percent: c.percent ?? null,
                  rawText: c.rawText ?? null,
                })),
              });
              createdContents += toCreate.length;
            }
          }
        }

        // SourceRecord (always store the row verbatim)
        await prisma.sourceRecord.create({
          data: {
            sourceSystem: sourceSystem as any,
            sourceTable,
            sourceRecordId: norm(pick(row, ["Record ID", "record_id", "id"])) || null,
            sourceKey: fuzeFabricNumber ? `FUZE:${fuzeFabricNumber}` : null,
            raw: row,
          },
        });
        sourceRecords++;
      } catch (e: any) {
        errors.push({ rowIndex: i, error: e?.message || String(e) });
      }
    }

    return NextResponse.json({
      ok: true,
      file: { name: f.name, size: f.size, type: f.type },
      counts: {
        rows: records.length,
        createdFabrics,
        updatedFabrics,
        createdSubmissions,
        createdContents,
        sourceRecords,
        errors: errors.length,
      },
      errors: errors.slice(0, 50),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}