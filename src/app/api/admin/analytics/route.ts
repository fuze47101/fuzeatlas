/**
 * Analytics API Endpoint
 *
 * GET /api/admin/analytics
 *
 * Returns aggregate analytics data for the application.
 * Only accessible to ADMIN users.
 */

import { NextResponse, NextRequest } from 'next/server';
import { analyticsTracker } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  try {
    // Check user authorization - only ADMIN users can access
    const userRole = req.headers.get('x-user-role') || 'PUBLIC';

    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized. Only ADMIN users can access analytics.'
        },
        { status: 403 }
      );
    }

    // Parse query parameters for time range filtering
    const searchParams = req.nextUrl.searchParams;
    const startTimeParam = searchParams.get('startTime');
    const endTimeParam = searchParams.get('endTime');

    let startTime: number | undefined;
    let endTime: number | undefined;

    // Parse timestamps if provided
    if (startTimeParam) {
      const parsed = parseInt(startTimeParam, 10);
      if (!isNaN(parsed)) {
        startTime = parsed;
      }
    }

    if (endTimeParam) {
      const parsed = parseInt(endTimeParam, 10);
      if (!isNaN(parsed)) {
        endTime = parsed;
      }
    }

    // Get aggregate statistics
    const stats = analyticsTracker.getAggregateStats(startTime, endTime);

    return NextResponse.json({
      ok: true,
      data: stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Failed to retrieve analytics'
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual event tracking
 * Allows client or server components to track custom events
 */
export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role') || 'PUBLIC';
    const userId = req.headers.get('x-user-id') ?? undefined;
    const sessionId = req.headers.get('x-session-id') ?? undefined;

    const body = await req.json();
    const { eventType, metadata } = body;

    // Validate event type
    const validEventTypes = ['pageview', 'api_response', 'error', 'feature_usage', 'custom'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Track the event
    analyticsTracker.trackEvent({
      eventType,
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: metadata || {},
    });

    return NextResponse.json({
      ok: true,
      message: 'Event tracked successfully',
    });
  } catch (error: any) {
    console.error('[Analytics API] Error tracking event:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Failed to track event'
      },
      { status: 500 }
    );
  }
}
