"use client";
import { useState, useMemo } from "react";
import {
  calcExhaust, calcSpray,
  FUZE_TIERS, STOCK_MG_PER_L, BOTTLE_LITERS,
  DEFAULT_SPRAY_SPEED, DEFAULT_PUMP_RATE,
  type ExhaustInputs, type ExhaustOutputs,
  type SprayInputs, type SprayOutputs,
} from "@/lib/fuze-pickup-calc";

type AppMethod = "exhaust" | "pad-dry-cure" | "spray";

function ResultCard({ label, value, unit, highlight }: { label: string; value: string | number; unit?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? "bg-[#00b4c3]/5 border-[#00b4c3]/30" : "bg-white border-slate-200"}`}>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-black mt-1 ${highlight ? "text-[#00b4c3]" : "text-slate-900"}`}>
        {value}{unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export default function FuzePickupCalculator({
  defaultGsm,
  defaultWidth,
  onSaveResults,
}: {
  defaultGsm?: number;
  defaultWidth?: number;
  onSaveResults?: (results: any) => void;
}) {
  const [method, setMethod] = useState<AppMethod>("exhaust");
  const [tier, setTier] = useState<typeof FUZE_TIERS[number]>(FUZE_TIERS[0]);

  // Shared inputs
  const [gsm, setGsm] = useState(defaultGsm || 180);
  const [widthInches, setWidthInches] = useState(defaultWidth || 60);

  // Exhaust inputs
  const [lengthMeters, setLengthMeters] = useState(100);
  const [liquorRatio, setLiquorRatio] = useState(8);
  const [exhaustionPct, setExhaustionPct] = useState(85);
  const [pickupPct, setPickupPct] = useState(70);

  // Spray inputs
  const [pumpRate, setPumpRate] = useState(DEFAULT_PUMP_RATE);
  const [fabricSpeed, setFabricSpeed] = useState(DEFAULT_SPRAY_SPEED);
  const [concentrationFactor, setConcentrationFactor] = useState(1.0);

  // Real-world override inputs
  const [showRealWorld, setShowRealWorld] = useState(false);
  const [realPickupPct, setRealPickupPct] = useState("");
  const [realExhaustionPct, setRealExhaustionPct] = useState("");
  const [realResidualMgKg, setRealResidualMgKg] = useState("");

  const exhaustResults = useMemo<ExhaustOutputs | null>(() => {
    if (!gsm || !widthInches || !lengthMeters) return null;
    return calcExhaust({
      gsm, widthInches, lengthMeters,
      targetDoseMgKg: tier.dose,
      liquorRatio,
      exhaustionPct,
      pickupPct,
      method: method === "pad-dry-cure" ? "pad-dry-cure" : "exhaust",
    });
  }, [gsm, widthInches, lengthMeters, tier, liquorRatio, exhaustionPct, pickupPct, method]);

  const sprayResults = useMemo<SprayOutputs | null>(() => {
    if (!gsm || !widthInches) return null;
    return calcSpray({
      gsm, widthInches,
      targetDoseMgKg: tier.dose,
      pumpRateMLMin: pumpRate,
      fabricSpeedMMin: fabricSpeed,
      concentrationFactor,
    });
  }, [gsm, widthInches, tier, pumpRate, fabricSpeed, concentrationFactor]);

  const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none";
  const labelClass = "block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black text-slate-900">FUZE Pickup & Application Calculator</h2>
        <p className="text-xs text-slate-500 mt-1">Calculate bath concentration, spray parameters, and FUZE volume for your application method.</p>
      </div>

      {/* Method Selector */}
      <div>
        <label className={labelClass}>Application Method</label>
        <div className="flex gap-2">
          {([
            { key: "exhaust", label: "Exhaust", icon: "🔄" },
            { key: "pad-dry-cure", label: "Pad-Dry-Cure", icon: "📏" },
            { key: "spray", label: "Spray", icon: "💨" },
          ] as const).map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                method === m.key
                  ? "border-[#00b4c3] bg-[#00b4c3]/5 text-[#00b4c3]"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tier Selector */}
      <div>
        <label className={labelClass}>Target FUZE Tier</label>
        <div className="flex gap-2">
          {FUZE_TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTier(t)}
              className={`flex-1 px-3 py-2.5 rounded-xl text-center transition-all border-2 ${
                tier.id === t.id
                  ? "border-[#00b4c3] bg-[#00b4c3] text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-black">{t.id}</div>
              <div className="text-[10px]">{t.dose} mg/kg</div>
            </button>
          ))}
        </div>
      </div>

      {/* Common Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>GSM (weight)</label>
          <input type="number" value={gsm} onChange={(e) => setGsm(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Width (inches)</label>
          <input type="number" value={widthInches} onChange={(e) => setWidthInches(Number(e.target.value))} className={inputClass} />
        </div>
        {method !== "spray" && (
          <div>
            <label className={labelClass}>Batch Length (meters)</label>
            <input type="number" value={lengthMeters} onChange={(e) => setLengthMeters(Number(e.target.value))} className={inputClass} />
          </div>
        )}
        {method === "exhaust" && (
          <>
            <div>
              <label className={labelClass}>Liquor Ratio (1:X)</label>
              <input type="number" value={liquorRatio} onChange={(e) => setLiquorRatio(Number(e.target.value))} className={inputClass} />
            </div>
          </>
        )}
      </div>

      {/* Method-specific inputs */}
      {method === "exhaust" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Expected Exhaustion Rate (%)</label>
            <input type="number" value={exhaustionPct} onChange={(e) => setExhaustionPct(Number(e.target.value))} className={inputClass} placeholder="85" />
            <p className="text-[10px] text-slate-400 mt-1">% of FUZE that transfers from bath to fabric</p>
          </div>
        </div>
      )}

      {method === "pad-dry-cure" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Wet Pickup Rate (%)</label>
            <input type="number" value={pickupPct} onChange={(e) => setPickupPct(Number(e.target.value))} className={inputClass} placeholder="70" />
            <p className="text-[10px] text-slate-400 mt-1">% of fabric weight picked up as solution</p>
          </div>
          <div>
            <label className={labelClass}>Expected Exhaustion (%)</label>
            <input type="number" value={exhaustionPct} onChange={(e) => setExhaustionPct(Number(e.target.value))} className={inputClass} placeholder="85" />
          </div>
        </div>
      )}

      {method === "spray" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Pump Rate (mL/min per head)</label>
            <input type="number" value={pumpRate} onChange={(e) => setPumpRate(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fabric Speed (m/min)</label>
            <input type="number" value={fabricSpeed} onChange={(e) => setFabricSpeed(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Concentration Factor</label>
            <select value={concentrationFactor} onChange={(e) => setConcentrationFactor(Number(e.target.value))} className={inputClass + " bg-white"}>
              <option value={1.0}>Full Strength (1:0)</option>
              <option value={0.75}>3:1 Dilution (75%)</option>
              <option value={0.5}>1:1 Dilution (50%)</option>
              <option value={0.25}>1:3 Dilution (25%)</option>
            </select>
          </div>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {method !== "spray" && exhaustResults && (
        <div className="bg-gradient-to-r from-slate-50 to-[#00b4c3]/5 rounded-2xl border border-[#00b4c3]/20 p-6">
          <h3 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">
            {method === "exhaust" ? "Exhaust" : "Pad-Dry-Cure"} Calculation Results — {tier.id} ({tier.dose} mg/kg)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <ResultCard label="Fabric Weight" value={exhaustResults.fabricWeightKg} unit="kg" />
            <ResultCard label="Bath Volume" value={exhaustResults.bathVolumeLiters} unit="L" />
            <ResultCard label="FUZE Volume Needed" value={exhaustResults.fuzeVolumeML} unit="mL" highlight />
            <ResultCard label="FUZE % of Bath" value={exhaustResults.fuzePctOfBath} unit="%" highlight />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="Bath Concentration" value={exhaustResults.bathConcentrationMgL} unit="mg/L" highlight />
            <ResultCard label="Ag Needed" value={exhaustResults.fuzeNeededMg} unit="mg" />
            <ResultCard label="Bottles (19L)" value={exhaustResults.bottlesNeededRounded} unit={`(${exhaustResults.bottlesNeeded.toFixed(2)} exact)`} />
            <ResultCard label="Fabric Weight" value={exhaustResults.fabricWeightLbs} unit="lbs" />
          </div>
          {method === "pad-dry-cure" && exhaustResults.padConcentrationMgL && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ResultCard label="Pad Solution Pickup" value={exhaustResults.padSolutionVolumeLiters!} unit="L" />
              <ResultCard label="Pad Concentration" value={exhaustResults.padConcentrationMgL} unit="mg/L" highlight />
            </div>
          )}
        </div>
      )}

      {method === "spray" && sprayResults && (
        <div className="bg-gradient-to-r from-slate-50 to-[#00b4c3]/5 rounded-2xl border border-[#00b4c3]/20 p-6">
          <h3 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">
            Spray Calculation Results — {tier.id} ({tier.dose} mg/kg)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <ResultCard label="Spray Heads (Top)" value={sprayResults.sprayHeadsTop} />
            <ResultCard label="Spray Heads (Bottom)" value={sprayResults.sprayHeadsBottom} />
            <ResultCard label="Total Heads" value={sprayResults.totalSprayHeads} highlight />
            <ResultCard label="Total Spray Rate" value={sprayResults.totalSprayRateMLMin} unit="mL/min" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <ResultCard label="Volume per Meter" value={sprayResults.volumePerMeterML} unit="mL" />
            <ResultCard label="Fabric Weight/Meter" value={(sprayResults.fabricWeightPerMeterKg * 1000).toFixed(1)} unit="g" />
            <ResultCard label="Ag Needed/Meter" value={sprayResults.mgNeededPerMeter} unit="mg" highlight />
            <ResultCard label="Concentration Needed" value={sprayResults.concentrationNeededMgL} unit="mg/L" highlight />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ResultCard label="Dilution from Stock" value={sprayResults.dilutionRatio} highlight />
            <ResultCard label="Stock per Meter" value={sprayResults.stockVolumePerMeterML} unit="mL" />
            <ResultCard label="Meters per Bottle (19L)" value={sprayResults.metersPerBottle} unit="m" highlight />
          </div>
        </div>
      )}

      {/* Real-World Data Override */}
      <div>
        <button
          onClick={() => setShowRealWorld(!showRealWorld)}
          className="text-xs font-semibold text-[#00b4c3] hover:underline"
        >
          {showRealWorld ? "▲ Hide" : "▼ Show"} Real-World Data Entry (post-production)
        </button>
        {showRealWorld && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 mb-3">Enter actual production values to compare against calculated targets.</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Actual Pickup (%)</label>
                <input type="number" value={realPickupPct} onChange={(e) => setRealPickupPct(e.target.value)} className={inputClass} placeholder="Measured %" />
              </div>
              <div>
                <label className={labelClass}>Actual Exhaustion (%)</label>
                <input type="number" value={realExhaustionPct} onChange={(e) => setRealExhaustionPct(e.target.value)} className={inputClass} placeholder="Measured %" />
              </div>
              <div>
                <label className={labelClass}>Actual Residual (mg/kg)</label>
                <input type="number" value={realResidualMgKg} onChange={(e) => setRealResidualMgKg(e.target.value)} className={inputClass} placeholder="ICP result" />
              </div>
            </div>
            {realResidualMgKg && (
              <div className="mt-3 p-3 bg-white rounded-lg border">
                <div className="text-xs text-slate-500">Target: <strong>{tier.dose} mg/kg</strong> | Actual: <strong>{realResidualMgKg} mg/kg</strong></div>
                <div className={`text-sm font-bold mt-1 ${Number(realResidualMgKg) >= tier.dose ? "text-emerald-600" : "text-red-600"}`}>
                  {Number(realResidualMgKg) >= tier.dose ? "✓ Meets target" : "✗ Below target — adjust concentration or exhaustion"}
                </div>
              </div>
            )}
            {onSaveResults && (
              <button
                onClick={() => onSaveResults({
                  method,
                  tier: tier.id,
                  targetDoseMgKg: tier.dose,
                  calculatedResults: method === "spray" ? sprayResults : exhaustResults,
                  realWorldData: {
                    pickupPct: realPickupPct ? Number(realPickupPct) : null,
                    exhaustionPct: realExhaustionPct ? Number(realExhaustionPct) : null,
                    residualMgKg: realResidualMgKg ? Number(realResidualMgKg) : null,
                  },
                })}
                className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700"
              >
                Save Results to Fabric Record
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reference */}
      <div className="text-[10px] text-slate-400 border-t pt-3">
        Stock: {STOCK_MG_PER_L} mg Ag/L | Bottle: {BOTTLE_LITERS}L | Tiers: F1=1.0, F2=0.75, F3=0.5, F4=0.25 mg/kg
      </div>
    </div>
  );
}
