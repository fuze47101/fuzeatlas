// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeEntities } from "@/lib/dedupe-merge";
import { mondayOf } from "@/lib/book";

/**
 * One-off seed for My Book — 8 Nov 2026.
 *
 *  1. Merge the obvious duplicates (Welspun ×3, Trident factories ×2,
 *     1888 Mills ×2, Alkaram factories ×2) with the dedupe library.
 *  2. Create the 13 accounts from Barth's tracker that were not in Atlas.
 *  3. Put all tracker accounts into Barth's and Viktor's books
 *     (Viktor primary where he reported on 7 Nov, Barth primary otherwise,
 *     the other as SUPPORT).
 *  4. Write two weeks of history: the tracker's Comments column as a
 *     check-in dated 26 Oct, Viktor's 7 Nov email as a second.
 *  5. Forecast quarter + Gala flag from the tracker.
 *
 * Idempotent: re-running merges nothing, creates nothing twice, and skips
 * check-ins that already exist for the same entity/user/week.
 * GET ?dry=1 reports the plan without writing.
 */
const CRON_SECRET = process.env.CRON_SECRET;

type Row = {
  key: string;
  contact: string;
  testing: boolean;
  comment: string;
  gala: boolean;
  timeline: string;
  country: string;
  find?: { type: "BRAND" | "FACTORY"; name: string }; // exact-name match in Atlas
  create?: { type: "BRAND" | "FACTORY"; name: string; country: string; stage: string };
  viktor?: string | null; // Viktor's 7 Nov line; "NO" = he wrote "No update"
  skip?: boolean; // in the tracker but not assigned here (Andrew's accounts)
};

const ROWS: Row[] = [
  {
    key: "1888",
    contact: "Lexi",
    testing: false,
    comment: "Target towel. Sent email for update.",
    gala: false,
    timeline: "2027 Q2",
    country: "Pakistan",
    find: { type: "BRAND", name: "Feroze1888 Mills" },
    viktor: "Spoke with Lexi. Testing on a beach towel and waiting on UV results.",
  },
  {
    key: "Al Rahim",
    contact: "Adnan",
    testing: false,
    comment: "Testing in a 200L. 10-12% pick up rate. Ongoing testing.",
    gala: false,
    timeline: "?",
    country: "Pakistan",
    find: { type: "BRAND", name: "Al Rahim Textile Industries" },
    viktor: "Testing.",
  },
  {
    key: "Albania",
    contact: "Ergest",
    testing: false,
    comment: "Huge industrial cleaning company is in communication with me.",
    gala: false,
    timeline: "?",
    country: "Albania",
    create: {
      type: "BRAND",
      name: "Albania industrial cleaning (Ergest)",
      country: "Albania",
      stage: "PRESENTATION",
    },
  },
  {
    key: "Alkaram",
    contact: "Uzma",
    testing: true,
    comment: "Testing this week. Pick up 65%. Ongoing testing - apparel brand.",
    gala: false,
    timeline: "?",
    country: "Pakistan",
    find: { type: "BRAND", name: "Alkaram Textile Mills" },
    viktor: "Meeting on Wednesday.",
  },
  {
    key: "Allied",
    contact: "Moshe/Amanda",
    testing: false,
    comment: "Andrew update from visit?",
    gala: false,
    timeline: "?",
    country: "California",
    skip: true,
  },
  {
    key: "Alok",
    contact: "Jyoti",
    testing: false,
    comment: "In email conversation.",
    gala: false,
    timeline: "?",
    country: "India",
    find: { type: "FACTORY", name: "Alok Industries" },
  },
  {
    key: "AMG",
    contact: "Richard",
    testing: true,
    comment: "Seamless testing done 99.99% 50 washes. Richard PTO.",
    gala: false,
    timeline: "2026 Q4",
    country: "Global",
    find: { type: "BRAND", name: "AMG" },
    viktor:
      "Received testing with amazing results. Call with Richard where we talk next steps in the next two weeks. Shelves by May.",
  },
  {
    key: "Arshad Group",
    contact: "Faisal",
    testing: false,
    comment: "Sent requested info to marketing VP.",
    gala: false,
    timeline: "?",
    country: "Pakistan",
    find: { type: "BRAND", name: "Arshad Group" },
  },
  {
    key: "Asia Sock (AMG)",
    contact: "Alex",
    testing: false,
    comment: "Testing complete. 99.99% 50 wash.",
    gala: false,
    timeline: "2026 Q4",
    country: "China",
    create: { type: "BRAND", name: "Asia Sock (AMG)", country: "China", stage: "BRAND_TESTING" },
  },
  {
    key: "Bari Textiles",
    contact: "Krut",
    testing: false,
    comment: "Waiting on further communication from them. Went dark.",
    gala: false,
    timeline: "?",
    country: "India",
    find: { type: "FACTORY", name: "Bari Textile Mills" },
  },
  {
    key: "American Textiles",
    contact: "Patrick",
    testing: false,
    comment: "Working with KPP.",
    gala: true,
    timeline: "?",
    country: "Global",
    find: { type: "BRAND", name: "American Textile" },
  },
  {
    key: "CHT",
    contact: "Birgit",
    testing: false,
    comment: "Testing.",
    gala: false,
    timeline: "?",
    country: "Germany",
    find: { type: "BRAND", name: "CHT Group" },
  },
  {
    key: "Classic Apparel",
    contact: "Tamil",
    testing: false,
    comment: "Worked with Scott on a Rhone order. Gave them same pricing.",
    gala: false,
    timeline: "2026 Q4",
    country: "India",
    create: { type: "FACTORY", name: "Classic Apparel", country: "India", stage: "PRODUCTION" },
    viktor: "NO",
  },
  {
    key: "Classic Fashion",
    contact: "Logesh",
    testing: true,
    comment: "Sam's contact for scrubs to visit in AR. Good email about scrubs.",
    gala: false,
    timeline: "2027 Q1",
    country: "India",
    find: { type: "BRAND", name: "Classic Fashion" },
    viktor: "Sam's Club should make decision around Thanksgiving.",
  },
  {
    key: "Cristy Tex",
    contact: "Jagan",
    testing: false,
    comment:
      "Getting ready for an order. Need to finalize quantity. Hoping for one container minimum.",
    gala: false,
    timeline: "2027 Q2",
    country: "India",
    create: { type: "FACTORY", name: "Cristy Tex", country: "India", stage: "PRODUCTION" },
    viktor:
      "Opening 9 B2C stores this week. Working closely with our team in India. Every towel is and will be 0.25 application of FUZE and we are currently talking about order number 2. Their first order was priced at $49.50 and I am trying to get them to order more than 1 container for better pricing.",
  },
  {
    key: "Earthbound",
    contact: "Michael",
    testing: false,
    comment: "Great meeting with whole team - son is VP. Michael meeting with VP Thursday.",
    gala: true,
    timeline: "2027 Q2",
    country: "Global",
    find: { type: "BRAND", name: "Earthbound" },
    viktor: "Looking at potential developments to implement FUZE on. Huge interest.",
  },
  {
    key: "Essato & Co.",
    contact: "Jami",
    testing: false,
    comment: "Wants a partnership. We said we can't on scrubs. NDAs were signed, testing soon.",
    gala: false,
    timeline: "2027 Q2",
    country: "Italy",
    find: { type: "BRAND", name: "Essato and Co." },
    viktor: "No update. Actively promoting their brand on social media.",
  },
  {
    key: "Glen Raven",
    contact: "Travis",
    testing: false,
    comment: "Barth reached out to Travis for update. Testing done, will report.",
    gala: false,
    timeline: "?",
    country: "USA",
    find: { type: "BRAND", name: "Glen Raven" },
  },
  {
    key: "Globe Cotyarn",
    contact: "Nancy Feldman",
    testing: false,
    comment: "No answer - still.",
    gala: false,
    timeline: "?",
    country: "India",
    create: { type: "FACTORY", name: "Globe Cotyarn", country: "India", stage: "LEAD" },
  },
  {
    key: "Gul-Ahmed",
    contact: "Ahmad/Marci",
    testing: false,
    comment: "Factory reached out to Viktor.",
    gala: false,
    timeline: "2027 Q3",
    country: "Pakistan",
    create: {
      type: "FACTORY",
      name: "Gul Ahmed Textile Mills",
      country: "Pakistan",
      stage: "PRESENTATION",
    },
    viktor: "Call scheduled for Monday. Expecting good news from Marci.",
  },
  {
    key: "High Life (AMG)",
    contact: "Tonya/Daniel",
    testing: false,
    comment: "Brand AND1; Walmart plus others. Importer. Introducing to customers.",
    gala: false,
    timeline: "2027 Q2",
    country: "Global",
    create: { type: "BRAND", name: "High Life (AMG)", country: "USA", stage: "PRESENTATION" },
    viktor: "NO",
  },
  {
    key: "Himatsingka",
    contact: "Brian",
    testing: false,
    comment: "Still in turmoil.",
    gala: false,
    timeline: "?",
    country: "India",
    find: { type: "BRAND", name: "Himatsingka Seide Limited" },
  },
  {
    key: "IFG",
    contact: "Marlene",
    testing: false,
    comment: "Not ready to change antimicrobials.",
    gala: false,
    timeline: "?",
    country: "China",
    find: { type: "BRAND", name: "IFG" },
  },
  {
    key: "IndoCount",
    contact: "Logan",
    testing: false,
    comment: "Not ready to change antimicrobials.",
    gala: false,
    timeline: "?",
    country: "India",
    find: { type: "FACTORY", name: "Indocount" },
  },
  {
    key: "Interloop",
    contact: "Aftab",
    testing: true,
    comment: "4 pairs treated - 4 pairs control - awaiting results - Kaylee.",
    gala: false,
    timeline: "2027 Q2",
    country: "Pakistan",
    find: { type: "FACTORY", name: "Interloop Limited" },
    viktor: "Waiting on test results.",
  },
  {
    key: "International Textile Limited",
    contact: "Marium",
    testing: false,
    comment: "DHL tracker - arrives Kaylee tomorrow - testing results by November.",
    gala: false,
    timeline: "?",
    country: "Pakistan",
    create: {
      type: "FACTORY",
      name: "International Textile Limited",
      country: "Pakistan",
      stage: "BRAND_TESTING",
    },
    viktor: "Results received with 99.99%, they are meeting with customer on Monday.",
  },
  {
    key: "IntexStyle",
    contact: "Sandy",
    testing: false,
    comment: "Loving the 10 cents bed sheet price. We worked it over with Scott.",
    gala: true,
    timeline: "2027 Q2",
    country: "China",
    find: { type: "BRAND", name: "Intexstyle LLC" },
    viktor: "NO",
  },
  {
    key: "JLA Home",
    contact: "Brett",
    testing: false,
    comment: "Pricing explained - new potential hotel - Thursday meeting with Jessika.",
    gala: false,
    timeline: "Current",
    country: "China",
    find: { type: "BRAND", name: "JLA" },
    viktor:
      "Big hotel chain for terry towel in play. They were quoted $35 and agree on price. Production will be in Pakistan. First order will be below 12,600 kg. Working with Jessika on a shower-curtain order before New Year.",
  },
  {
    key: "JQ Company",
    contact: "Michael",
    testing: false,
    comment: "Presented FUZE to board members. Barth followed up.",
    gala: false,
    timeline: "2027 Q2",
    country: "Global",
    find: { type: "BRAND", name: "JQ Company" },
    viktor: "CEO is coming to the USA mid-November.",
  },
  {
    key: "Karim Group",
    contact: "Chaudry",
    testing: false,
    comment: "Gave us a huge lead. They are with HeiQ, they want a change.",
    gala: true,
    timeline: "2027 Q2",
    country: "Bangladesh",
    find: { type: "BRAND", name: "karimgroup.org" },
    viktor: "Wants anti-allergy claims; we cannot make those.",
  },
  {
    key: "KPP",
    contact: "Shenbaga",
    testing: false,
    comment: "In between KPP and American Textile.",
    gala: false,
    timeline: "2027 Q1",
    country: "India",
    find: { type: "BRAND", name: "KPP Group" },
    viktor: "NO",
  },
  {
    key: "Live Comfortably",
    contact: "Noreen",
    testing: false,
    comment:
      "Using FUZE on Good Housekeeping towel sold on Amazon. Looking at more applications for spring 2027.",
    gala: false,
    timeline: "Current",
    country: "Global",
    find: { type: "BRAND", name: "Live Comfortably (Was Keeco)" },
    viktor: "Trying to get a meeting on their calendar.",
  },
  {
    key: "Loftex",
    contact: "Meg",
    testing: false,
    comment: "Target team meeting on Nov 24th.",
    gala: false,
    timeline: "2027 Q2",
    country: "China",
    find: { type: "BRAND", name: "Loftex" },
    viktor: "NO",
  },
  {
    key: "Loomvista",
    contact: "Chiraj",
    testing: false,
    comment: "Gala - call next week.",
    gala: true,
    timeline: "?",
    country: "India",
    create: { type: "FACTORY", name: "Loomvista", country: "India", stage: "LEAD" },
  },
  {
    key: "Maheen Textile",
    contact: "Mansoor",
    testing: false,
    comment: "No response.",
    gala: false,
    timeline: "?",
    country: "Pakistan",
    find: { type: "FACTORY", name: "Maheen Textile Mills" },
  },
  {
    key: "Mainstream International",
    contact: "Ian/David/Lori/Jim",
    testing: false,
    comment: "Visited Edison, NJ office - Jim Cox pushing team.",
    gala: false,
    timeline: "2027 Q3",
    country: "China",
    find: { type: "BRAND", name: "Mainstream International" },
    viktor: "NO",
  },
  {
    key: "Outdoor Collective (AMG)",
    contact: "Marix",
    testing: false,
    comment: "Costco shirts. HQ in Boulder, Colorado. Status quo.",
    gala: false,
    timeline: "?",
    country: "Global",
    create: {
      type: "BRAND",
      name: "Outdoor Collective (AMG)",
      country: "USA",
      stage: "PRESENTATION",
    },
  },
  {
    key: "PEM America",
    contact: "Kim",
    testing: false,
    comment: "Chris Moore left for a food processing co. Check in with Kim.",
    gala: true,
    timeline: "?",
    country: "Global",
    find: { type: "BRAND", name: "Pem-America" },
  },
  {
    key: "PVH",
    contact: "Yvonne",
    testing: false,
    comment: "Status quo.",
    gala: false,
    timeline: "?",
    country: "China",
    find: { type: "BRAND", name: "PVH Corp." },
  },
  {
    key: "Quince",
    contact: "Nathan",
    testing: false,
    comment: "Apparel - scrubs - status quo.",
    gala: false,
    timeline: "2027 Q1",
    country: "",
    find: { type: "BRAND", name: "Quince" },
    viktor:
      "Will know a lot more next week. Yunus is in Quince's offices to win production; looking for Q1 2027 on scrubs and Q3 on sheets via Quince.",
  },
  {
    key: "Sam's/Walmart",
    contact: "Bruce",
    testing: false,
    comment: "Visit mid-November. Also meeting with Scott Bingham.",
    gala: false,
    timeline: "2027 Q4",
    country: "Global",
    create: { type: "BRAND", name: "Sam's Club / Walmart", country: "USA", stage: "PRESENTATION" },
    viktor:
      "Visit scheduled for 19 November in Bentonville. Scott has his team attending. Also included activewear buyers and asked who else we want in the room. Prioritizing the opportunities.",
  },
  {
    key: "Sapphire Mills",
    contact: "Muhammed",
    testing: true,
    comment: "Testing for Danish customer; 2.5MM expressed amazing interest.",
    gala: false,
    timeline: "2027 Q2",
    country: "Pakistan",
    find: { type: "FACTORY", name: "Sapphire" },
    viktor: "No update. Danish customer is visiting Pakistan early December.",
  },
  {
    key: "Sharvaay",
    contact: "Daisey/Rohit",
    testing: true,
    comment: "99.99% on 50 washes. Meeting with brick & mortar stores.",
    gala: true,
    timeline: "2027 Q1",
    country: "India",
    create: { type: "FACTORY", name: "Sharvaay", country: "India", stage: "BRAND_TESTING" },
    viktor:
      "Testing complete, 99.99% results. Amazing potential; asked for an exclusive. Will visit Salt Lake with the CEO first week of December. She has booked meetings with Walmart and Sam's Club on terry towel.",
  },
  {
    key: "Taram",
    contact: "Hemanth",
    testing: false,
    comment: "Status quo.",
    gala: false,
    timeline: "?",
    country: "India",
    create: { type: "FACTORY", name: "Taram", country: "India", stage: "LEAD" },
  },
  {
    key: "Trident",
    contact: "Sonam/Shiv",
    testing: false,
    comment: "Target waiting on answer from them.",
    gala: false,
    timeline: "Current",
    country: "India",
    find: { type: "FACTORY", name: "Trident Group" },
    viktor: "Same as last week.",
  },
  {
    key: "Trident New York",
    contact: "Allison/Steven",
    testing: false,
    comment: "Follow-up meeting Nov 9th. Scott to join.",
    gala: false,
    timeline: "2027 Q1",
    country: "India",
    find: { type: "BRAND", name: "Trident Limited" },
    viktor:
      "Meeting with the USA decision-maker team Monday 9 November. We will prepare them for their upcoming Kohl's presentation on bed sheets and towels.",
  },
  {
    key: "U-Long High Tech Textile",
    contact: "Steven",
    testing: false,
    comment: "Testing results coming in. ICP good 100 washes.",
    gala: false,
    timeline: "?",
    country: "Taiwan",
    find: { type: "BRAND", name: "U-Long" },
  },
  {
    key: "Union Fabrics",
    contact: "Waqas",
    testing: true,
    comment: "Testing - wanted quote for small customer. Viktor helped.",
    gala: false,
    timeline: "2027 Q2",
    country: "Pakistan",
    create: { type: "FACTORY", name: "Union Fabrics", country: "Pakistan", stage: "BRAND_TESTING" },
    viktor: "Testing complete, they will send it to a third party for results.",
  },
  {
    key: "Welspun",
    contact: "Christine",
    testing: false,
    comment: "Status quo.",
    gala: false,
    timeline: "2027 Q1",
    country: "India",
    find: { type: "BRAND", name: "Welspun Living" },
    viktor: "NO",
  },
  {
    key: "Yunus",
    contact: "Faisal",
    testing: true,
    comment: "Testing multiple programs. They love pricing.",
    gala: false,
    timeline: "2027 Q1",
    country: "Pakistan",
    find: { type: "FACTORY", name: "Yunus Textile Mills Limited" },
    viktor:
      "Allison, the Target buyer, visited the factory this week for 4 days. FUZE was the main topic and she loves us. The bottom 20% of current bed-sheet SKUs have been identified and she wants production in Q1 2027 with sheets on shelf by Q3 2027. We meet Target corporate on the 24th. Yunus is also at Quince's offices to win production from them.",
  },
];

// Duplicate groups: keeper name → loser names (same entity type).
const MERGES: { type: "BRAND" | "FACTORY"; keeper: string; losers: string[] }[] = [
  { type: "BRAND", keeper: "Welspun Living", losers: ["Welspun", "Welspun Living Limited"] },
  { type: "FACTORY", keeper: "Trident Group", losers: ["Trident"] },
  { type: "BRAND", keeper: "1888 Mills", losers: ["1888 Mills, LLC"] },
  { type: "FACTORY", keeper: "Alkaram Textile Mills Pvt.Ltd", losers: ["Alkaram"] },
];

function quarterOf(t: string): string | null {
  const m = t.match(/(20\d\d)\s*Q([1-4])/);
  if (m) return `${m[1]} Q${m[2]}`;
  if (/current/i.test(t)) return "2026 Q4";
  return null;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const log: any[] = [];

  const [barth, viktor, andrew] = await Promise.all([
    prisma.user.findFirst({ where: { name: { startsWith: "Barth" }, status: "ACTIVE" } }),
    prisma.user.findFirst({ where: { name: { startsWith: "Viktor" }, status: "ACTIVE" } }),
    prisma.user.findFirst({
      where: { email: { in: ["andrew@fuze47.com", "andrew@801inc.com"] }, role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!barth || !viktor || !andrew)
    return NextResponse.json(
      { error: "users not found", barth: !!barth, viktor: !!viktor, andrew: !!andrew },
      { status: 500 },
    );

  // 1. Merges
  for (const m of MERGES) {
    const delegate = m.type === "BRAND" ? prisma.brand : prisma.factory;
    const keeper = await delegate.findFirst({ where: { name: m.keeper } });
    const losers = await delegate.findMany({ where: { name: { in: m.losers } } });
    if (!keeper) {
      log.push({ merge: m.keeper, skipped: "keeper not found" });
      continue;
    }
    const loserIds = losers.map((l) => l.id).filter((id) => id !== keeper.id);
    if (!loserIds.length) {
      log.push({ merge: m.keeper, skipped: "no losers (already merged)" });
      continue;
    }
    const r = await mergeEntities({
      entityType: m.type,
      keeperId: keeper.id,
      loserIds,
      dryRun: dry,
      actor: { id: andrew.id, name: andrew.name, email: andrew.email },
    });
    log.push({
      merge: m.keeper,
      into: keeper.id,
      losers: losers.map((l) => l.name),
      result: r.ok ? { moved: r.moved, husksRemoved: r.husksRemoved } : r.error,
    });
  }

  // 2 + 3 + 4 + 5
  const trackerWeek = mondayOf(new Date("2026-10-26T12:00:00Z"));
  const trackerAt = new Date("2026-10-26T16:00:00Z");
  const viktorWeek = mondayOf(new Date("2026-11-07T12:00:00Z"));
  const viktorAt = new Date("2026-11-07T18:00:00Z");
  let created = 0,
    assigned = 0,
    checkins = 0;

  for (const row of ROWS) {
    if (row.skip) continue;
    let type: "BRAND" | "FACTORY",
      id: string | null = null,
      name = "";
    if (row.find) {
      type = row.find.type;
      const delegate = type === "BRAND" ? prisma.brand : prisma.factory;
      const hit = await delegate.findFirst({
        where: { name: row.find.name },
        select: { id: true, name: true },
      });
      if (!hit) {
        log.push({ row: row.key, error: `not found: ${row.find.name}` });
        continue;
      }
      id = hit.id;
      name = hit.name;
    } else if (row.create) {
      type = row.create.type;
      const delegate = type === "BRAND" ? prisma.brand : prisma.factory;
      const existing = await delegate.findFirst({
        where: { name: row.create.name },
        select: { id: true },
      });
      if (existing) id = existing.id;
      else if (!dry) {
        const data: any =
          type === "BRAND"
            ? {
                name: row.create.name,
                pipelineStage: row.create.stage,
                researchData: { hubspotLocation: row.create.country },
                backgroundInfo: `Created from the BD pipeline tracker, 8 Nov 2026. Contact: ${row.contact}.`,
                salesRepId: barth.id,
              }
            : {
                name: row.create.name,
                country: row.create.country,
                pipelineStage: row.create.stage,
                salesRepId: barth.id,
                customerType: "Textile Mill",
              };
        const made = await delegate.create({ data, select: { id: true } });
        id = made.id;
        created++;
      } else {
        log.push({ row: row.key, wouldCreate: row.create });
        continue;
      }
      name = row.create.name;
    } else continue;

    const viktorPrimary = row.viktor !== undefined && row.viktor !== null;
    const primary = viktorPrimary ? viktor : barth;
    const support = viktorPrimary ? barth : viktor;
    const role = type === "BRAND" ? "ACCOUNT_MANAGER" : "FACTORY_LEAD";
    const quarter = quarterOf(row.timeline);

    if (!dry) {
      await prisma.entityManager.upsert({
        where: {
          entityType_entityId_userId_role: {
            entityType: type,
            entityId: id!,
            userId: primary.id,
            role,
          },
        },
        create: {
          entityType: type,
          entityId: id!,
          userId: primary.id,
          role,
          isPrimary: true,
          notes: "BD tracker seed 8 Nov 2026",
        },
        update: { isPrimary: true },
      });
      await prisma.entityManager.upsert({
        where: {
          entityType_entityId_userId_role: {
            entityType: type,
            entityId: id!,
            userId: support.id,
            role: "SUPPORT",
          },
        },
        create: {
          entityType: type,
          entityId: id!,
          userId: support.id,
          role: "SUPPORT",
          isPrimary: false,
          notes: "BD tracker seed 8 Nov 2026",
        },
        update: {},
      });
      assigned++;

      const patch: any = {
        galaLead: row.gala,
        lastActivityAt: viktorPrimary ? viktorAt : trackerAt,
      };
      if (quarter) patch.forecastQuarter = quarter;
      if (type === "BRAND") await prisma.brand.update({ where: { id: id! }, data: patch });
      else await prisma.factory.update({ where: { id: id! }, data: patch });

      // Tracker comment → check-in by Barth, week of 26 Oct
      const t1 = await prisma.accountCheckin.findFirst({
        where: { entityType: type, entityId: id!, userId: barth.id, weekOf: trackerWeek },
      });
      if (!t1 && row.comment) {
        await prisma.accountCheckin.create({
          data: {
            entityType: type,
            entityId: id!,
            userId: barth.id,
            kind: "UPDATE",
            weekOf: trackerWeek,
            note: `${row.comment}${row.contact ? ` (Contact: ${row.contact})` : ""}`,
            forecastAfter: quarter,
            createdAt: trackerAt,
          },
        });
        checkins++;
      }
      // Viktor's 7 Nov email → check-in by Viktor, week of 2 Nov
      if (row.viktor) {
        const t2 = await prisma.accountCheckin.findFirst({
          where: { entityType: type, entityId: id!, userId: viktor.id, weekOf: viktorWeek },
        });
        if (!t2) {
          await prisma.accountCheckin.create({
            data: {
              entityType: type,
              entityId: id!,
              userId: viktor.id,
              kind: row.viktor === "NO" ? "NONE" : "UPDATE",
              weekOf: viktorWeek,
              note: row.viktor === "NO" ? null : row.viktor,
              createdAt: viktorAt,
            },
          });
          checkins++;
        }
      }
    }
    log.push({
      row: row.key,
      type,
      id,
      name,
      primary: primary.name,
      quarter,
      created: !!row.create,
    });
  }

  // Tidy: the Karim brand carried a domain as its name.
  if (!dry)
    await prisma.brand.updateMany({
      where: { name: "karimgroup.org" },
      data: { name: "Karim Group" },
    });

  return NextResponse.json({ ok: true, dry, created, assigned, checkins, log });
}
