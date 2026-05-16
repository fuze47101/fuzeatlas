// @ts-nocheck

/**
 * FUZE Atlas AI Test Interpreter
 *
 * A rules-based expert system that interprets antimicrobial test results
 * without requiring an external LLM API. Understands FUZE's testing standards
 * and provides comprehensive compliance analysis.
 */

// ─────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

export interface TestInterpretation {
  summary: string;
  riskScore: number; // 0 (safe) to 100 (critical)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  fuzeTier: string | null; // F1+, F1, F2, F3, F4, or null
  compliance: ComplianceCheck[];
  anomalies: Anomaly[];
  washDurability: WashDurability | null;
  recommendations: string[];
  detailedAnalysis: string;
}

export interface ComplianceCheck {
  standard: string;
  passed: boolean;
  detail: string;
  threshold: string;
  actual: string;
}

export interface Anomaly {
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
}

export interface WashDurability {
  retentionPercent: number | null;
  trend: 'stable' | 'declining' | 'improving' | 'unknown';
  projectedWashLimit: number | null;
}

// ─────────────────────────────────────────────────────────────
// TEST RESULT STRUCTURES
// ─────────────────────────────────────────────────────────────

export interface TestRunData {
  id: string;
  testType: string;
  testMethodStd?: string;
  washCount?: number;
  icpResult?: {
    agValue?: number;
    auValue?: number;
    unit?: string;
  };
  abResult?: {
    organism?: string;
    strainNumber?: string;
    testMethodStd?: string;
    percentReduction?: number;
    growthValue?: number;
    activityValue?: number;
    methodPass?: boolean;
    methodPassReason?: string;
    inoculumCFU?: number;
    controlCFU?: number;
    treatedCFU?: number;
    contactTime?: string;
    incubationTemp?: string;
  };
  fungalResult?: {
    organism?: string;
    strainNumber?: string;
    percentReduction?: number;
    growthValue?: number;
    methodPass?: boolean;
  };
  odorResult?: {
    odorReduction?: string;
    methodPass?: boolean;
  };
  submission?: {
    id?: string;
    washTarget?: number;
  };
}

// ─────────────────────────────────────────────────────────────
// FUZE TIER CLASSIFICATION
// ─────────────────────────────────────────────────────────────

/**
 * Determine FUZE tier based on ICP-OES silver content (mg/kg)
 */
function classifyFuzeTier(agValue?: number): string | null {
  if (agValue == null) return null;

  if (agValue >= 1.0) return 'F1+';
  if (agValue >= 0.75) return 'F1';
  if (agValue >= 0.50) return 'F2';
  if (agValue >= 0.25) return 'F3';
  if (agValue >= 0.10) return 'F4';

  return null;
}

// ─────────────────────────────────────────────────────────────
// COMPLIANCE CHECKS
// ─────────────────────────────────────────────────────────────

/**
 * AATCC TM100-2019: Antibacterial Finishes on Textile Materials
 * - ≥99.9% reduction = PASS
 * - ≥99% reduction = MARGINAL
 * - <99% reduction = FAIL
 */
function checkAATCCTM100(abResult?: any): ComplianceCheck | null {
  if (!abResult || abResult.percentReduction == null) {
    return null;
  }

  const reduction = abResult.percentReduction;
  let passed = false;
  const threshold = '≥99.9%';
  let detail = '';

  if (reduction >= 99.9) {
    passed = true;
    detail = `Excellent reduction of ${reduction.toFixed(2)}% exceeds AATCC TM100 requirements`;
  } else if (reduction >= 99.0) {
    passed = false;
    detail = `Marginal reduction of ${reduction.toFixed(2)}% (≥99% required for marginal pass)`;
  } else {
    passed = false;
    detail = `Reduction of ${reduction.toFixed(2)}% falls below required 99% threshold`;
  }

  return {
    standard: 'AATCC TM100-2019',
    passed,
    detail,
    threshold,
    actual: `${reduction.toFixed(2)}%`,
  };
}

/**
 * ASTM E2149-20: Antimicrobial Activity of Immobilized Antimicrobial Agents
 * - ≥99.9% reduction under dynamic contact = PASS
 */
function checkASTME2149(abResult?: any): ComplianceCheck | null {
  if (!abResult || abResult.percentReduction == null) {
    return null;
  }

  const reduction = abResult.percentReduction;
  const passed = reduction >= 99.9;
  const detail = passed
    ? `Excellent dynamic contact reduction of ${reduction.toFixed(2)}%`
    : `Reduction of ${reduction.toFixed(2)}% below dynamic contact threshold (≥99.9% required)`;

  return {
    standard: 'ASTM E2149-20',
    passed,
    detail,
    threshold: '≥99.9%',
    actual: `${reduction.toFixed(2)}%`,
  };
}

/**
 * JIS L 1902: Antimicrobial Activity Assessment
 * - Activity value A ≥ 2.0 = Bacteriostatic (PASS)
 * - A ≥ 0 with growth < 1.5 = No effect (FAIL)
 */
function checkJISL1902(abResult?: any): ComplianceCheck | null {
  if (!abResult || abResult.activityValue == null) {
    return null;
  }

  const actValue = abResult.activityValue;
  let passed = false;
  let detail = '';

  if (actValue >= 2.0) {
    passed = true;
    detail = `Strong bacteriostatic effect (A = ${actValue.toFixed(2)})`;
  } else if (actValue >= 0 && (abResult.growthValue == null || abResult.growthValue < 1.5)) {
    passed = false;
    detail = `Insufficient activity (A = ${actValue.toFixed(2)}, requires A ≥ 2.0)`;
  } else {
    passed = false;
    detail = `No effect detected (A = ${actValue.toFixed(2)})`;
  }

  return {
    standard: 'JIS L 1902:2015',
    passed,
    detail,
    threshold: 'A ≥ 2.0',
    actual: `A = ${actValue.toFixed(2)}`,
  };
}

/**
 * ICP-OES Silver Content Classification
 */
function checkIcpOES(icpResult?: any): ComplianceCheck | null {
  if (!icpResult || icpResult.agValue == null) {
    return null;
  }

  const agValue = icpResult.agValue;
  const unit = icpResult.unit || 'mg/kg';
  const fuzeTier = classifyFuzeTier(agValue);

  let detail = '';
  let threshold = '';
  let passed = false;

  if (agValue >= 0.10) {
    passed = true;
    if (agValue >= 1.0) {
      detail = `Excellent silver retention: F1+ tier (${agValue.toFixed(2)} ${unit})`;
      threshold = '≥0.10 mg/kg (F4 minimum)';
    } else if (agValue >= 0.75) {
      detail = `Strong silver retention: F1 tier (${agValue.toFixed(2)} ${unit})`;
      threshold = '≥0.10 mg/kg (F4 minimum)';
    } else if (agValue >= 0.50) {
      detail = `Good silver retention: F2 tier (${agValue.toFixed(2)} ${unit})`;
      threshold = '≥0.10 mg/kg (F4 minimum)';
    } else if (agValue >= 0.25) {
      detail = `Acceptable silver retention: F3 tier (${agValue.toFixed(2)} ${unit})`;
      threshold = '≥0.10 mg/kg (F4 minimum)';
    } else {
      detail = `Minimum silver detected: F4 tier (${agValue.toFixed(2)} ${unit})`;
      threshold = '≥0.10 mg/kg (F4 minimum)';
    }
  } else {
    passed = false;
    detail = `Insufficient silver content (${agValue.toFixed(2)} ${unit}) - below F4 minimum`;
    threshold = '≥0.10 mg/kg (F4 minimum)';
  }

  return {
    standard: 'ICP-OES Ag Classification',
    passed,
    detail,
    threshold,
    actual: `${agValue.toFixed(2)} ${unit}`,
  };
}

// ─────────────────────────────────────────────────────────────
// ANOMALY DETECTION
// ─────────────────────────────────────────────────────────────

function detectAnomalies(testRun: TestRunData): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // ICP anomalies
  if (testRun.icpResult?.agValue != null) {
    const agValue = testRun.icpResult.agValue;

    // Unreasonably high silver content
    if (agValue > 5.0) {
      anomalies.push({
        severity: 'warning',
        category: 'ICP-OES',
        message: `Unusually high silver content (${agValue.toFixed(2)} mg/kg). Verify measurement and sampling procedure.`,
      });
    }

    // Trace silver
    if (agValue > 0 && agValue < 0.05) {
      anomalies.push({
        severity: 'info',
        category: 'ICP-OES',
        message: `Trace silver detected (${agValue.toFixed(3)} mg/kg). May indicate contamination or incomplete application.`,
      });
    }
  }

  // Antibacterial anomalies
  if (testRun.abResult) {
    const { controlCFU, treatedCFU, percentReduction, methodPass } = testRun.abResult;

    // Control growth too low (unrealistic)
    if (controlCFU != null && controlCFU < 100) {
      anomalies.push({
        severity: 'warning',
        category: 'Antibacterial',
        message: `Control CFU growth unusually low (${controlCFU}). May indicate inoculation or incubation issue.`,
      });
    }

    // Treated higher than control
    if (treatedCFU != null && controlCFU != null && treatedCFU > controlCFU) {
      anomalies.push({
        severity: 'critical',
        category: 'Antibacterial',
        message: `Treated sample CFU (${treatedCFU}) exceeds control (${controlCFU}). Likely test procedural error.`,
      });
    }

    // Negative percent reduction
    if (percentReduction != null && percentReduction < 0) {
      anomalies.push({
        severity: 'critical',
        category: 'Antibacterial',
        message: `Negative reduction (${percentReduction.toFixed(2)}%). Treated sample shows more growth than control.`,
      });
    }

    // Suspiciously perfect reduction
    if (percentReduction != null && percentReduction >= 99.99) {
      anomalies.push({
        severity: 'info',
        category: 'Antibacterial',
        message: `Reduction near 100% (${percentReduction.toFixed(2)}%). Verify treated sample CFU was detectable.`,
      });
    }
  }

  // Fungal anomalies
  if (testRun.fungalResult) {
    const { growthValue, methodPass } = testRun.fungalResult;

    if (growthValue != null && growthValue > 100) {
      anomalies.push({
        severity: 'info',
        category: 'Fungal',
        message: `High fungal growth value (${growthValue}). Verify incubation conditions.`,
      });
    }
  }

  // Wash durability anomalies
  if (testRun.washCount != null) {
    if (testRun.washCount > 100) {
      anomalies.push({
        severity: 'info',
        category: 'Wash Durability',
        message: `Exceptionally high wash count (${testRun.washCount}). Verify test completed properly.`,
      });
    }
  }

  return anomalies;
}

// ─────────────────────────────────────────────────────────────
// WASH DURABILITY ANALYSIS
// ─────────────────────────────────────────────────────────────

function analyzeWashDurability(testRun: TestRunData): WashDurability | null {
  // Placeholder: would need to fetch sibling tests with different wash counts
  // For now, return null if no wash data available
  if (!testRun.icpResult?.agValue || testRun.washCount == null) {
    return null;
  }

  // Estimate retention based on silver loss rate
  // Typical FUZE fabrics lose 2-5% silver per wash cycle
  const estimatedLossRate = 0.03; // 3% per wash
  const projectedRetention = Math.max(0, testRun.icpResult.agValue / (1 + estimatedLossRate * testRun.washCount));
  const retentionPercent = (projectedRetention / testRun.icpResult.agValue) * 100;

  // Estimate projected wash limit (when silver drops below F4 minimum of 0.10)
  const minAgValue = 0.10;
  let projectedWashLimit = null;
  if (testRun.icpResult.agValue > minAgValue) {
    const washes = Math.log(minAgValue / testRun.icpResult.agValue) / Math.log(1 - estimatedLossRate);
    projectedWashLimit = Math.max(testRun.washCount + 5, Math.ceil(washes));
  }

  return {
    retentionPercent: Math.max(0, retentionPercent),
    trend: 'unknown', // Would be determined from sibling tests
    projectedWashLimit,
  };
}

// ─────────────────────────────────────────────────────────────
// RISK SCORING
// ─────────────────────────────────────────────────────────────

function calculateRiskScore(
  compliance: ComplianceCheck[],
  anomalies: Anomaly[],
  testRun: TestRunData
): { score: number; level: 'low' | 'medium' | 'high' | 'critical' } {
  let score = 0;

  // Compliance failures (40% of score)
  const passCount = compliance.filter((c) => c.passed).length;
  const totalCount = compliance.length;
  if (totalCount > 0) {
    const failureRate = 1 - passCount / totalCount;
    score += failureRate * 40;
  }

  // Anomalies (40% of score)
  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;
  score += criticalCount * 20;
  score += warningCount * 10;
  score = Math.min(score, 40 + 40); // Cap anomaly contribution

  // Data completeness (20% of score)
  let dataPoints = 0;
  let missingPoints = 0;
  if (testRun.icpResult?.agValue != null) dataPoints++;
  else missingPoints++;
  if (testRun.abResult?.percentReduction != null) dataPoints++;
  else missingPoints++;
  if (testRun.fungalResult?.growthValue != null) dataPoints++;
  else missingPoints++;

  if (dataPoints + missingPoints > 0) {
    const completeness = dataPoints / (dataPoints + missingPoints);
    score += (1 - completeness) * 20;
  } else {
    score += 20; // Major penalty for completely missing data
  }

  score = Math.round(Math.min(100, Math.max(0, score)));

  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (score >= 75) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 25) level = 'medium';

  return { score, level };
}

// ─────────────────────────────────────────────────────────────
// RECOMMENDATIONS GENERATION
// ─────────────────────────────────────────────────────────────

function generateRecommendations(
  testRun: TestRunData,
  compliance: ComplianceCheck[],
  anomalies: Anomaly[],
  fuzeTier: string | null
): string[] {
  const recommendations: string[] = [];

  // ICP recommendations
  if (testRun.icpResult?.agValue != null) {
    const agValue = testRun.icpResult.agValue;

    if (agValue < 0.25) {
      recommendations.push('Silver content is below F3 tier. Consider increasing application concentration or wet-pick-up.');
    } else if (agValue < 0.50) {
      recommendations.push('Silver content at F3 tier. Evaluate market positioning and consider enhancement for higher durability tiers.');
    }

    if (testRun.washCount != null && testRun.washCount > 50) {
      recommendations.push(`Silver retention after ${testRun.washCount} washes is strong. Consider market positioning for heavy-duty applications.`);
    }
  }

  // Antibacterial recommendations
  if (testRun.abResult) {
    const failedCompliance = compliance.find((c) => c.standard.includes('AATCC') && !c.passed);
    if (failedCompliance) {
      recommendations.push('Antibacterial efficacy below AATCC TM100 threshold. Evaluate application method or treatment chemistry.');
    }

    // Method-specific recommendations
    if (testRun.abResult.testMethodStd?.includes('AATCC TM100')) {
      recommendations.push('AATCC TM100 result suggests potential for static contact applications.');
    }
  }

  // Wash durability recommendations
  if (testRun.washCount != null) {
    if (testRun.washCount < 10) {
      recommendations.push(`Consider testing at higher wash cycles (20+) to validate durability expectations.`);
    } else if (testRun.washCount > 50) {
      recommendations.push(`Exceptional wash durability demonstrated. Market-suitable for professional/heavy-use applications.`);
    }
  }

  // Anomaly-based recommendations
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');
  if (criticalAnomalies.length > 0) {
    recommendations.push('Critical anomalies detected. Review test procedure and sampling methodology before market submission.');
  }

  // Missing data recommendations
  if (!testRun.icpResult?.agValue) {
    recommendations.push('ICP-OES testing needed to classify FUZE tier and validate silver retention.');
  }
  if (!testRun.abResult?.percentReduction) {
    recommendations.push('Antibacterial testing recommended to validate efficacy claims (AATCC TM100 or JIS L 1902).');
  }

  // Compliance recommendations
  const allPassed = compliance.every((c) => c.passed);
  if (allPassed) {
    recommendations.push('All compliance standards met. Fabric eligible for brand submission.');
  } else {
    const failedStandards = compliance.filter((c) => !c.passed).map((c) => c.standard);
    recommendations.push(`Retest required for: ${failedStandards.join(', ')}`);
  }

  return recommendations;
}

// ─────────────────────────────────────────────────────────────
// DETAILED ANALYSIS
// ─────────────────────────────────────────────────────────────

function generateDetailedAnalysis(
  testRun: TestRunData,
  compliance: ComplianceCheck[],
  fuzeTier: string | null,
  anomalies: Anomaly[]
): string {
  let analysis = '';

  // Header paragraph
  const testType = testRun.testType || 'Unknown Test';
  const washInfo = testRun.washCount ? ` after ${testRun.washCount} wash cycles` : '';
  analysis += `Test Analysis Summary\n\n`;
  analysis += `This ${testType} result${washInfo} has been analyzed across multiple testing standards and FUZE classification metrics.\n\n`;

  // ICP analysis
  if (testRun.icpResult?.agValue != null) {
    const agValue = testRun.icpResult.agValue;
    const unit = testRun.icpResult.unit || 'mg/kg';
    analysis += `ICP-OES Silver Content\n\n`;
    analysis += `The fabric contains ${agValue.toFixed(2)} ${unit} of silver, placing it in the ${fuzeTier || 'unclassified'} tier. `;

    if (agValue >= 0.75) {
      analysis += `This excellent retention level indicates strong durability and suitability for extended-wear applications. `;
    } else if (agValue >= 0.25) {
      analysis += `This adequate retention suggests moderate durability, suitable for standard commercial applications. `;
    } else {
      analysis += `This lower retention level may require enhancement for extended-durability product claims. `;
    }

    if (testRun.washCount) {
      analysis += `Post-wash testing at ${testRun.washCount} cycles provides validation of durability over repeated laundering.`;
    }
    analysis += `\n\n`;
  }

  // Antibacterial analysis
  if (testRun.abResult?.percentReduction != null) {
    const reduction = testRun.abResult.percentReduction;
    const organism = testRun.abResult.organism || 'test organism';
    analysis += `Antibacterial Efficacy\n\n`;
    analysis += `The fabric demonstrated ${reduction.toFixed(2)}% reduction against ${organism}. `;

    if (reduction >= 99.9) {
      analysis += `This excellent efficacy significantly exceeds standard thresholds and indicates strong antimicrobial protection. `;
    } else if (reduction >= 99.0) {
      analysis += `This good efficacy meets or approaches standard thresholds for antibacterial textile claims. `;
    } else {
      analysis += `This result falls below standard efficacy thresholds and requires improvement or process adjustment. `;
    }

    if (testRun.abResult.contactTime) {
      analysis += `Testing was performed with ${testRun.abResult.contactTime} contact time under controlled conditions.`;
    }
    analysis += `\n\n`;
  }

  // Compliance summary
  if (compliance.length > 0) {
    const passedCount = compliance.filter((c) => c.passed).length;
    analysis += `Compliance Assessment\n\n`;
    analysis += `${passedCount} of ${compliance.length} testing standards were met:\n`;

    compliance.forEach((c) => {
      const status = c.passed ? '✓' : '✗';
      analysis += `\n${status} ${c.standard}: ${c.detail}`;
    });
    analysis += `\n\n`;
  }

  // Anomalies section
  if (anomalies.length > 0) {
    const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
    analysis += `Quality Flags\n\n`;
    analysis += `${anomalies.length} item${anomalies.length === 1 ? '' : 's'} flagged${criticalCount > 0 ? `, including ${criticalCount} critical concern${criticalCount === 1 ? '' : 's'}` : ''}:\n`;

    anomalies.forEach((a) => {
      const severityIcon = a.severity === 'critical' ? '⚠️' : a.severity === 'warning' ? '⚡' : 'ℹ️';
      analysis += `\n${severityIcon} [${a.severity.toUpperCase()}] ${a.category}: ${a.message}`;
    });
    analysis += `\n\n`;
  }

  // Conclusion
  analysis += `Interpretation Notes\n\n`;
  analysis += `This interpretation is generated from FUZE's standardized test analysis framework, which evaluates results `;
  analysis += `against industry standards (AATCC, ASTM, JIS) and FUZE-specific tier classifications. `;
  analysis += `All numerical assessments and compliance determinations are based on documented testing standards. `;
  analysis += `For questions about specific methodologies or thresholds, consult the testing standard documentation.`;

  return analysis;
}

// ─────────────────────────────────────────────────────────────
// MAIN INTERPRETATION FUNCTION
// ─────────────────────────────────────────────────────────────

export function interpretTestRun(testRun: TestRunData): TestInterpretation {
  // Determine FUZE tier
  const fuzeTier = classifyFuzeTier(testRun.icpResult?.agValue);

  // Run compliance checks
  const compliance: ComplianceCheck[] = [];

  const aatcc = checkAATCCTM100(testRun.abResult);
  if (aatcc) compliance.push(aatcc);

  const astm = checkASTME2149(testRun.abResult);
  if (astm) compliance.push(astm);

  const jis = checkJISL1902(testRun.abResult);
  if (jis) compliance.push(jis);

  const icp = checkIcpOES(testRun.icpResult);
  if (icp) compliance.push(icp);

  // Detect anomalies
  const anomalies = detectAnomalies(testRun);

  // Calculate wash durability
  const washDurability = analyzeWashDurability(testRun);

  // Generate recommendations
  const recommendations = generateRecommendations(testRun, compliance, anomalies, fuzeTier);

  // Generate detailed analysis
  const detailedAnalysis = generateDetailedAnalysis(testRun, compliance, fuzeTier, anomalies);

  // Calculate risk score
  const { score: riskScore, level: riskLevel } = calculateRiskScore(compliance, anomalies, testRun);

  // Generate summary
  let summary = '';
  if (testRun.icpResult?.agValue != null || testRun.abResult?.percentReduction != null) {
    const parts = [];

    if (fuzeTier) {
      parts.push(`${fuzeTier}-tier silver retention (${testRun.icpResult?.agValue?.toFixed(2)} mg/kg)`);
    }

    if (testRun.abResult?.percentReduction != null) {
      const organism = testRun.abResult.organism?.split(' ')[0] || 'organism';
      parts.push(`${testRun.abResult.percentReduction.toFixed(1)}% efficacy against ${organism}`);
    }

    const washNote = testRun.washCount ? ` after ${testRun.washCount} washes` : '';

    if (parts.length > 0) {
      summary = `This fabric shows ${parts.join(' with ')}${washNote}, ${
        riskLevel === 'low' ? 'exceeding' : riskLevel === 'critical' ? 'falling below' : 'meeting'
      } FUZE testing requirements.`;
    }
  }

  if (!summary) {
    summary = `Test interpretation complete. Review compliance assessments and recommendations for next steps.`;
  }

  return {
    summary,
    riskScore,
    riskLevel,
    fuzeTier,
    compliance,
    anomalies,
    washDurability,
    recommendations,
    detailedAnalysis,
  };
}

export default interpretTestRun;
