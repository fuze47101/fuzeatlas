import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MANAGER_ROLES,
  mondayOf,
  ownedEntityKeys,
  type EntityType,
  type CheckinKind,
} from "@/lib/book";
import { notifyHelpRequested, notifySuperUpdate } from "@/lib/book-notify";

const KINDS: CheckinKind[] = ["NONE", "UPDATE", "SUPER", "HELP"];
const STAGES = [
  "LEAD",
  "PRESENTATION",
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "ARCHIVE",
  "CUSTOMER_WON",
];

/**
 * POST /api/book/checkin
 * {
 *   entityType, entityId, kind,
 *   note?, headline?, noteLang?,
 *   nextStep?, nextStepAt?,
 *   stage?, forecastQuarter?,          // only written when they differ
 *   order?: { product, kg, month },     // PRODUCTION accounts
 *   help?: { assigneeId, ask }          // kind === "HELP"
 * }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad JSON" }, { status: 400 });

  const entityType = body.entityType as EntityType;
  const entityId = String(body.entityId || "");
  const kind = body.kind as CheckinKind;
  if (
    !["BRAND", "FACTORY", "DISTRIBUTOR"].includes(entityType) ||
    !entityId ||
    !KINDS.includes(kind)
  ) {
    return NextResponse.json(
      { error: "entityType, entityId and kind are required" },
      { status: 400 },
    );
  }
  const note: string | null =
    typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const headline: string | null =
    typeof body.headline === "string" && body.headline.trim()
      ? body.headline.trim().slice(0, 140)
      : null;
  if (kind === "SUPER" && !headline)
    return NextResponse.json(
      { error: "A super update needs a one-line headline" },
      { status: 400 },
    );
  if (
    (kind === "UPDATE" || kind === "SUPER") &&
    !note &&
    !headline &&
    !body.stage &&
    !body.forecastQuarter &&
    !body.nextStep &&
    !body.order
  ) {
    return NextResponse.json({ error: "Write something, or choose No Update" }, { status: 400 });
  }
  if (kind === "HELP" && (!body.help?.assigneeId || !String(body.help?.ask || "").trim())) {
    return NextResponse.json(
      { error: "Help needs a teammate and what you need from them" },
      { status: 400 },
    );
  }

  // Authorisation: owner of the account, or an internal manager.
  if (!MANAGER_ROLES.includes(user.role)) {
    const mine = await ownedEntityKeys(user.id, { includeSupport: true });
    if (!mine.some((k) => k.entityType === entityType && k.entityId === entityId))
      return NextResponse.json({ error: "Not in your book" }, { status: 403 });
  }

  // Load the entity for name + before-values.
  let entity: {
    name: string;
    pipelineStage: string | null;
    forecastQuarter: string | null;
  } | null = null;
  if (entityType === "BRAND") {
    const b = await prisma.brand.findUnique({
      where: { id: entityId },
      select: { name: true, pipelineStage: true, forecastQuarter: true },
    });
    entity = b
      ? { name: b.name, pipelineStage: b.pipelineStage, forecastQuarter: b.forecastQuarter }
      : null;
  } else if (entityType === "FACTORY") {
    const f = await prisma.factory.findUnique({
      where: { id: entityId },
      select: { name: true, pipelineStage: true, forecastQuarter: true },
    });
    entity = f
      ? { name: f.name, pipelineStage: f.pipelineStage, forecastQuarter: f.forecastQuarter }
      : null;
  } else {
    const d = await prisma.distributor.findUnique({
      where: { id: entityId },
      select: { name: true },
    });
    entity = d ? { name: d.name, pipelineStage: null, forecastQuarter: null } : null;
  }
  if (!entity) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const now = new Date();
  const weekOf = mondayOf(now);

  // Stage / forecast changes (brands and factories only).
  const stageAfter =
    typeof body.stage === "string" &&
    STAGES.includes(body.stage) &&
    body.stage !== entity.pipelineStage
      ? body.stage
      : null;
  const forecastAfter =
    typeof body.forecastQuarter === "string" &&
    body.forecastQuarter.trim() !== (entity.forecastQuarter || "")
      ? body.forecastQuarter.trim() || null
      : undefined;
  const entityPatch: any = {};
  if (kind !== "NONE") entityPatch.lastActivityAt = now;
  if (stageAfter) entityPatch.pipelineStage = stageAfter;
  if (forecastAfter !== undefined) entityPatch.forecastQuarter = forecastAfter;
  if (Object.keys(entityPatch).length && entityType !== "DISTRIBUTOR") {
    if (entityType === "BRAND")
      await prisma.brand.update({ where: { id: entityId }, data: entityPatch });
    else await prisma.factory.update({ where: { id: entityId }, data: entityPatch });
  }

  // Help request.
  let helpRequest: any = null;
  if (kind === "HELP") {
    const assignee = await prisma.user.findUnique({
      where: { id: String(body.help.assigneeId) },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!assignee || assignee.status !== "ACTIVE")
      return NextResponse.json({ error: "That teammate is not active" }, { status: 400 });
    const dueAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    helpRequest = await prisma.helpRequest.create({
      data: {
        entityType,
        entityId,
        requesterId: user.id,
        assigneeId: assignee.id,
        ask: String(body.help.ask).trim(),
        dueAt,
      },
    });
    notifyHelpRequested({
      requester: { id: user.id, name: user.name },
      assignee: { id: assignee.id, email: assignee.email, name: assignee.name },
      entityType,
      entityId,
      entityName: entity.name,
      ask: helpRequest.ask,
      dueAt,
      helpId: helpRequest.id,
    });
  }

  // Order / consumption captured in the same touch.
  const order =
    body.order && Number(body.order.kg) > 0
      ? {
          product: String(body.order.product || "F1"),
          kg: Number(body.order.kg),
          month: String(body.order.month || now.toISOString().slice(0, 7)),
        }
      : null;

  const checkin = await prisma.accountCheckin.create({
    data: {
      entityType,
      entityId,
      userId: user.id,
      kind,
      weekOf,
      headline,
      note,
      noteLang: typeof body.noteLang === "string" ? body.noteLang : null,
      nextStep:
        typeof body.nextStep === "string" && body.nextStep.trim()
          ? body.nextStep.trim().slice(0, 200)
          : null,
      nextStepAt: body.nextStepAt ? new Date(body.nextStepAt) : null,
      stageBefore: stageAfter ? entity.pipelineStage : null,
      stageAfter,
      forecastBefore: forecastAfter !== undefined ? entity.forecastQuarter : null,
      forecastAfter: forecastAfter !== undefined ? forecastAfter : null,
      orderProduct: order?.product || null,
      orderKg: order?.kg || null,
      orderMonth: order?.month || null,
      helpRequestId: helpRequest?.id || null,
    },
  });

  // Mirror onto the account's own notes so the brand / factory page shows it.
  if (kind !== "NONE" && entityType !== "DISTRIBUTOR") {
    const label =
      kind === "SUPER"
        ? "⭐ Super update"
        : kind === "HELP"
          ? "🙋 Help requested"
          : "Weekly update";
    const parts = [
      headline ? `${label}: ${headline}` : label,
      note,
      checkin.nextStep ? `Next: ${checkin.nextStep}` : null,
      stageAfter ? `Stage → ${stageAfter}` : null,
      forecastAfter ? `Forecast → ${forecastAfter}` : null,
      helpRequest ? `Help asked: ${helpRequest.ask}` : null,
      order ? `Order: ${order.kg} kg ${order.product} (${order.month})` : null,
    ].filter(Boolean);
    await prisma.note
      .create({
        data: {
          content: parts.join("\n"),
          noteType: "CHECKIN",
          userId: user.id,
          date: now,
          brandId: entityType === "BRAND" ? entityId : null,
          factoryId: entityType === "FACTORY" ? entityId : null,
        },
      })
      .catch((e) => console.error("[BOOK] note mirror failed", e));
  }

  // Consumption row for factories reporting usage.
  if (order && entityType === "FACTORY") {
    await prisma.fuzeConsumption
      .create({
        data: {
          factoryId: entityId,
          litersUsed: order.kg,
          fuzeTier: order.product,
          usageDate: new Date(`${order.month}-15T00:00:00Z`),
          reportedById: user.id,
          notes: `Weekly check-in by ${user.name}`,
        },
      })
      .catch((e) => console.error("[BOOK] consumption failed", e));
  }

  if (kind === "SUPER") {
    notifySuperUpdate({
      actor: { id: user.id, name: user.name },
      entityType,
      entityId,
      entityName: entity.name,
      headline: headline!,
      note,
    });
  }

  return NextResponse.json({ ok: true, checkin, helpRequest });
}
