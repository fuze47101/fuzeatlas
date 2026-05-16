// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    // SECURITY — May 11 fix: previously this route read x-user-id/x-user-role
    // from spoof-able middleware headers, which silently ignored the
    // impersonation cookie. Net effect: an ADMIN running "View As" against
    // a FACTORY_USER still saw the full ADMIN dashboard with global counts
    // (1,351 fabrics, 2,576 brands, etc.) instead of being scoped to the
    // factory. Switching to getCurrentUser() honors the impersonation
    // cookie set by /api/admin/impersonate.
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = currentUser.id;
    const userRole = currentUser.role;
    const user = {
      id: currentUser.id,
      role: currentUser.role,
      brandId: currentUser.brandId,
      factoryId: currentUser.factoryId,
      distributorId: currentUser.distributorId,
    };

    // ─── COMMON QUERIES — now role-scoped ─────────────
    // For non-internal roles, counts are filtered to only what the user
    // is allowed to see. A factory user sees their own factory's fabrics
    // and submissions, not the global 1,351 / 2,576.
    const factoryScope = userRole === "FACTORY_USER" || userRole === "FACTORY_MANAGER"
      ? { factoryId: user.factoryId }
      : null;
    const brandScope = userRole === "BRAND_USER" || userRole === "BRAND_MANAGER"
      ? { brandId: user.brandId }
      : null;
    const distributorScope = userRole === "DISTRIBUTOR_USER" || userRole === "DISTRIBUTOR_MANAGER"
      ? { distributorId: user.distributorId }
      : null;
    const isInternalCounts = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "TESTING_MANAGER", "FABRIC_MANAGER"].includes(userRole);

    const [
      fabrics, brands, factories, distributors, labs,
      testRuns, icpResults, antibacterialResults, fungalResults, odorResults,
      submissions, contacts, allUsers, notes,
    ] = await Promise.all([
      // Fabrics
      isInternalCounts
        ? prisma.fabric.count()
        : factoryScope
          ? prisma.fabric.count({ where: { factoryId: factoryScope.factoryId } })
          : brandScope
            ? prisma.fabric.count({ where: { brandId: brandScope.brandId } })
            : 0,
      // Brands — only internal roles see the full brand count; entity users see 0 or their one brand
      isInternalCounts ? prisma.brand.count() : brandScope ? 1 : 0,
      // Factories — only internal roles see all; factory user sees 1 (their own)
      isInternalCounts ? prisma.factory.count() : factoryScope ? 1 : 0,
      // Distributors — only internal roles see the full directory
      isInternalCounts ? prisma.distributor.count({ where: { active: true } }) : 0,
      // Labs — visible to all (it's a service directory)
      prisma.lab.count(),
      // TestRuns — scoped through submission.factoryId for factory users
      isInternalCounts
        ? prisma.testRun.count()
        : factoryScope
          ? prisma.testRun.count({ where: { submission: { factoryId: factoryScope.factoryId } } })
          : brandScope
            ? prisma.testRun.count({ where: { submission: { brandId: brandScope.brandId } } })
            : 0,
      // Result counts — only internal roles get globals; entity users get 0
      isInternalCounts ? prisma.icpResult.count() : 0,
      isInternalCounts ? prisma.antibacterialResult.count() : 0,
      isInternalCounts ? prisma.fungalResult.count() : 0,
      isInternalCounts ? prisma.odorResult.count() : 0,
      // Submissions — factory users see their own
      isInternalCounts
        ? prisma.fabricSubmission.count()
        : factoryScope
          ? prisma.fabricSubmission.count({ where: { factoryId: factoryScope.factoryId } })
          : brandScope
            ? prisma.fabricSubmission.count({ where: { brandId: brandScope.brandId } })
            : 0,
      // Contacts — internal only
      isInternalCounts ? prisma.contact.count() : 0,
      // User count — internal only
      isInternalCounts ? prisma.user.count() : 0,
      // Notes — internal only (notes are CRM-internal)
      isInternalCounts ? prisma.note.count() : 0,
    ]);

    // Pipeline breakdown
    const stages = [
      "LEAD","PRESENTATION","BRAND_TESTING","FACTORY_ONBOARDING",
      "FACTORY_TESTING","PRODUCTION","BRAND_EXPANSION","ARCHIVE","CUSTOMER_WON",
    ];
    const pipeline = await Promise.all(
      stages.map(async (stage) => ({
        stage,
        count: await prisma.brand.count({ where: { pipelineStage: stage } }),
      }))
    );

    // Test type breakdown
    const testTypes = await prisma.testRun.groupBy({
      by: ["testType"],
      _count: true,
    });

    // ─── Role-Specific Data Fetching ─────────────

    let roleSpecificData: any = {};

    // ADMIN / EMPLOYEE: Everything + admin features
    if (userRole === "ADMIN" || userRole === "EMPLOYEE") {
      const [recentFabrics, recentTests] = await Promise.all([
        prisma.fabric.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, fuzeNumber: true, construction: true, color: true,
            createdAt: true,
            brand: { select: { name: true } },
            factory: { select: { name: true } },
          },
        }),
        prisma.testRun.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, testType: true, testDate: true, createdAt: true,
            testReportNumber: true,
            lab: { select: { name: true } },
            submission: { select: { fuzeFabricNumber: true, brand: { select: { name: true } } } },
            icpResult: true,
            abResult: true,
          },
        }),
      ]);

      // Admin-specific data
      let upcomingMeetings = 0, unreadNotifications = 0, pendingAccessRequests = 0;
      let recentAuditLogs: any[] = [];

      try {
        upcomingMeetings = await prisma.meeting.count({
          where: { startTime: { gte: new Date() } },
        });
      } catch {
        // Meeting table may not exist
      }

      try {
        unreadNotifications = userId ? await prisma.notification.count({
          where: { userId, read: false },
        }) : 0;
      } catch {
        // Notification table may not exist
      }

      try {
        pendingAccessRequests = await prisma.accessRequest.count({
          where: { status: "PENDING" },
        });
      } catch {
        // AccessRequest table may not exist
      }

      try {
        recentAuditLogs = await prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          select: { id: true, action: true, entity: true, description: true, createdAt: true, user: { select: { name: true } } },
        });
      } catch {
        // AuditLog table may not exist
      }

      roleSpecificData = {
        recentFabrics,
        recentTests,
        upcomingMeetings,
        unreadNotifications,
        pendingAccessRequests,
        recentAuditLogs,
      };
    }

    // SALES_MANAGER / SALES_REP / BD_REP: Pipeline focused
    // BD_REP added May 11 — Ryan was hitting the admin fallback which
    // 403s on /api/dashboard for non-admins, producing the
    // "KPI link leads to error page" ticket. BD reps are sales-shaped.
    else if (userRole === "SALES_MANAGER" || userRole === "SALES_REP" || userRole === "BD_REP") {
      let salesBrands: any[] = [];
      let upcomingMeetings = 0;
      let brandEngagementScores: any[] = [];
      let recentActivity: any[] = [];

      try {
        // Get brands assigned to this sales rep
        if ((userRole === "SALES_REP" || userRole === "BD_REP") && userId) {
          salesBrands = await prisma.brand.findMany({
            where: { salesRepId: userId },
            select: { id: true, name: true, pipelineStage: true },
            take: 20,
          });
        } else if (userRole === "SALES_MANAGER" && userId) {
          // Manager sees all reps they manage
          salesBrands = await prisma.brand.findMany({
            select: { id: true, name: true, pipelineStage: true },
            take: 20,
          });
        }
      } catch {
        // brands may not have salesRepId
      }

      try {
        upcomingMeetings = await prisma.meeting.count({
          where: { startTime: { gte: new Date() } },
        });
      } catch {
        // Meeting table may not exist
      }

      try {
        brandEngagementScores = await prisma.brandEngagement.findMany({
          take: 5,
          orderBy: { overallScore: "desc" },
          select: {
            id: true,
            brand: { select: { id: true, name: true } },
            overallScore: true,
            engagementTrend: true,
          },
        });
      } catch {
        // BrandEngagement table may not exist
      }

      try {
        recentActivity = await prisma.note.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, content: true, createdAt: true },
        });
      } catch {
        // Note table may not exist
      }

      roleSpecificData = {
        salesBrands,
        upcomingMeetings,
        brandEngagementScores,
        recentActivity,
        brandCount: salesBrands.length,
      };
    }

    // TESTING_MANAGER: Testing focused
    else if (userRole === "TESTING_MANAGER") {
      let recentTests: any[] = [];
      let testTypeBreakdown: any[] = [];
      let upcomingMeetings = 0;

      try {
        recentTests = await prisma.testRun.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, testType: true, testDate: true, testStatus: true,
            lab: { select: { name: true } },
            submission: { select: { fuzeFabricNumber: true, brand: { select: { name: true } } } },
          },
        });
      } catch {
        // TestRun table may not have all fields
      }

      try {
        testTypeBreakdown = await prisma.testRun.groupBy({
          by: ["testType"],
          _count: true,
        });
      } catch {
        // TestRun table may not exist
      }

      try {
        upcomingMeetings = await prisma.meeting.count({
          where: {
            startTime: { gte: new Date() },
            meetingType: { in: ["TESTING_REVIEW", "LAB_REVIEW"] },
          },
        });
      } catch {
        // Meeting table may not exist
      }

      roleSpecificData = {
        recentTests,
        testTypeBreakdown: testTypeBreakdown.map((t) => ({ type: t.testType, count: t._count })),
        upcomingMeetings,
      };
    }

    // FABRIC_MANAGER: Fabric focused
    else if (userRole === "FABRIC_MANAGER") {
      let recentFabrics: any[] = [];
      let fabricCount = 0;
      let submissionsAwaitingReview = 0;
      let recipeLibraryMatches = 0;

      try {
        fabricCount = await prisma.fabric.count();
      } catch {
        // Fabric table may not exist
      }

      try {
        recentFabrics = await prisma.fabric.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, fuzeNumber: true, construction: true, color: true,
            brand: { select: { name: true } },
            factory: { select: { name: true } },
          },
        });
      } catch {
        // Fabric table may not exist
      }

      try {
        submissionsAwaitingReview = await prisma.fabricSubmission.count({
          where: { reviewStatus: "PENDING" },
        });
      } catch {
        // FabricSubmission table may not have reviewStatus
      }

      try {
        recipeLibraryMatches = await prisma.fabricRecipe.count();
      } catch {
        // FabricRecipe table may not exist
      }

      roleSpecificData = {
        recentFabrics,
        fabricCount,
        submissionsAwaitingReview,
        recipeLibraryMatches,
      };
    }

    // FACTORY_MANAGER / FACTORY_USER: Factory focused
    else if (userRole === "FACTORY_MANAGER" || userRole === "FACTORY_USER") {
      const factoryId = user?.factoryId;
      let factoryName = "";
      let factoryFabrics: any[] = [];
      let factoryTestResults: any[] = [];
      let upcomingMeetings = 0;

      if (factoryId) {
        const factory = await prisma.factory.findUnique({
          where: { id: factoryId },
          select: { name: true },
        });
        factoryName = factory?.name || "";

        try {
          factoryFabrics = await prisma.fabric.findMany({
            where: { factoryId },
            take: 8,
            orderBy: { createdAt: "desc" },
            select: {
              id: true, fuzeNumber: true, construction: true,
              brand: { select: { name: true } },
            },
          });
        } catch {
          // Fabric table may not exist
        }

        try {
          factoryTestResults = await prisma.testRun.findMany({
            where: { submission: { fabric: { factoryId } } },
            take: 8,
            orderBy: { createdAt: "desc" },
            select: {
              id: true, testType: true, testStatus: true,
              submission: { select: { fuzeFabricNumber: true } },
            },
          });
        } catch {
          // TestRun table may not exist
        }

        try {
          upcomingMeetings = await prisma.meeting.count({
            where: {
              startTime: { gte: new Date() },
              meetingType: { in: ["FACTORY_KICKOFF", "PRODUCTION_REVIEW"] },
            },
          });
        } catch {
          // Meeting table may not exist
        }
      }

      roleSpecificData = {
        factoryId,
        factoryName,
        factoryFabrics,
        factoryTestResults,
        upcomingMeetings,
      };
    }

    // BRAND_USER: Brand portal view
    else if (userRole === "BRAND_USER") {
      const brandId = user?.brandId;
      let brandName = "";
      let approvedTests: any[] = [];
      let upcomingMeetings = 0;

      if (brandId) {
        const brand = await prisma.brand.findUnique({
          where: { id: brandId },
          select: { name: true },
        });
        brandName = brand?.name || "";

        try {
          approvedTests = await prisma.testRun.findMany({
            where: {
              brandVisible: true,
              submission: { brandId },
            },
            take: 8,
            orderBy: { createdAt: "desc" },
            select: {
              id: true, testType: true, testStatus: true, testDate: true,
              testReportNumber: true,
              submission: { select: { fuzeFabricNumber: true } },
            },
          });
        } catch {
          // TestRun table may not exist
        }

        try {
          upcomingMeetings = await prisma.meeting.count({
            where: {
              startTime: { gte: new Date() },
              brandId,
            },
          });
        } catch {
          // Meeting table may not exist
        }
      }

      roleSpecificData = {
        brandId,
        brandName,
        approvedTests,
        upcomingMeetings,
      };
    }

    // DISTRIBUTOR_USER: Distributor overview
    else if (userRole === "DISTRIBUTOR_USER") {
      const distributorId = user?.distributorId;
      let distributorBrands: any[] = [];
      let factoriesCount = 0;

      if (distributorId) {
        try {
          distributorBrands = await prisma.brand.findMany({
            take: 10,
            select: { id: true, name: true },
          });
        } catch {
          // Brand table may not exist
        }

        try {
          factoriesCount = await prisma.factory.count();
        } catch {
          // Factory table may not exist
        }
      }

      roleSpecificData = {
        distributorId,
        distributorBrands,
        factoriesCount,
      };
    }

    // ─── Internal-only data (pipeline, revenue, test requests) ─────────────
    // Only fetch for internal roles — not for BRAND_USER, FACTORY_USER, DISTRIBUTOR_USER
    const isInternalRole = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "TESTING_MANAGER", "FABRIC_MANAGER", "FACTORY_MANAGER"].includes(userRole);

    let revenueData: any = null;
    let testRequestStats: any = null;

    if (isInternalRole) {
      const allProjects = await prisma.project.findMany({
        where: { projectedValue: { not: null } },
        select: { projectedValue: true, actualValue: true, probability: true, stage: true },
      });

      const totalPipeline = allProjects.reduce((s, p) => s + (p.projectedValue || 0), 0);
      const weightedForecast = allProjects.reduce(
        (s, p) => s + (p.projectedValue || 0) * ((p.probability || 0) / 100), 0
      );
      const actualRevenue = allProjects.reduce((s, p) => s + (p.actualValue || 0), 0);

      const invoiceMetrics = await prisma.invoice.groupBy({
        by: ["status"],
        _sum: { amount: true },
        _count: { id: true },
      });
      const invoicePaid = invoiceMetrics.find((m) => m.status === "PAID")?._sum?.amount || 0;
      const invoiceOutstanding =
        (invoiceMetrics.find((m) => m.status === "SENT")?._sum?.amount || 0) +
        (invoiceMetrics.find((m) => m.status === "DRAFT")?._sum?.amount || 0) +
        (invoiceMetrics.find((m) => m.status === "OVERDUE")?._sum?.amount || 0);

      const projectPipeline = await prisma.project.groupBy({
        by: ["stage"],
        _count: { id: true },
        _sum: { projectedValue: true },
      });

      revenueData = {
        totalPipeline: Math.round(totalPipeline * 100) / 100,
        weightedForecast: Math.round(weightedForecast * 100) / 100,
        actualRevenue: Math.round(actualRevenue * 100) / 100,
        invoicePaid: Math.round(invoicePaid * 100) / 100,
        invoiceOutstanding: Math.round(invoiceOutstanding * 100) / 100,
        dealCount: allProjects.length,
        projectPipeline: projectPipeline.map((p) => ({
          stage: p.stage,
          count: p._count.id,
          value: p._sum.projectedValue || 0,
        })),
      };

      // Test Request metrics
      testRequestStats = { pending: 0, approved: 0, inTesting: 0, complete: 0, total: 0, estimatedCost: 0 };
      try {
        const trStats = await prisma.testRequest.groupBy({
          by: ["status"],
          _count: { id: true },
          _sum: { estimatedCost: true },
        });
        testRequestStats.total = trStats.reduce((s, r) => s + r._count.id, 0);
        testRequestStats.pending = trStats.find((r) => r.status === "PENDING_APPROVAL")?._count?.id || 0;
        testRequestStats.approved = trStats.find((r) => r.status === "APPROVED")?._count?.id || 0;
        testRequestStats.inTesting = (trStats.find((r) => r.status === "SUBMITTED")?._count?.id || 0) +
          (trStats.find((r) => r.status === "IN_PROGRESS")?._count?.id || 0);
        testRequestStats.complete = trStats.find((r) => r.status === "COMPLETE")?._count?.id || 0;
        testRequestStats.estimatedCost = trStats.reduce((s, r) => s + (r._sum.estimatedCost || 0), 0);
      } catch {
        // TestRequest table may not exist yet
      }
    }

    // Build response — only include internal data for internal roles
    const response: any = {
      ok: true,
      role: userRole,
      userId,
      ...roleSpecificData,
    };

    if (isInternalRole) {
      response.counts = {
        fabrics, brands, factories, distributors, labs,
        testRuns, icpResults, antibacterialResults, fungalResults, odorResults,
        submissions, contacts, users: allUsers, notes,
      };
      response.pipeline = pipeline;
      response.testTypes = testTypes.map((t) => ({ type: t.testType, count: t._count }));
      response.testRequests = testRequestStats;
      response.revenue = revenueData;
    }

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
