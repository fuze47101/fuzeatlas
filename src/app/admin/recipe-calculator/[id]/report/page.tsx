// @ts-nocheck
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Full FUZE Recipe Report — the polished, factory-facing version of
 * a bench test. Meant to print to 2 pages (letter/A4), hand to a
 * factory or brand. Save-as-PDF from the browser.
 */

const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
const STANDARD_BATHS_L = [50, 100, 200, 300, 400];

function fuzeLitersForBath(bathL: number, pickupPct: number, mgPerKg: number, stock: number) {
  if (!pickupPct || !bathL) return 0;
  return (mgPerKg / (pickupPct / 100) * bathL) / stock;
}

// ─────────────────────────────────────────────
// i18n — English / 中文 / 日本語
// ─────────────────────────────────────────────
type Lang = "en" | "zh" | "ja";
const STRINGS = {
  en: {
    recipeReport: "Recipe Report",
    subtitle: "Antimicrobial textile treatment",
    benchTest: "Bench Test",
    prepared: "Prepared",
    fuzeLab: "FUZE Lab · Salt Lake City, UT",
    qcPassed: "✓ QC Passed",
    qcFailed: "⚠ QC Failed",
    graduated: "⭐ Graduated to FabricRecipe",
    execSummary: "Executive Summary",
    fabric: "Fabric",
    method: "Method",
    measuredPickup: "Measured pickup",
    dryToWetBasis: "dry-to-wet · triplicate mean",
    pickupDataUnusable: "⚠ Pickup data unusable — do not rely on the recipe values below.",
    pickupRerun: "No valid dry-to-wet pickup on record. Re-run this bench test with a dry sample weighed before and after the FUZE pad pass.",
    fourTierTitle: "Four-tier Bath Recipe — g of FUZE per L of bath",
    tierPerfMax: "Maximum", tierPerfHigh: "High", tierPerfStd: "Standard", tierPerfLight: "Light",
    fuzePerL: "FUZE per L of bath",
    gPerL: "g/L",
    bathConc: "Bath concentration",
    dilution: "Dilution ratio",
    tierNote: "The g/L figure is constant — it does not change with bath size. The total kg of FUZE per production bath is in the cookbook table below.",
    cookbookTitle: "Production Bath Cookbook — total kg of FUZE per bath size",
    bathVol: "Bath Volume",
    total: "total",
    cookbookNote1: "Concentration does not change with bath size — see the g/L figure on each tier card. The table above shows the",
    cookbookNote2: "total mass of FUZE stock",
    cookbookNote3: "to add for a bath of that volume, then top up to the bath volume with DI water.",
    pickupShort: "Pickup",
    stockShort: "Stock FUZE",
    adjustmentTitle: "Production Adjustment for Moist Incoming Fabric — g of FUZE per L of bath",
    adjustmentIntro1: "If your fabric enters the FUZE padder",
    adjustmentIntro2: "already moist",
    adjustmentIntro3: "from a prior process (wash, dye, desize), the pad still brings it to the same equilibrium pickup — but part of that mass is pre-existing water, not new FUZE. To hit the tier target, use a",
    adjustmentIntro4: "more concentrated bath",
    adjustmentIntro5: "based on your incoming residual moisture.",
    effectivePickupFormula: "Effective pickup = measured dry-to-wet pickup",
    minusMoisture: "− incoming moisture",
    incomingMoisture: "Incoming moisture",
    dryLabel: "0% (dry)",
    effectivePickup: "Effective pickup",
    tooWet: "too wet",
    adjustmentFooter: "\"too wet\" means incoming moisture is at or above the padder's equilibrium pickup — the fabric can't accept additional FUZE bath at that tier target. Dry the fabric further before treatment, or use a more concentrated bath (lower tier → higher mg/kg basis recipe).",
    measurements: "Measurements",
    triplicateRuns: "Triplicate sample runs",
    run: "Run", dryG: "Dry (g)", wetG: "Wet after pad (g)", pickupCol: "Pickup %",
    mean: "Mean",
    processParams: "Process Parameters",
    sampleArea: "Sample area", squeezePressure: "Squeeze pressure", vfdFreq: "VFD frequency",
    lineSpeed: "Line speed", drying: "Drying", curing: "Curing", fuzeStock: "FUZE stock",
    liquorRatio: "Liquor ratio (exhaust)",
    testBathTitle: "Bench Test Bath + ICP Validation",
    testBathApplied: "Test bath applied",
    tier: "Tier", reservoir: "reservoir",
    fuzeStockLabel: "FUZE stock",
    water: "Water",
    icpVerification: "ICP verification",
    expected: "Expected", measured: "Measured", affinity: "Affinity",
    resultPending: "Result pending",
    methodology: "Methodology",
    methodologyBody: (p: number, hz: number, stock: number) =>
      `Pickup rate measured per AATCC / ASTM pad application method on the FUZE lab vertical padder (HTAI P-B0, 41 cm roller circumference) — fabric passes upward through a bath held in the reservoir between two pads pressed at 4 bar. Samples cut at 100 cm² on a FUZE cutter, conditioned at 20–25 °C. Dry-to-wet run: dry sample submerged in clean DI water 10 s, drained 3 s, padded at ${p ?? "—"} bar / ${hz ?? "—"} Hz (single pass), weighed within 10 s. Measurements performed in triplicate; reported pickup is the arithmetic mean. Bench test bath prepared at the target tier concentration from 30 mg/L FUZE stock and pad-applied through the same reservoir for ICP verification. Dilution recipe derived from pickup mean using FUZE stock concentration ${stock} mg/L and tier OWF targets (F1 1.0 mg/kg · F2 0.75 mg/kg · F3 0.5 mg/kg · F4 0.25 mg/kg).`,
    labNotes: "Lab Notes",
    footerLeft: "FUZE Biotech · 1895 West 2100 South · Salt Lake City, UT 84119 USA · andrew@fuze47.com",
    footerRight: "Report generated",
    printBtn: "🖨 Print / Save as PDF",
    back: "← Back",
    language: "Language",
  },
  zh: {
    recipeReport: "配方报告",
    subtitle: "抗菌纺织处理",
    benchTest: "实验室测试",
    prepared: "准备日期",
    fuzeLab: "FUZE 实验室 · 美国犹他州盐湖城",
    qcPassed: "✓ 质检通过",
    qcFailed: "⚠ 质检未通过",
    graduated: "⭐ 已升级为 FabricRecipe",
    execSummary: "摘要",
    fabric: "面料",
    method: "工艺",
    measuredPickup: "实测上染率",
    dryToWetBasis: "干对湿基准 · 三次测量平均值",
    pickupDataUnusable: "⚠ 上染率数据无效 — 请勿依据下方配方值。",
    pickupRerun: "未记录有效的干对湿上染率。请重新进行实验室测试,先称量干样,过 FUZE 轧车后再次称量。",
    fourTierTitle: "四等级浴液配方 — 每升浴液的 FUZE 添加克数",
    tierPerfMax: "最高", tierPerfHigh: "高", tierPerfStd: "标准", tierPerfLight: "轻度",
    fuzePerL: "每升浴液 FUZE 添加量",
    gPerL: "克/升",
    bathConc: "浴液浓度",
    dilution: "稀释比",
    tierNote: "克/升 数值与浴液体积无关 — 体积变化时该数值保持不变。每次生产所需 FUZE 总公斤数见下方配方表。",
    cookbookTitle: "生产浴液配方表 — 不同浴液体积的 FUZE 总公斤数",
    bathVol: "浴液体积",
    total: "总量",
    cookbookNote1: "浓度不随浴液体积变化 — 请参阅各等级卡片上的 克/升 数值。上表显示的是",
    cookbookNote2: "FUZE 原液的总质量",
    cookbookNote3: ",之后用去离子水补足至浴液体积。",
    pickupShort: "上染率",
    stockShort: "FUZE 原液浓度",
    adjustmentTitle: "湿态来布生产调整 — 每升浴液的 FUZE 克数",
    adjustmentIntro1: "如果面料进入 FUZE 轧车时",
    adjustmentIntro2: "已含有水分",
    adjustmentIntro3: "(来自前道水洗、染色、退浆等工序),轧车仍会将其带到相同的平衡上染率 — 但其中部分质量是面料已有的水分,而非新加入的 FUZE。要达到目标等级,需使用",
    adjustmentIntro4: "更高浓度的浴液",
    adjustmentIntro5: ",根据来布残余含水率调整。",
    effectivePickupFormula: "有效上染率 = 实测干对湿上染率",
    minusMoisture: "− 来布含水率",
    incomingMoisture: "来布含水率",
    dryLabel: "0%(干)",
    effectivePickup: "有效上染率",
    tooWet: "过湿",
    adjustmentFooter: "「过湿」表示来布含水率已达到或超过轧车平衡上染率 — 面料无法在该等级目标下再吸收 FUZE 浴液。请先进一步烘干面料,或使用更高浓度的浴液(降低等级 → 提升 mg/kg 目标配方)。",
    measurements: "测量数据",
    triplicateRuns: "三次取样测量",
    run: "次数", dryG: "干重(克)", wetG: "轧后湿重(克)", pickupCol: "上染率 %",
    mean: "平均值",
    processParams: "工艺参数",
    sampleArea: "样品面积", squeezePressure: "轧压", vfdFreq: "VFD 频率",
    lineSpeed: "线速", drying: "烘干", curing: "固化", fuzeStock: "FUZE 原液",
    liquorRatio: "浴比(浸染)",
    testBathTitle: "实验室测试浴液 + ICP 验证",
    testBathApplied: "已应用测试浴液",
    tier: "等级", reservoir: "储液槽",
    fuzeStockLabel: "FUZE 原液",
    water: "水",
    icpVerification: "ICP 验证",
    expected: "预期值", measured: "实测值", affinity: "吸收率",
    resultPending: "结果待出",
    methodology: "检测方法",
    methodologyBody: (p: number, hz: number, stock: number) =>
      `上染率测量依据 AATCC / ASTM 轧染工艺,于 FUZE 实验室的立式轧车(HTAI P-B0,辊周长 41 cm)上进行 — 面料自下而上穿过两个以 4 bar 压力夹合的轧辊之间的浴液储液槽。样品使用 FUZE 裁样器裁取 100 cm²,在 20–25 °C 条件下调湿。干对湿流程:干样浸入洁净去离子水 10 秒,沥水 3 秒,以 ${p ?? "—"} bar / ${hz ?? "—"} Hz(单次过辊)轧压,10 秒内称重。三次平行测量,报告中的上染率为算术平均值。实验室测试浴液按目标等级浓度自 30 mg/L FUZE 原液配制,经同一储液槽轧染以进行 ICP 验证。稀释配方依据上染率平均值和 FUZE 原液浓度 ${stock} mg/L 以及各等级 OWF 目标(F1 1.0 mg/kg · F2 0.75 mg/kg · F3 0.5 mg/kg · F4 0.25 mg/kg)导出。`,
    labNotes: "实验室备注",
    footerLeft: "FUZE Biotech · 1895 West 2100 South · Salt Lake City, UT 84119 USA · andrew@fuze47.com",
    footerRight: "报告生成时间",
    printBtn: "🖨 打印 / 另存为 PDF",
    back: "← 返回",
    language: "语言",
  },
  ja: {
    recipeReport: "レシピレポート",
    subtitle: "抗菌繊維処理",
    benchTest: "ベンチテスト",
    prepared: "作成日",
    fuzeLab: "FUZE ラボ · 米国ユタ州ソルトレイクシティ",
    qcPassed: "✓ QC 合格",
    qcFailed: "⚠ QC 不合格",
    graduated: "⭐ FabricRecipe に昇格済",
    execSummary: "サマリー",
    fabric: "生地",
    method: "工法",
    measuredPickup: "実測ピックアップ",
    dryToWetBasis: "ドライ→ウェット基準 · 三連平均",
    pickupDataUnusable: "⚠ ピックアップデータ無効 — 以下のレシピ値は使用しないでください。",
    pickupRerun: "有効なドライ→ウェットのピックアップ記録がありません。乾燥サンプルを計量してから FUZE パッドを通し、再度計量して再テストしてください。",
    fourTierTitle: "4ティアバスレシピ — バス 1 L あたりの FUZE 添加 g",
    tierPerfMax: "最大", tierPerfHigh: "高", tierPerfStd: "標準", tierPerfLight: "ライト",
    fuzePerL: "バス 1L あたりの FUZE",
    gPerL: "g/L",
    bathConc: "バス濃度",
    dilution: "希釈比",
    tierNote: "g/L の値はバス容量が変わっても一定です。生産バスあたりの FUZE 総 kg は下記のクックブック表を参照してください。",
    cookbookTitle: "生産バスクックブック — バスサイズ別の FUZE 総 kg",
    bathVol: "バス容量",
    total: "合計",
    cookbookNote1: "濃度はバス容量によって変わりません — 各ティアカードの g/L を参照。上の表は",
    cookbookNote2: "FUZE ストックの総質量",
    cookbookNote3: "を示します。その後、脱イオン水でバス容量まで補給してください。",
    pickupShort: "ピックアップ",
    stockShort: "FUZE ストック",
    adjustmentTitle: "湿潤入荷生地向け生産調整 — バス 1L あたり FUZE の g",
    adjustmentIntro1: "生地が前工程 (洗浄・染色・糊抜き等) から",
    adjustmentIntro2: "湿潤状態",
    adjustmentIntro3: "で FUZE パッダーに入る場合、パッドは同じ平衡ピックアップまで搾りますが、その質量の一部は既存の水分であり新たな FUZE ではありません。ティア目標に到達するには、入荷残留水分に基づき",
    adjustmentIntro4: "より高濃度のバス",
    adjustmentIntro5: "を使用してください。",
    effectivePickupFormula: "実効ピックアップ = 実測ドライ→ウェットピックアップ",
    minusMoisture: "− 入荷水分",
    incomingMoisture: "入荷水分",
    dryLabel: "0%(ドライ)",
    effectivePickup: "実効ピックアップ",
    tooWet: "過湿",
    adjustmentFooter: "「過湿」は入荷水分がパッダーの平衡ピックアップ以上であることを意味します — その場合、生地はそのティア目標で追加の FUZE バスを取り込めません。さらに乾燥させるか、より高濃度のバス(低ティア → より高い mg/kg 基準レシピ)を使用してください。",
    measurements: "測定値",
    triplicateRuns: "三連サンプル測定",
    run: "回", dryG: "乾燥 (g)", wetG: "パッド後湿重 (g)", pickupCol: "ピックアップ %",
    mean: "平均",
    processParams: "プロセスパラメータ",
    sampleArea: "サンプル面積", squeezePressure: "搾り圧力", vfdFreq: "VFD 周波数",
    lineSpeed: "ライン速度", drying: "乾燥", curing: "キュア", fuzeStock: "FUZE ストック",
    liquorRatio: "浴比(浸染)",
    testBathTitle: "ベンチテストバス + ICP 検証",
    testBathApplied: "適用テストバス",
    tier: "ティア", reservoir: "リザーバ",
    fuzeStockLabel: "FUZE ストック",
    water: "水",
    icpVerification: "ICP 検証",
    expected: "期待値", measured: "実測値", affinity: "親和率",
    resultPending: "結果待ち",
    methodology: "試験方法",
    methodologyBody: (p: number, hz: number, stock: number) =>
      `AATCC / ASTM パッド塗布法に従い、FUZE ラボの縦型パッダー (HTAI P-B0、ローラ周長 41 cm) にてピックアップ率を測定 — 生地はリザーバに保持されたバス内を通過し、4 bar で圧着された 2 つのパッドの間を上方向に通過する。サンプルは FUZE カッターで 100 cm² に裁断、20–25 °C で調湿。ドライ→ウェット試験:乾燥サンプルを清浄な脱イオン水に 10 秒浸漬、3 秒排水、${p ?? "—"} bar / ${hz ?? "—"} Hz (シングルパス) でパッディング、10 秒以内に計量。三連で測定し、報告ピックアップは算術平均値。ベンチテストバスは 30 mg/L の FUZE ストックから目標ティア濃度で調製し、同一リザーバでパッディングして ICP 検証を実施。希釈レシピはピックアップ平均値と FUZE ストック濃度 ${stock} mg/L、および各ティアの OWF 目標 (F1 1.0 mg/kg · F2 0.75 mg/kg · F3 0.5 mg/kg · F4 0.25 mg/kg) から導出。`,
    labNotes: "ラボ備考",
    footerLeft: "FUZE Biotech · 1895 West 2100 South · Salt Lake City, UT 84119 USA · andrew@fuze47.com",
    footerRight: "レポート生成日時",
    printBtn: "🖨 印刷 / PDF 保存",
    back: "← 戻る",
    language: "言語",
  },
};

export default function RecipeReportPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [lang, setLang] = useState<Lang>("en");
  const T = STRINGS[lang];
  const locale = lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en-US";

  useEffect(() => {
    fetch(`/api/admin/recipe-bench-tests/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (d.ok) setTest(d.test);
        else setError(d.error || `HTTP ${r.status}`);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-10 text-slate-500">Loading bench test {id}…</div>;
  if (!test) return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-2">Bench test not loaded</h1>
      <p className="text-sm text-slate-600">ID: <code>{id}</code></p>
      {error && <p className="text-sm text-red-700 mt-2">Error: {error}</p>}
      <a href="/admin/recipe-calculator" className="inline-block mt-4 text-[#00b4c3] font-semibold">← Back to calculator</a>
    </div>
  );

  // We always use dry-to-wet. Wet-to-wet mass pickup is meaningless for FUZE
  // (99.998% DI water), so it was removed from the measurement flow. Legacy
  // tests that have only wetToWet stored fall through to null and surface a
  // warning banner.
  const pickupUsed = test.pickupDryToWetPct;
  const stock = test.stockMgPerL || 30;
  const fmt = (n: any, p = 2) => (n === null || n === undefined ? "—" : Number(n).toFixed(p));
  const runs = Array.isArray(test.sampleRuns) ? test.sampleRuns : [];

  // Recompute tier values from the chosen pickup so legacy DB rows with
  // negative-basis stored values don't leak through.
  // FUZE ≈ 1 g/mL (water base), so g/L of stock added ≈ mL/L of stock added.
  const TIER_MG = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 } as const;
  const tierRecipe = (tier: keyof typeof TIER_MG) => {
    if (!pickupUsed || pickupUsed <= 0) return { bathConc: null, gPerL: null, ratio: null };
    const bathConc = TIER_MG[tier] / (pickupUsed / 100);     // mg/L in bath
    const gPerL = (bathConc / stock) * 1000;                 // g of FUZE stock per L of final bath (≈ mL because FUZE ≈ 1 g/mL)
    const ratio = stock / bathConc - 1;                      // 1 : N water
    return { bathConc, gPerL, ratio };
  };

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.4in; size: letter; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="no-print max-w-4xl mx-auto px-6 pt-6 flex items-center justify-between gap-3 flex-wrap">
        <a href="/admin/recipe-calculator" className="text-sm text-[#00b4c3] font-semibold">{T.back}</a>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{T.language}:</span>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-xs">
            <button onClick={() => setLang("en")} className={`px-3 py-1.5 font-semibold ${lang === "en" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>English</button>
            <button onClick={() => setLang("zh")} className={`px-3 py-1.5 font-semibold border-l border-slate-300 ${lang === "zh" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>中文</button>
            <button onClick={() => setLang("ja")} className={`px-3 py-1.5 font-semibold border-l border-slate-300 ${lang === "ja" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>日本語</button>
          </div>
          <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">
            {T.printBtn}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0">
        {/* BAD-DATA BANNER */}
        {(pickupUsed == null || pickupUsed <= 0) && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg print:border print:border-red-400">
            <p className="font-black text-red-800 text-sm">{T.pickupDataUnusable}</p>
            <p className="text-xs text-red-700 mt-1">{T.pickupRerun} ({fmt(pickupUsed, 1)}%)</p>
          </div>
        )}

        {/* COVER HEADER */}
        <header className="mb-6 pb-5 border-b-4 border-[#00b4c3]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <img src="/fuze-logo-horizontal.png" alt="FUZE Biotech" className="h-10 w-auto" />
                <div className="border-l border-slate-200 pl-3 ml-1">
                  <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">{T.recipeReport}</p>
                  <p className="text-sm text-slate-500">{T.subtitle}</p>
                </div>
              </div>
              <h1 className="text-3xl font-black text-slate-900 mt-3">{T.benchTest} <span className="font-mono">{test.testNumber}</span></h1>
              <p className="text-sm text-slate-600 mt-1">{T.prepared} {new Date(test.testDate).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })} · {T.fuzeLab}</p>
            </div>
            <div className="text-right">
              {test.qcPassed ? (
                <span className="inline-block px-3 py-1 text-sm font-bold bg-emerald-100 text-emerald-800 rounded-full">{T.qcPassed}</span>
              ) : (
                <span className="inline-block px-3 py-1 text-sm font-bold bg-red-100 text-red-800 rounded-full">{T.qcFailed}</span>
              )}
              {test.graduatedRecipeId && <p className="text-xs text-amber-700 mt-1">{T.graduated}</p>}
            </div>
          </div>
        </header>

        {/* EXECUTIVE SUMMARY */}
        <section className="mb-6 p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#00b4c3] mb-2">{T.execSummary}</p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-white/60">{T.fabric}</p>
              <p className="font-bold text-lg">{test.fabric?.fuzeNumber || test.fabricLabel}</p>
              <p className="text-xs text-white/70">{test.fabricType}{test.fabricWeightGsm ? ` · ${test.fabricWeightGsm} g/m²` : ""}</p>
              <p className="text-xs text-white/70">{test.fiberContent || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">{T.method}</p>
              <p className="font-bold text-lg">{(test.applicationMethod || "—").replace(/_/g, "-")}</p>
              <p className="text-xs text-white/70">{test.squeezePressure != null ? `${test.squeezePressure} bar` : "—"}{test.vfdFrequencyHz != null ? ` · ${test.vfdFrequencyHz} Hz · ${(test.vfdFrequencyHz * 0.295).toFixed(2)} m/min` : ""}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">{T.measuredPickup}</p>
              <p className={`font-black text-3xl ${pickupUsed > 0 ? "text-[#00b4c3]" : "text-red-400"}`}>{fmt(pickupUsed, 1)}%</p>
              <p className="text-xs text-white/70">{T.dryToWetBasis}</p>
            </div>
          </div>
        </section>

        {/* FOUR-TIER RECIPE */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">{T.fourTierTitle}</h2>
          <div className="grid grid-cols-4 gap-3">
            {([
              { tier: "F1" as const, perf: T.tierPerfMax },
              { tier: "F2" as const, perf: T.tierPerfHigh },
              { tier: "F3" as const, perf: T.tierPerfStd },
              { tier: "F4" as const, perf: T.tierPerfLight },
            ]).map((t) => {
              const r = tierRecipe(t.tier);
              return (
                <div key={t.tier} className="border-2 border-[#00b4c3] rounded-lg overflow-hidden">
                  <div className="bg-[#00b4c3] text-white p-2 text-center">
                    <p className="font-black text-2xl">{t.tier}</p>
                    <p className="text-[10px] uppercase tracking-wide opacity-90">{t.perf}</p>
                    <p className="text-[10px] opacity-75">{TIER_MG[t.tier]} mg/kg OWF</p>
                  </div>
                  <div className="p-3 text-xs space-y-2">
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">{T.fuzePerL}</p>
                      <p className="font-mono font-black text-xl text-slate-900">{r.gPerL != null ? fmt(r.gPerL, 1) : "—"} <span className="text-xs font-normal">{T.gPerL}</span></p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">{T.bathConc}</p>
                      <p className="font-mono font-bold">{r.bathConc != null ? fmt(r.bathConc, 2) : "—"} mg/L</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase">{T.dilution}</p>
                      <p className="font-mono font-bold">1 : {r.ratio != null ? fmt(r.ratio, 1) : "—"}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">{T.tierNote}</p>
        </section>

        {/* BATH VOLUME QUICK-REFERENCE */}
        {pickupUsed > 0 && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">{T.cookbookTitle}</h2>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase text-slate-600">{T.bathVol}</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F1 {T.total}</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F2 {T.total}</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F3 {T.total}</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F4 {T.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {STANDARD_BATHS_L.map((bathL) => (
                    <tr key={bathL} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-mono font-bold">{bathL} L</td>
                      {(["F1", "F2", "F3", "F4"] as const).map((tier, i) => {
                        const r = tierRecipe(tier);
                        if (r.gPerL == null) return <td key={i} className="px-3 py-2 text-right text-slate-300">—</td>;
                        const totalG = r.gPerL * bathL; // grams of FUZE stock
                        return (
                          <td key={i} className="px-3 py-2 text-right font-mono text-[#00b4c3] font-bold">
                            {totalG >= 1000 ? (totalG / 1000).toFixed(2) + " kg" : totalG.toFixed(0) + " g"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">{T.cookbookNote1} <strong>{T.cookbookNote2}</strong> {T.cookbookNote3} {T.pickupShort} {fmt(pickupUsed, 1)}% · {T.stockShort} {stock} mg/L.</p>
          </section>
        )}

        {/* WET-ON-WET PRODUCTION ADJUSTMENT */}
        {pickupUsed > 0 && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">{T.adjustmentTitle}</h2>
            <p className="text-xs text-slate-600 mb-3">
              {T.adjustmentIntro1} <strong>{T.adjustmentIntro2}</strong> {T.adjustmentIntro3} <strong>{T.adjustmentIntro4}</strong> {T.adjustmentIntro5}
              {" "}{T.effectivePickupFormula} ({fmt(pickupUsed, 1)}%) {T.minusMoisture}.
            </p>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase text-slate-600">{T.incomingMoisture}</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">{T.effectivePickup}</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F1 {T.gPerL} · 1:N</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F2 {T.gPerL} · 1:N</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F3 {T.gPerL} · 1:N</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-slate-600">F4 {T.gPerL} · 1:N</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 10, 15, 20].map((r) => {
                    const pEff = pickupUsed - r;
                    const row = [1.0, 0.75, 0.5, 0.25].map((mg) => {
                      if (pEff <= 0) return null;
                      const bathConc = mg / (pEff / 100);
                      const gPerL = (bathConc / stock) * 1000;
                      const ratio = stock / bathConc - 1;
                      return { bathConc, gPerL, ratio };
                    });
                    return (
                      <tr key={r} className={`border-t border-slate-200 ${r === 0 ? "bg-slate-50" : ""}`}>
                        <td className="px-3 py-2 font-mono font-bold">{r === 0 ? T.dryLabel : `${r}%`}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{pEff > 0 ? fmt(pEff, 1) + "%" : "—"}</td>
                        {row.map((v, i) => (
                          <td key={i} className="px-3 py-2 text-right font-mono text-[#00b4c3] font-bold">
                            {v ? (
                              <>
                                {fmt(v.gPerL, 1)} {T.gPerL} <span className="text-slate-500 text-[10px]">· 1:{fmt(v.ratio, 1)}</span>
                              </>
                            ) : (
                              <span className="text-red-600">{T.tooWet}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">{T.adjustmentFooter}</p>
          </section>
        )}

        {/* PAGE BREAK */}
        <div className="page-break" />

        {/* MEASUREMENTS */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">{T.measurements}</h2>

          {runs.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">{T.triplicateRuns}</p>
              <table className="w-full text-sm border border-slate-200 rounded overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-xs">{T.run}</th>
                    <th className="text-right px-3 py-1.5 text-xs">{T.dryG}</th>
                    <th className="text-right px-3 py-1.5 text-xs">{T.wetG}</th>
                    <th className="text-right px-3 py-1.5 text-xs">{T.pickupCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r: any) => (
                    <tr key={r.run} className="border-t border-slate-200">
                      <td className="px-3 py-1.5 font-semibold">#{r.run}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(r.dry, 3)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(r.wet, 3)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(r.pickup, 1)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-cyan-50 border-t-2 border-[#00b4c3]">
                    <td className="px-3 py-1.5 font-black">{T.mean}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(test.drySampleWeight, 3)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(test.wetAfterBathWeight, 3)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-black text-[#00b4c3]">{fmt(test.pickupDryToWetPct, 1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

        </section>

        {/* PROCESS PARAMETERS */}
        <section className="mb-6">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">{T.processParams}</h2>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.sampleArea}</td><td className="py-1.5 text-right font-mono">{test.sampleAreaCm2 || 100} cm²</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.squeezePressure}</td><td className="py-1.5 text-right font-mono">{test.squeezePressure != null ? `${test.squeezePressure} bar (${(test.squeezePressure * 0.1).toFixed(2)} MPa)` : "—"}</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.vfdFreq}</td><td className="py-1.5 text-right font-mono">{test.vfdFrequencyHz || "—"} Hz</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.lineSpeed}</td><td className="py-1.5 text-right font-mono">{fmt(test.lineSpeedMPerMin, 2)} m/min</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.drying}</td><td className="py-1.5 text-right font-mono">{test.dryingTemp ? `${test.dryingTemp}°C × ${test.dryingTime || "—"} min` : "—"}</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.curing}</td><td className="py-1.5 text-right font-mono">{test.curingTemp ? `${test.curingTemp}°C × ${test.curingTime || "—"} min` : "—"}</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.fuzeStock}</td><td className="py-1.5 text-right font-mono">{stock} mg/L</td></tr>
                  <tr className="border-b border-slate-200"><td className="py-1.5 text-slate-600">{T.liquorRatio}</td><td className="py-1.5 text-right font-mono">{test.liquorRatio || "—"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* TEST BATH + ICP */}
        {test.testedAtTier && (
          <section className="mb-6">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-3">{T.testBathTitle}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#00b4c3] rounded p-3 text-xs">
                <p className="text-slate-500 uppercase text-[10px] mb-1">{T.testBathApplied}</p>
                <p className="font-bold text-slate-900">{T.tier} {test.testedAtTier} · {fmt(test.testBathVolumeL, 2)} L {T.reservoir}</p>
                <p className="font-mono mt-1">{T.fuzeStockLabel}: <strong>{fmt(test.testBathFuzeMl, 1)} mL</strong> · {T.water}: <strong>{fmt(test.testBathWaterMl, 0)} mL</strong></p>
              </div>
              <div className="border border-slate-300 rounded p-3 text-xs">
                <p className="text-slate-500 uppercase text-[10px] mb-1">{T.icpVerification}</p>
                <p className="font-mono"><span className="text-slate-500">{T.expected}:</span> <strong>{fmt(test.icpExpectedPpm, 0)} ppm Ag</strong></p>
                {test.icpMeasuredPpm ? (
                  <>
                    <p className="font-mono"><span className="text-slate-500">{T.measured}:</span> <strong className="text-[#00b4c3]">{fmt(test.icpMeasuredPpm, 1)} ppm</strong></p>
                    {test.affinityPct && <p className="font-mono"><span className="text-slate-500">{T.affinity}:</span> <strong className={test.affinityPct >= 90 && test.affinityPct <= 110 ? "text-emerald-700" : "text-amber-700"}>{fmt(test.affinityPct, 1)}%</strong></p>}
                  </>
                ) : (
                  <p className="text-amber-700 italic mt-0.5">{T.resultPending}</p>
                )}
                {test.icpLab && <p className="text-[10px] text-slate-500 mt-1">{test.icpLab}{test.icpSampleId ? ` · ${test.icpSampleId}` : ""}</p>}
              </div>
            </div>
          </section>
        )}

        {/* METHODOLOGY */}
        <section className="mb-6 p-4 bg-slate-50 border-l-4 border-[#00b4c3] text-xs">
          <h2 className="font-black text-slate-900 uppercase tracking-wide mb-2">{T.methodology}</h2>
          <p className="text-slate-700">{T.methodologyBody(test.squeezePressure, test.vfdFrequencyHz, stock)}</p>
        </section>

        {/* NOTES + SIGNATURE */}
        {test.notes && (
          <section className="mb-4 text-sm">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">{T.labNotes}</h2>
            <p className="text-slate-700 italic border-l-4 border-slate-200 pl-3">{test.notes}</p>
          </section>
        )}

        <footer className="pt-4 mt-6 border-t-2 border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>{T.footerLeft}</span>
          <span>{T.footerRight} {new Date().toLocaleString(locale)}</span>
        </footer>
      </div>
    </div>
  );
}
