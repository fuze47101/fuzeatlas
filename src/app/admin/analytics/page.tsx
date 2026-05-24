// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

type AnalyticsData = {
  ok: boolean;
  range: string;
  overview: {
    totalTests: number;
    passRate: number;
    avgTurnaround: number;
    activeBrands: number;
    activeFactories: number;
    testsThisPeriod: number;
    testsLastPeriod: number;
  };
  testsByType: Array<{ type: string; count: number; passRate: number }>;
  testsByMethod: Array<{ method: string; count: number; passRate: number }>;
  testsTrend: Array<{ date: string; count: number; passed: number }>;
  pipelineFlow: Array<{ stage: string; count: number; value: number }>;
  topBrands: Array<{ name: string; tests: number; passRate: number; stage: string }>;
  topFactories: Array<{
    name: string;
    tests: number;
    passRate: number;
    country: string;
  }>;
  labPerformance: Array<{
    name: string;
    tests: number;
    avgTurnaround: number;
  }>;
  icpDistribution: Array<{ tier: string; count: number; avgValue: number }>;
  washDurability: Array<{
    washCount: number;
    avgRetention: number;
    testCount: number;
  }>;
  complianceOverview: Array<{
    standard: string;
    tested: number;
    passed: number;
    rate: number;
  }>;
  recentActivity: Array<{ type: string; description: string; timestamp: string }>;
};

export default function AnalyticsDashboard() {
  const { t } = useI18n();
  const T = t.analyticsAdmin;
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError(null);
      // Auth is resolved server-side from the auth cookie via getCurrentUser().
      // We used to send hardcoded x-user-id/x-user-role headers here, but those
      // were untrusted client values and the API now ignores them — the cookie
      // is the source of truth. credentials: "include" makes sure it ships.
      const response = await fetch(`/api/admin/analytics-data?range=${range}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const json = await response.json();
      if (!json.ok) throw new Error(json.error || "API error");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    background: "#f0fafb",
    minHeight: "100vh",
    padding: "1rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: "2rem",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "2rem",
    fontWeight: "700",
    color: "#1A1A2E",
    margin: 0,
  };

  const rangeButtonContainerStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  };

  const rangeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem",
    border: "1px solid #00b4c3",
    background: active ? "#00b4c3" : "white",
    color: active ? "white" : "#00b4c3",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: "600",
    transition: "all 0.2s",
  });

  const kpiGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  };

  const kpiCardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: "0.5rem",
    padding: "1.5rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    border: "1px solid #e5e7eb",
  };

  const kpiLabelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.5rem",
  };

  const kpiValueStyle: React.CSSProperties = {
    fontSize: "2rem",
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: "0.5rem",
  };

  const kpiTrendStyle = (positive: boolean): React.CSSProperties => ({
    fontSize: "0.875rem",
    color: positive ? "#10b981" : "#ef4444",
    fontWeight: "600",
  });

  const chartsGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 500px), 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  };

  const chartContainerStyle: React.CSSProperties = {
    background: "white",
    borderRadius: "0.5rem",
    padding: "1.5rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    border: "1px solid #e5e7eb",
  };

  const chartTitleStyle: React.CSSProperties = {
    fontSize: "1.125rem",
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: "1rem",
    margin: "0 0 1rem 0",
  };

  const getPassRateColor = (rate: number): string => {
    if (rate >= 85) return "#10b981";
    if (rate >= 70) return "#f59e0b";
    return "#ef4444";
  };

  const trendPercentage = data
    ? data.overview.testsLastPeriod > 0
      ? Math.round(
          ((data.overview.testsThisPeriod - data.overview.testsLastPeriod) /
            data.overview.testsLastPeriod) *
            100,
        )
      : 0
    : 0;

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ ...chartContainerStyle, borderColor: "#ef4444" }}>
          <h2 style={{ ...chartTitleStyle, color: "#ef4444" }}>{T.errorTitle}</h2>
          <p style={{ color: "#ef4444" }}>{error}</p>
          <button
            onClick={() => fetchAnalytics()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            {T.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* HEADER */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>{T.title}</h1>
        <div style={rangeButtonContainerStyle}>
          {(["7d", "30d", "90d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={rangeButtonStyle(range === r)}
              disabled={loading}
            >
              {r === "all"
                ? T.rangeAll
                : r === "90d"
                  ? T.range90d
                  : r === "30d"
                    ? T.range30d
                    : T.range7d}
            </button>
          ))}
        </div>
      </div>

      {/* KPI CARDS */}
      {loading ? (
        <div style={kpiGridStyle}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...kpiCardStyle, opacity: 0.6 }}>
              <div style={kpiLabelStyle}>{T.loading}</div>
              <div style={{ ...kpiValueStyle, background: "#e5e7eb", height: "2rem" }} />
            </div>
          ))}
        </div>
      ) : (
        data && (
          <>
            <div style={kpiGridStyle}>
              {/* Total Tests */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>{T.kpiTotalTests}</div>
                <div style={kpiValueStyle}>{data.overview.testsThisPeriod}</div>
                <div style={kpiTrendStyle(trendPercentage >= 0)}>
                  {trendPercentage >= 0 ? "▲" : "▼"} {Math.abs(trendPercentage)}% {T.kpiVsPrev}
                </div>
              </div>

              {/* Pass Rate */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>{T.kpiPassRate}</div>
                <div style={kpiValueStyle}>
                  <span style={{ color: getPassRateColor(data.overview.passRate) }}>
                    {data.overview.passRate.toFixed(1)}%
                  </span>
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                  {((data.overview.testsThisPeriod * data.overview.passRate) / 100).toFixed(0)}{" "}
                  {T.kpiPassedSuffix}
                </div>
              </div>

              {/* Active Brands */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>{T.kpiActiveBrands}</div>
                <div style={kpiValueStyle}>{data.overview.activeBrands}</div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{T.kpiThisPeriod}</div>
              </div>

              {/* Avg Turnaround */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>{T.kpiAvgTurnaround}</div>
                <div style={kpiValueStyle}>{T.kpiTurnaroundUnitTpl.replace("{n}", String(data.overview.avgTurnaround))}</div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{T.kpiSubmissionToResult}</div>
              </div>
            </div>

            {/* CHARTS GRID */}
            <div style={chartsGridStyle}>
              {/* Tests Over Time */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartTestsOverTime}</h3>
                <div
                  style={{ height: "250px", display: "flex", alignItems: "flex-end", gap: "2px" }}
                >
                  {data.testsTrend.slice(-20).map((point, i) => {
                    const maxCount = Math.max(...data.testsTrend.map((p) => p.count), 1);
                    const height = (point.count / maxCount) * 200;
                    const passPercent = point.count > 0 ? (point.passed / point.count) * 100 : 0;
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${height}px`,
                          background: `linear-gradient(to top, ${getPassRateColor(
                            passPercent,
                          )} 0%, #ccc ${100 - passPercent}%)`,
                          borderRadius: "2px 2px 0 0",
                          cursor: "help",
                          title: `${point.date}: ${point.count} tests, ${point.passed} passed`,
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b7280",
                    marginTop: "0.5rem",
                    textAlign: "center",
                  }}
                >
                  {T.chartLast20}
                </div>
              </div>

              {/* Tests by Type */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartTestsByType}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {data.testsByType.slice(0, 6).map((item) => (
                    <div key={item.type}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.875rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>{item.type}</span>
                        <span style={{ color: "#6b7280" }}>
                          {item.count} ({item.passRate}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: "8px",
                          background: "#e5e7eb",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(item.count / Math.max(...data.testsByType.map((t) => t.count), 1)) * 100}%`,
                            background: getPassRateColor(item.passRate),
                            transition: "width 0.3s",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pipeline Funnel */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartPipelineFlow}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {data.pipelineFlow
                    .filter((p) => p.count > 0)
                    .slice(0, 8)
                    .map((stage) => {
                      const maxCount = Math.max(...data.pipelineFlow.map((s) => s.count), 1);
                      const width = (stage.count / maxCount) * 100;
                      return (
                        <div key={stage.stage}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: "#6b7280",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {stage.stage.replace(/_/g, " ")}
                          </div>
                          <div
                            style={{
                              height: "20px",
                              background: "#e5e7eb",
                              borderRadius: "4px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${width}%`,
                                background: "#00b4c3",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                paddingRight: "0.5rem",
                                color: width > 30 ? "white" : "transparent",
                                fontSize: "0.75rem",
                                fontWeight: "700",
                              }}
                            >
                              {stage.count}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* ICP Distribution */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartIcpTiers}</h3>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "250px",
                  }}
                >
                  {data.icpDistribution.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        width: "100%",
                      }}
                    >
                      {data.icpDistribution.map((item) => (
                        <div key={item.tier}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.875rem",
                              marginBottom: "0.25rem",
                            }}
                          >
                            <span style={{ fontWeight: "600" }}>{item.tier}</span>
                            <span style={{ color: "#6b7280" }}>
                              {item.count} (avg: {item.avgValue})
                            </span>
                          </div>
                          <div
                            style={{
                              height: "12px",
                              background: "#e5e7eb",
                              borderRadius: "4px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(item.count / Math.max(...data.icpDistribution.map((t) => t.count), 1)) * 100}%`,
                                background: "#00b4c3",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "#6b7280" }}>{T.chartNoIcp}</div>
                  )}
                </div>
              </div>

              {/* Top Brands */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartTopBrands}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {data.topBrands.slice(0, 5).map((brand) => (
                    <div key={brand.name}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.875rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>{brand.name}</span>
                        <span style={{ color: "#6b7280" }}>{brand.tests} {T.testsSuffix}</span>
                      </div>
                      <div
                        style={{
                          height: "12px",
                          background: "#e5e7eb",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${brand.passRate}%`,
                            background: getPassRateColor(brand.passRate),
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                        }}
                      >
                        {T.passRateSuffixTpl.replace("{pct}", String(brand.passRate)).replace("{stage}", brand.stage.replace(/_/g, " "))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Factories */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartTopFactories}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {data.topFactories.slice(0, 5).map((factory) => (
                    <div key={factory.name}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.875rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>{factory.name} 🌍</span>
                        <span style={{ color: "#6b7280" }}>{factory.tests} {T.testsSuffix}</span>
                      </div>
                      <div
                        style={{
                          height: "12px",
                          background: "#e5e7eb",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${factory.passRate}%`,
                            background: getPassRateColor(factory.passRate),
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                        }}
                      >
                        {T.passRateSuffixTpl.replace("{pct}", String(factory.passRate)).replace("{stage}", factory.country)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lab Performance */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartLabPerformance}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {data.labPerformance.slice(0, 6).map((lab) => (
                    <div key={lab.name}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.875rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>{lab.name}</span>
                        <span style={{ color: "#6b7280" }}>{lab.avgTurnaround}{T.daysSuffix}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          height: "8px",
                          background: "#e5e7eb",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(lab.tests / Math.max(...data.labPerformance.map((l) => l.tests), 1)) * 100}%`,
                            background: "#00b4c3",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wash Durability */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartWashDurability}</h3>
                {data.washDurability.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {data.washDurability.slice(0, 8).map((item) => (
                      <div key={item.washCount}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.75rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <span style={{ fontWeight: "600" }}>{item.washCount} {T.washesSuffix}</span>
                          <span style={{ color: "#6b7280" }}>{item.avgRetention}{T.retentionSuffix}</span>
                        </div>
                        <div
                          style={{
                            height: "8px",
                            background: "#e5e7eb",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${item.avgRetention}%`,
                              background: getPassRateColor(item.avgRetention),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#6b7280", textAlign: "center", paddingTop: "2rem" }}>
                    {T.chartNoDurability}
                  </div>
                )}
              </div>

              {/* Compliance Standards */}
              <div style={chartContainerStyle}>
                <h3 style={chartTitleStyle}>{T.chartCompliance}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {data.complianceOverview.slice(0, 6).map((item) => (
                    <div key={item.standard}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.75rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>{item.standard}</span>
                        <span style={{ color: "#6b7280" }}>
                          {item.passed}/{item.tested}
                        </span>
                      </div>
                      <div
                        style={{
                          height: "10px",
                          background: "#e5e7eb",
                          borderRadius: "4px",
                          overflow: "hidden",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${item.rate}%`,
                            background: getPassRateColor(item.rate),
                          }}
                        />
                        <div
                          style={{
                            height: "100%",
                            flex: 1,
                            background: "#fee2e2",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div style={chartContainerStyle}>
              <h3 style={chartTitleStyle}>{T.chartRecentActivity}</h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                {data.recentActivity.slice(0, 15).map((activity, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "0.75rem",
                      background: "#f9fafb",
                      borderRadius: "0.375rem",
                      borderLeft: "3px solid #00b4c3",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.875rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: "600", color: "#1A1A2E" }}>{activity.type}</span>
                      <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                        {activity.description}
                      </div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
