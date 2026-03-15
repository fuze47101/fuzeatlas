// @ts-nocheck
"use client";

import { useState, useEffect } from "react";

interface ComplianceCheck {
  standard: string;
  passed: boolean;
  detail: string;
  threshold: string;
  actual: string;
}

interface Anomaly {
  severity: "info" | "warning" | "critical";
  category: string;
  message: string;
}

interface WashDurability {
  retentionPercent: number | null;
  trend: "stable" | "declining" | "improving" | "unknown";
  projectedWashLimit: number | null;
}

interface TestInterpretation {
  summary: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  fuzeTier: string | null;
  compliance: ComplianceCheck[];
  anomalies: Anomaly[];
  washDurability: WashDurability | null;
  recommendations: string[];
  detailedAnalysis: string;
}

interface Props {
  testRunId: string;
  onLoaded?: (interpretation: TestInterpretation) => void;
}

const TEAL = "#00b4c3";
const DARK = "#1A1A2E";

export default function TestInterpretation({ testRunId, onLoaded }: Props) {
  const [interpretation, setInterpretation] = useState<TestInterpretation | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState(false);

  useEffect(() => {
    if (!testRunId) return;

    const fetchInterpretation = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tests/${testRunId}/interpret`);
        const data = await response.json();

        if (data.ok && data.interpretation) {
          setInterpretation(data.interpretation);
          if (onLoaded) onLoaded(data.interpretation);
        } else {
          setError(data.error || "Failed to load interpretation");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInterpretation();
  }, [testRunId, onLoaded]);

  const handleRegenerate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tests/${testRunId}/interpret`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.ok && data.interpretation) {
        setInterpretation(data.interpretation);
        if (onLoaded) onLoaded(data.interpretation);
      } else {
        setError(data.error || "Failed to regenerate interpretation");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "2rem",
          minHeight: "200px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: `4px solid ${TEAL}`,
            borderTop: "4px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          backgroundColor: "#fee2e2",
          border: "1px solid #fecaca",
          borderRadius: "0.75rem",
          padding: "1rem",
          color: "#991b1b",
        }}
      >
        <p style={{ margin: 0, fontWeight: 500 }}>Error loading interpretation</p>
        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>{error}</p>
      </div>
    );
  }

  if (!interpretation) {
    return (
      <div
        style={{
          backgroundColor: "#f3f4f6",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
          color: "#4b5563",
        }}
      >
        No interpretation available
      </div>
    );
  }

  // Risk score color and label
  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return { bg: "#fee2e2", border: "#fecaca", text: "#991b1b" };
      case "high":
        return { bg: "#fef3c7", border: "#fde68a", text: "#92400e" };
      case "medium":
        return { bg: "#fef08a", border: "#fde047", text: "#713f12" };
      case "low":
        return { bg: "#dcfce7", border: "#bbf7d0", text: "#166534" };
      default:
        return { bg: "#f0fdf4", border: "#dcfce7", text: "#166534" };
    }
  };

  const riskColor = getRiskColor(interpretation.riskLevel);

  // FUZE tier colors
  const getTierColor = (tier: string | null) => {
    if (!tier) return { bg: "#f3f4f6", border: "#d1d5db", text: "#374151" };
    if (tier === "F1+") return { bg: "#fee2e2", border: "#fecaca", text: "#991b1b" };
    if (tier === "F1") return { bg: "#fef3c7", border: "#fde68a", text: "#92400e" };
    if (tier === "F2") return { bg: "#dbeafe", border: "#bfdbfe", text: "#1e40af" };
    if (tier === "F3") return { bg: "#dcfce7", border: "#bbf7d0", text: "#166534" };
    return { bg: "#f0fdf4", border: "#dcfce7", text: "#166534" }; // F4
  };

  const tierColor = getTierColor(interpretation.fuzeTier);

  // Anomaly colors
  const getAnomalyColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return { bg: "#fee2e2", icon: "⚠️" };
      case "warning":
        return { bg: "#fef3c7", icon: "⚡" };
      default:
        return { bg: "#dbeafe", icon: "ℹ️" };
    }
  };

  // Calculate risk gauge
  const gaugeColor = (() => {
    if (interpretation.riskScore >= 75) return "#dc2626";
    if (interpretation.riskScore >= 50) return "#f59e0b";
    if (interpretation.riskScore >= 25) return "#eab308";
    return "#22c55e";
  })();

  return (
    <div
      style={{
        display: "grid",
        gap: "1.5rem",
      }}
    >
      {/* Summary Card */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        <p style={{ margin: "0 0 1rem 0", color: "#6b7280", fontSize: "0.875rem" }}>
          AI INTERPRETATION
        </p>
        <p
          style={{
            margin: "0 0 1.5rem 0",
            fontSize: "1rem",
            lineHeight: "1.5",
            color: DARK,
          }}
        >
          {interpretation.summary}
        </p>

        {/* Risk Score and Tier Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          {/* Risk Score */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1rem",
              backgroundColor: riskColor.bg,
              border: `1px solid ${riskColor.border}`,
              borderRadius: "0.5rem",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                border: `4px solid ${gaugeColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "white",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: gaugeColor,
                }}
              >
                {interpretation.riskScore}
              </span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>
                RISK SCORE
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0 0",
                  fontSize: "1rem",
                  fontWeight: "600",
                  color: riskColor.text,
                  textTransform: "uppercase",
                }}
              >
                {interpretation.riskLevel}
              </p>
            </div>
          </div>

          {/* FUZE Tier */}
          {interpretation.fuzeTier && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem",
                backgroundColor: tierColor.bg,
                border: `1px solid ${tierColor.border}`,
                borderRadius: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "0.5rem",
                  backgroundColor: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: tierColor.text,
                  }}
                >
                  {interpretation.fuzeTier}
                </span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>
                  FUZE TIER
                </p>
                <p
                  style={{
                    margin: "0.25rem 0 0 0",
                    fontSize: "0.875rem",
                    color: tierColor.text,
                  }}
                >
                  Silver Retention
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compliance Checklist */}
      {interpretation.compliance.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            overflow: "hidden",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "600", color: DARK }}>
              Compliance Assessment
            </h3>
          </div>
          <div style={{ padding: "1rem" }}>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {interpretation.compliance.map((comp, idx) => {
                const passed = comp.passed;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: "1rem",
                      padding: "0.75rem",
                      backgroundColor: passed ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${passed ? "#dcfce7" : "#fee2e2"}`,
                      borderRadius: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: passed ? "#dcfce7" : "#fee2e2",
                        flexShrink: 0,
                        fontSize: "1rem",
                      }}
                    >
                      {passed ? "✓" : "✕"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: DARK,
                        }}
                      >
                        {comp.standard}
                      </p>
                      <p
                        style={{
                          margin: "0.25rem 0 0 0",
                          fontSize: "0.875rem",
                          color: "#6b7280",
                          lineHeight: "1.4",
                        }}
                      >
                        {comp.detail}
                      </p>
                      <div
                        style={{
                          margin: "0.5rem 0 0 0",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "1rem",
                          fontSize: "0.75rem",
                          color: "#6b7280",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: "500" }}>Threshold:</span> {comp.threshold}
                        </div>
                        <div>
                          <span style={{ fontWeight: "500" }}>Actual:</span> {comp.actual}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {interpretation.anomalies.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            overflow: "hidden",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: "600",
                color: DARK,
              }}
            >
              Quality Flags
            </h3>
          </div>
          <div style={{ padding: "1rem" }}>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {interpretation.anomalies.map((anom, idx) => {
                const color = getAnomalyColor(anom.severity);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      backgroundColor: color.bg,
                      borderRadius: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                      {color.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: DARK,
                          textTransform: "uppercase",
                        }}
                      >
                        {anom.severity} - {anom.category}
                      </p>
                      <p
                        style={{
                          margin: "0.25rem 0 0 0",
                          fontSize: "0.875rem",
                          color: "#4b5563",
                          lineHeight: "1.4",
                        }}
                      >
                        {anom.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wash Durability */}
      {interpretation.washDurability && (
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            overflow: "hidden",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: "600",
                color: DARK,
              }}
            >
              Wash Durability
            </h3>
          </div>
          <div style={{ padding: "1rem" }}>
            {interpretation.washDurability.retentionPercent != null && (
              <div style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      color: DARK,
                    }}
                  >
                    Silver Retention
                  </span>
                  <span style={{ fontSize: "0.875rem", fontWeight: "600", color: TEAL }}>
                    {interpretation.washDurability.retentionPercent.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#e5e7eb",
                    borderRadius: "9999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${interpretation.washDurability.retentionPercent}%`,
                      height: "100%",
                      backgroundColor: TEAL,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            )}

            {interpretation.washDurability.projectedWashLimit && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #dcfce7",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  color: "#166534",
                }}
              >
                <strong>Projected durability:</strong> Silver content should remain
                above F4 minimum through approximately{" "}
                <strong>{interpretation.washDurability.projectedWashLimit} washes</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {interpretation.recommendations.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            overflow: "hidden",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: "600",
                color: DARK,
              }}
            >
              Recommendations
            </h3>
          </div>
          <div style={{ padding: "1rem" }}>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.5rem",
                display: "grid",
                gap: "0.5rem",
              }}
            >
              {interpretation.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: "0.875rem",
                    color: "#4b5563",
                    lineHeight: "1.4",
                  }}
                >
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Detailed Analysis */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          overflow: "hidden",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        <button
          onClick={() => setExpandedAnalysis(!expandedAnalysis)}
          style={{
            width: "100%",
            padding: "1.5rem",
            border: "none",
            background: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "1rem",
            fontWeight: "600",
            color: DARK,
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Detailed Analysis
          <svg
            style={{
              width: "20px",
              height: "20px",
              color: "#9ca3af",
              transition: "transform 0.2s",
              transform: expandedAnalysis ? "rotate(180deg)" : "rotate(0deg)",
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>

        {expandedAnalysis && (
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              padding: "1.5rem",
              backgroundColor: "#f9fafb",
            }}
          >
            <div
              style={{
                fontSize: "0.875rem",
                lineHeight: "1.6",
                color: "#4b5563",
                whiteSpace: "pre-wrap",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {interpretation.detailedAnalysis}
            </div>
          </div>
        )}
      </div>

      {/* Regenerate Button */}
      <button
        onClick={handleRegenerate}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: TEAL,
          color: "white",
          border: "none",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          fontWeight: "500",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          transition: "opacity 0.2s, background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.backgroundColor = "#0099a8";
        }}
        onMouseLeave={(e) => {
          if (!loading) e.currentTarget.style.backgroundColor = TEAL;
        }}
      >
        {loading ? "Regenerating..." : "Regenerate Interpretation"}
      </button>
    </div>
  );
}
