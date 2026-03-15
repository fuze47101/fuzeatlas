/**
 * Analytics and Web Vitals Tracking for FUZE Atlas
 *
 * Provides server-side event tracking and analytics aggregation.
 *
 * PRODUCTION NOTE: For production deployments, upgrade to:
 * - Vercel Analytics: Built-in Next.js integration with Core Web Vitals
 * - PostHog: Self-hosted or cloud analytics with advanced features
 * - npm install posthog-js @vercel/analytics
 */

interface AnalyticsEvent {
  eventType: 'pageview' | 'api_response' | 'error' | 'feature_usage' | 'custom';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  metadata: Record<string, any>;
  duration?: number; // in milliseconds
  statusCode?: number;
  errorMessage?: string;
}

interface AggregateStats {
  totalEvents: number;
  pageViews: number;
  apiRequests: number;
  errors: number;
  avgResponseTime: number;
  errorRate: number;
  featureUsage: Record<string, number>;
  topPages: Array<{ path: string; count: number }>;
  topErrors: Array<{ error: string; count: number }>;
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * In-memory buffer for analytics events
 * In production, these should be persisted to a database or sent to external service
 */
class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private sessionMap: Map<string, number> = new Map(); // sessionId -> event count
  private maxBufferSize: number = 10000; // Keep last 10k events

  /**
   * Track an analytics event
   */
  trackEvent(event: AnalyticsEvent): void {
    // Maintain buffer size limit
    if (this.events.length >= this.maxBufferSize) {
      this.events.shift(); // Remove oldest event
    }

    this.events.push(event);

    // Track session activity
    if (event.sessionId) {
      const count = this.sessionMap.get(event.sessionId) || 0;
      this.sessionMap.set(event.sessionId, count + 1);
    }
  }

  /**
   * Track a page view
   */
  trackPageView(
    path: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): void {
    this.trackEvent({
      eventType: 'pageview',
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: {
        path,
        ...(metadata || {}),
      },
    });
  }

  /**
   * Track API response time
   */
  trackApiResponse(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    userId?: string,
    sessionId?: string
  ): void {
    this.trackEvent({
      eventType: 'api_response',
      timestamp: Date.now(),
      userId,
      sessionId,
      duration,
      statusCode,
      metadata: {
        endpoint,
        method,
        slow: duration > 1000, // Mark as slow if > 1s
      },
    });
  }

  /**
   * Track errors
   */
  trackError(
    error: string,
    statusCode: number,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): void {
    this.trackEvent({
      eventType: 'error',
      timestamp: Date.now(),
      userId,
      sessionId,
      statusCode,
      errorMessage: error,
      metadata: metadata || {},
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(
    feature: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): void {
    this.trackEvent({
      eventType: 'feature_usage',
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: {
        feature,
        ...(metadata || {}),
      },
    });
  }

  /**
   * Get all events (for debugging)
   */
  getAllEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Get events within a time range
   */
  getEventsByTimeRange(startTime: number, endTime: number): AnalyticsEvent[] {
    return this.events.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime
    );
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
    this.sessionMap.clear();
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.events.length;
  }

  /**
   * Aggregate statistics from tracked events
   */
  getAggregateStats(startTime?: number, endTime?: number): AggregateStats {
    const now = Date.now();
    const start = startTime || now - 24 * 60 * 60 * 1000; // Default: last 24 hours
    const end = endTime || now;

    const relevantEvents = this.events.filter(
      (e) => e.timestamp >= start && e.timestamp <= end
    );

    const stats: AggregateStats = {
      totalEvents: relevantEvents.length,
      pageViews: 0,
      apiRequests: 0,
      errors: 0,
      avgResponseTime: 0,
      errorRate: 0,
      featureUsage: {},
      topPages: [],
      topErrors: [],
      timeRange: { start, end },
    };

    const pageViewMap = new Map<string, number>();
    const errorMap = new Map<string, number>();
    let totalApiDuration = 0;
    let apiCount = 0;

    for (const event of relevantEvents) {
      switch (event.eventType) {
        case 'pageview':
          stats.pageViews++;
          const path = event.metadata?.path || 'unknown';
          pageViewMap.set(path, (pageViewMap.get(path) || 0) + 1);
          break;

        case 'api_response':
          stats.apiRequests++;
          if (event.duration) {
            totalApiDuration += event.duration;
            apiCount++;
          }
          break;

        case 'error':
          stats.errors++;
          const errorMsg = event.errorMessage || 'unknown error';
          errorMap.set(errorMsg, (errorMap.get(errorMsg) || 0) + 1);
          break;

        case 'feature_usage':
          const feature = event.metadata?.feature || 'unknown';
          stats.featureUsage[feature] =
            (stats.featureUsage[feature] || 0) + 1;
          break;
      }
    }

    // Calculate averages
    if (apiCount > 0) {
      stats.avgResponseTime = Math.round(totalApiDuration / apiCount);
    }

    if (stats.totalEvents > 0) {
      stats.errorRate = Math.round((stats.errors / stats.totalEvents) * 10000) / 100; // percentage
    }

    // Get top pages
    stats.topPages = Array.from(pageViewMap.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top errors
    stats.topErrors = Array.from(errorMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }
}

/**
 * Global analytics tracker instance
 */
export const analyticsTracker = new AnalyticsTracker();

/**
 * Middleware helper to track all requests
 * Add to your middleware or route handlers
 */
export function createAnalyticsMiddleware() {
  return (
    req: any,
    res: any,
    next: () => void
  ) => {
    const startTime = Date.now();
    const userId = req.headers['x-user-id'];
    const sessionId = req.headers['x-session-id'];

    // Track page view for GET requests
    if (req.method === 'GET' && !req.url.startsWith('/api')) {
      analyticsTracker.trackPageView(
        req.url,
        userId,
        sessionId
      );
    }

    // Wrap response to track API responses
    const originalJson = res.json;
    res.json = function (data: any) {
      const duration = Date.now() - startTime;
      analyticsTracker.trackApiResponse(
        req.url,
        req.method,
        duration,
        res.statusCode,
        userId,
        sessionId
      );
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Export types for use in other modules
 */
export type { AnalyticsEvent, AggregateStats };
