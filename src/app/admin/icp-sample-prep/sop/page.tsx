// @ts-nocheck
"use client";

/**
 * FUZE Lab — ICP-MS Sample Prep SOP (printable)
 *
 * Standard Operating Procedure for cutting, fragmenting, weighing, and
 * bagging treated fabric to ship to the external ICP-MS lab (CTLA, Utah).
 * Each step has an inline SVG illustration so the lab tech can see what
 * each action looks like without leaving the screen.
 *
 * Chemistry reference:
 *   • Ship mass target:    > 5 grams total fabric (ensures triplicate
 *                          digests + retain)
 *   • Digest mass target:  0.5 g per digestion (CTLA microwave aqua
 *                          regia protocol)
 *   • Sample geometry:     100 cm² fabric cutter (10 × 10 cm). Report
 *                          result as mg/kg fabric — geometry is only
 *                          for GSM cross-check, NOT the reported value.
 */

function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full aspect-[4/3] bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden print:border-slate-400 print:bg-white">
      {children}
    </div>
  );
}

// ─── Inline step illustrations (no external assets) ──────────
const ILLO: Record<string, React.ReactNode> = {
  confirm: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <rect x="20" y="25" width="160" height="100" rx="6" fill="#fff" stroke="#00b4c3" strokeWidth="2" />
      <rect x="30" y="38" width="100" height="6" fill="#00b4c3" rx="3" />
      <rect x="30" y="52" width="140" height="3" fill="#cbd5e1" rx="1.5" />
      <rect x="30" y="61" width="120" height="3" fill="#cbd5e1" rx="1.5" />
      <rect x="30" y="70" width="135" height="3" fill="#cbd5e1" rx="1.5" />
      <rect x="30" y="88" width="60" height="3" fill="#cbd5e1" rx="1.5" />
      <rect x="30" y="97" width="80" height="3" fill="#cbd5e1" rx="1.5" />
      <circle cx="160" cy="105" r="12" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
      <path d="M 154 105 L 159 110 L 167 101" stroke="#16a34a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cutwheel: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      {/* Fabric swatch */}
      <rect x="15" y="30" width="170" height="95" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
      <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3 L6 3 M3 0 L3 6" stroke="#0284c7" strokeWidth="0.4" opacity="0.5" /></pattern>
      <rect x="15" y="30" width="170" height="95" fill="url(#weave)" />
      {/* 10x10 cut square */}
      <rect x="65" y="55" width="60" height="60" fill="none" stroke="#00b4c3" strokeWidth="2.5" strokeDasharray="4 2" />
      <text x="95" y="89" textAnchor="middle" fontSize="9" fill="#00b4c3" fontWeight="700">100 cm²</text>
      <text x="95" y="100" textAnchor="middle" fontSize="7" fill="#00b4c3">(10 × 10 cm)</text>
      {/* Cutter handle */}
      <circle cx="150" cy="45" r="12" fill="#475569" />
      <circle cx="150" cy="45" r="8" fill="#94a3b8" />
      <circle cx="150" cy="45" r="3" fill="#475569" />
      <rect x="148" y="15" width="4" height="22" fill="#475569" rx="1" />
    </svg>
  ),
  weigh: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      {/* Balance */}
      <rect x="40" y="95" width="120" height="30" fill="#1e293b" rx="4" />
      <rect x="60" y="70" width="80" height="30" fill="#334155" rx="2" />
      <rect x="65" y="75" width="70" height="18" fill="#111827" rx="1" />
      <text x="100" y="87" textAnchor="middle" fontSize="12" fill="#a3e635" fontFamily="monospace" fontWeight="700">5.34 g</text>
      {/* Pan */}
      <rect x="55" y="62" width="90" height="4" fill="#94a3b8" rx="1" />
      {/* Fabric on pan */}
      <rect x="70" y="45" width="60" height="18" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1" />
      <pattern id="weave2" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 2 L4 2 M2 0 L2 4" stroke="#0284c7" strokeWidth="0.3" /></pattern>
      <rect x="70" y="45" width="60" height="18" fill="url(#weave2)" />
      {/* Target callout */}
      <rect x="150" y="10" width="45" height="32" fill="#00b4c3" rx="3" />
      <text x="172" y="22" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700">TARGET</text>
      <text x="172" y="33" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="800">&gt; 5 g</text>
    </svg>
  ),
  fragment: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      {/* scissors */}
      <g transform="translate(30 30)">
        <circle cx="0" cy="0" r="8" fill="none" stroke="#475569" strokeWidth="2" />
        <circle cx="0" cy="18" r="8" fill="none" stroke="#475569" strokeWidth="2" />
        <line x1="5" y1="5" x2="35" y2="22" stroke="#475569" strokeWidth="2" />
        <line x1="5" y1="13" x2="35" y2="-4" stroke="#475569" strokeWidth="2" />
      </g>
      {/* Original square */}
      <rect x="85" y="25" width="28" height="28" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1" opacity="0.4" />
      <text x="99" y="45" textAnchor="middle" fontSize="6" fill="#0284c7">10×10</text>
      {/* Arrow */}
      <path d="M 120 40 L 135 40 M 130 35 L 135 40 L 130 45" stroke="#00b4c3" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Fragments */}
      <g transform="translate(50 70)">
        {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(i => {
          const row = Math.floor(i / 5);
          const col = i % 5;
          return (
            <rect key={i} x={col * 22} y={row * 18} width="18" height="14" fill="#bae6fd" stroke="#0284c7" strokeWidth="0.5" />
          );
        })}
      </g>
      <text x="160" y="135" textAnchor="middle" fontSize="8" fill="#475569">~5×5 mm bits</text>
    </svg>
  ),
  bag: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      {/* Zip-lock bag */}
      <rect x="50" y="28" width="100" height="110" fill="#f8fafc" stroke="#475569" strokeWidth="2" rx="3" />
      <rect x="50" y="28" width="100" height="10" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
      <line x1="55" y1="33" x2="145" y2="33" stroke="#64748b" strokeDasharray="2 1" />
      {/* Label */}
      <rect x="62" y="48" width="76" height="42" fill="#fff" stroke="#00b4c3" strokeWidth="1.5" />
      <rect x="66" y="52" width="40" height="4" fill="#00b4c3" rx="1" />
      <rect x="66" y="60" width="60" height="2" fill="#cbd5e1" rx="1" />
      <rect x="66" y="66" width="50" height="2" fill="#cbd5e1" rx="1" />
      <rect x="66" y="72" width="55" height="2" fill="#cbd5e1" rx="1" />
      <rect x="66" y="79" width="40" height="6" fill="#00b4c3" rx="1" />
      {/* Fragments inside */}
      <g opacity="0.85">
        {[0,1,2,3,4,5].map(i => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          return (
            <rect key={i} x={70 + col * 22} y={100 + row * 12} width="16" height="9" fill="#bae6fd" stroke="#0284c7" strokeWidth="0.5" />
          );
        })}
      </g>
    </svg>
  ),
  print: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <rect x="25" y="55" width="150" height="55" fill="#475569" rx="4" />
      <rect x="45" y="30" width="110" height="45" fill="#fff" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="50" y="38" width="60" height="4" fill="#00b4c3" rx="1" />
      <rect x="50" y="46" width="95" height="2" fill="#cbd5e1" rx="1" />
      <rect x="50" y="52" width="80" height="2" fill="#cbd5e1" rx="1" />
      <rect x="50" y="58" width="90" height="2" fill="#cbd5e1" rx="1" />
      <rect x="50" y="64" width="45" height="4" fill="#00b4c3" rx="1" />
      {/* Paper coming out */}
      <rect x="45" y="90" width="110" height="35" fill="#fff" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="52" y="98" width="60" height="3" fill="#64748b" rx="1" />
      <rect x="52" y="105" width="90" height="2" fill="#cbd5e1" rx="1" />
      <rect x="52" y="111" width="75" height="2" fill="#cbd5e1" rx="1" />
      <rect x="52" y="117" width="85" height="2" fill="#cbd5e1" rx="1" />
    </svg>
  ),
  ship: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      {/* Box */}
      <path d="M 40 55 L 100 35 L 160 55 L 160 115 L 100 135 L 40 115 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
      <path d="M 40 55 L 100 75 L 160 55" fill="none" stroke="#92400e" strokeWidth="2" />
      <line x1="100" y1="75" x2="100" y2="135" stroke="#92400e" strokeWidth="2" />
      {/* Tape */}
      <rect x="93" y="35" width="14" height="46" fill="#fef3c7" stroke="#92400e" strokeWidth="0.5" opacity="0.8" />
      {/* Shipping label */}
      <rect x="55" y="82" width="38" height="24" fill="#fff" stroke="#1e293b" strokeWidth="1" />
      <rect x="58" y="85" width="22" height="3" fill="#1e293b" />
      <rect x="58" y="90" width="30" height="1.5" fill="#64748b" />
      <rect x="58" y="94" width="25" height="1.5" fill="#64748b" />
      <rect x="58" y="98" width="28" height="2.5" fill="#00b4c3" />
      {/* To: CTLA */}
      <text x="100" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e293b">→ CTLA LAB, UTAH</text>
    </svg>
  ),
  request: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      {/* Monitor */}
      <rect x="20" y="20" width="160" height="95" rx="4" fill="#1e293b" />
      <rect x="25" y="25" width="150" height="85" fill="#f8fafc" />
      <rect x="85" y="120" width="30" height="8" fill="#1e293b" />
      <rect x="70" y="128" width="60" height="4" fill="#1e293b" rx="1" />
      {/* Form */}
      <rect x="32" y="32" width="90" height="5" fill="#00b4c3" rx="1" />
      <rect x="32" y="42" width="136" height="10" fill="#fff" stroke="#cbd5e1" strokeWidth="0.5" />
      <text x="35" y="50" fontSize="6" fill="#475569">Lab: CTLA (Utah)</text>
      <rect x="32" y="55" width="136" height="10" fill="#fff" stroke="#cbd5e1" strokeWidth="0.5" />
      <text x="35" y="63" fontSize="6" fill="#475569">Samples: FUZE-1042, FUZE-1043, FUZE-1044</text>
      <rect x="32" y="68" width="136" height="10" fill="#fff" stroke="#cbd5e1" strokeWidth="0.5" />
      <text x="35" y="76" fontSize="6" fill="#475569">Tests: ICP-MS — Ag mg/kg fabric</text>
      {/* Submit button */}
      <rect x="120" y="88" width="50" height="16" fill="#00b4c3" rx="3" />
      <text x="145" y="99" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700">REQUEST TEST</text>
    </svg>
  ),
};

const STEPS: { title: string; body: string; illo: keyof typeof ILLO; tips?: string[] }[] = [
  {
    title: "Pull the fabric record",
    body:
      "Open the Atlas ICP Sample Prep wizard and pick the fabric from the library. Fabric ID, FUZE number, fiber content, construction, color, weight (g/m²), applied tier, recipe, and bench test ID auto-fill into the form. Confirm nothing is missing — especially color and customer fabric code, since CTLA's invoice lists by fabric.",
    illo: "confirm",
  },
  {
    title: "Cut with the 100 cm² wheel",
    body:
      "Use the 100 cm² (10 × 10 cm) fabric cutter. Gram weight — NOT fabric size — is what CTLA needs, but the square gives you a clean geometry for optical inspection and a sanity-check against the fabric's recorded g/m². Cut clean edges; avoid the roll edge and any visible folds or creases.",
    illo: "cutwheel",
    tips: [
      "If the fabric is heavy (> 500 g/m²), one 10×10 square often hits > 5 g already.",
      "If the fabric is light (< 100 g/m²), cut two or three 10×10 squares from the treated batch.",
    ],
  },
  {
    title: "Weigh to > 5 grams",
    body:
      "Place the cut fabric on the analytical balance. Keep adding squares until the gross mass is > 5 g. This is the SHIPPING mass — CTLA will pull 0.5 g from it for each microwave aqua-regia digest and keep the remainder as a retain. The wizard accepts a mass entry per sample; record it to 0.01 g.",
    illo: "weigh",
    tips: [
      "> 5 g = enough for triplicate digests (3 × 0.5 g) + retain.",
      "If you can only get 2–5 g, enter it anyway. Note in the form that retesting may consume the full sample.",
    ],
  },
  {
    title: "Fragment into ~5 mm bits",
    body:
      "Once weighed, cut the fabric down into small fragments (about 5 × 5 mm). Fragmenting is the biggest digestion-efficiency lever — a bigger surface area means the microwave aqua-regia at CTLA fully digests the fabric without a second run. Use clean scissors, a rotary cutter, or a fabric shredder. Avoid touching fragments with bare fingers.",
    illo: "fragment",
    tips: [
      "Do this on a clean sheet of weigh paper, not directly on the bench.",
      "Decontaminate scissors between samples with 70% isopropanol — no cross-contamination between FUZE-tiers.",
    ],
  },
  {
    title: "Bag + label the sample",
    body:
      "Drop the fragments into a zip-top plastic bag. Print the Atlas-generated sample tag from the wizard and seal it INSIDE the bag (or tape it to the outside if you prefer — always both the FUZE number and the PO number should be visible). The tag is the single link between the physical bag and the test record.",
    illo: "bag",
    tips: [
      "One bag = one fabric sample = one line item on the CTLA PO.",
      "If you are shipping multiple fabrics in one box, do NOT commingle fragments — one bag each.",
    ],
  },
  {
    title: "Print the completed submission form",
    body:
      "The wizard produces a single multi-sample submission packet plus one sample tag per fabric. Print both. The packet goes on top inside the shipping box (CTLA reads this to set up the job). The sample tag goes with each individual bag. Keep a copy of the packet for your records — Atlas also keeps the PDF on the PO record.",
    illo: "print",
    tips: [
      "Print single-sided on plain white paper. No color needed.",
      "Double-check: every bag has a tag, and the packet lists every bag.",
    ],
  },
  {
    title: "Request the test → pick CTLA",
    body:
      "In the wizard's final step, click \"Request Test\" and choose CTLA (Utah) as the lab. Atlas creates ONE FUZE PO (e.g. FUZE-PO-20260416-0001) covering ALL the fabric samples in the batch — one line per fabric, each billed by fabric submission number. This is how we track PO status, CTLA invoices, and cost per fabric from one screen.",
    illo: "request",
    tips: [
      "Billing: ask CTLA to invoice per fabric submission number so our accounting matches the Atlas PO lines.",
      "Urgency: if rush, flag each line — CTLA usually quotes a 5-day rush vs. 10-day standard.",
    ],
  },
  {
    title: "Ship to CTLA (Utah)",
    body:
      "Drop the shipping box into FedEx or UPS with tracking. Declare low value. No hazardous materials marking is needed for untreated or FUZE-treated fabric. Enter the tracking number back in Atlas (Sample Tracking) so the record closes out the loop: PO → shipped → CTLA received → digested → results → billed.",
    illo: "ship",
    tips: [
      "CTLA Laboratories — address populated automatically in the wizard.",
      "Use the box tape securely — scissors cut acids if they leak, but dry fabric travels fine.",
    ],
  },
];

export default function IcpSamplePrepSOPPage() {
  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.4in; size: letter; }
        }
      `}</style>

      <div className="no-print max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
        <a href="/admin/icp-sample-prep" className="text-sm text-[#00b4c3] font-semibold">← Back to ICP Sample Prep</a>
        <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 print:p-0">
        {/* Header */}
        <header className="border-b-4 border-[#00b4c3] pb-4 mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-[#00b4c3] tracking-widest uppercase">FUZE Biotech · Lab SOP</p>
            <h1 className="text-3xl font-black text-slate-900 mt-1">ICP-MS Sample Preparation</h1>
            <p className="text-sm text-slate-600 mt-1">Cut → weigh → fragment → bag → ship to CTLA (Utah) for ICP-MS verification</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Doc: SOP-FUZE-LAB-002</p>
            <p>Rev: 1.0 · {new Date().toLocaleDateString()}</p>
          </div>
        </header>

        {/* Purpose + Equipment */}
        <section className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <h2 className="font-black text-slate-900 mb-1 text-sm uppercase tracking-wide">Purpose</h2>
            <p className="text-slate-700 leading-snug">
              Prepare a treated fabric sample for ICP-MS quantification of FUZE metamaterial (silver, CAS 7440-22-4)
              reported as <strong>mg/kg fabric</strong>. Digestion happens at CTLA Laboratories (Utah) using microwave-assisted
              aqua-regia, and the reported value confirms the recipe we developed on our bench.
            </p>
          </div>
          <div>
            <h2 className="font-black text-slate-900 mb-1 text-sm uppercase tracking-wide">Equipment</h2>
            <ul className="text-slate-700 leading-snug list-disc pl-4 space-y-0.5">
              <li>100 cm² fabric cutter (10 × 10 cm)</li>
              <li>Analytical balance (0.01 g or better)</li>
              <li>Clean scissors or rotary cutter</li>
              <li>Zip-top plastic bags (one per fabric)</li>
              <li>Plain white paper (for printed tags + packet)</li>
              <li>70% isopropanol (decontaminate cutter between samples)</li>
              <li>Weigh paper / clean bench surface</li>
            </ul>
          </div>
        </section>

        {/* Mass callout */}
        <section className="mb-6 bg-[#00b4c3]/5 border-l-4 border-[#00b4c3] px-5 py-4 text-sm">
          <h2 className="font-black text-slate-900 mb-2 uppercase tracking-wide text-xs">Mass Targets (critical)</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase">Ship to CTLA</p>
              <p className="text-2xl font-black text-[#00b4c3]">&gt; 5 g</p>
              <p className="text-xs text-slate-600">Gross fabric mass. Gram-weight based, NOT size-based — heavy/light fabrics differ.</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Digest per run</p>
              <p className="text-2xl font-black text-[#00b4c3]">0.5 g</p>
              <p className="text-xs text-slate-600">CTLA pulls 0.5 g from your shipped mass for each microwave aqua-regia digest.</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Cutter geometry</p>
              <p className="text-2xl font-black text-[#00b4c3]">100 cm²</p>
              <p className="text-xs text-slate-600">10 × 10 cm wheel. Geometry is for GSM cross-check; reported ppm is by mass.</p>
            </div>
          </div>
        </section>

        {/* Critical rules */}
        <section className="mb-6 bg-amber-50 border-l-4 border-amber-500 px-5 py-3 text-xs">
          <h2 className="font-black text-slate-900 mb-2 uppercase tracking-wide">⚠ Critical Prep Rules</h2>
          <ol className="space-y-1 pl-5 list-decimal text-slate-700">
            <li><strong>Gram weight, not size.</strong> Cut to &gt; 5 g of fabric — one 10×10 may be plenty, or you may need three. Record the actual mass to 0.01 g.</li>
            <li><strong>Fragment before bagging.</strong> ~5 × 5 mm bits dramatically improve digest completeness. Big intact squares can leave un-digested fiber = low apparent ppm.</li>
            <li><strong>One fabric per bag.</strong> Never commingle tiers or lots. Each bag must match one Atlas sample tag and one CTLA line item.</li>
            <li><strong>Decontaminate between samples.</strong> Wipe cutter and scissors with 70% isopropanol between fabrics. Silver cross-contamination falsifies low-tier results.</li>
            <li><strong>Gloves on.</strong> Don't touch fragments bare-handed — skin contact can shed particulates onto the fabric.</li>
            <li><strong>Ship dry.</strong> No wet samples, no pre-wetted pad samples. Wet fabric skews the per-mass ppm.</li>
          </ol>
        </section>

        {/* Step cards — 2 per row on screen, 2 per row on print */}
        <section className="mb-8">
          <h2 className="font-black text-slate-900 mb-4 text-sm uppercase tracking-wide">Procedure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print:grid-cols-2 print:gap-3">
            {STEPS.map((step, i) => (
              <div key={i} className="border border-slate-200 rounded-lg overflow-hidden print:border-slate-400 print:break-inside-avoid">
                <div className="flex items-start gap-3 p-3 bg-slate-50 border-b border-slate-200 print:bg-white">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-black flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{step.title}</h3>
                  </div>
                </div>
                <div className="p-3">
                  <div className="mb-3">
                    <StepIcon>{ILLO[step.illo]}</StepIcon>
                  </div>
                  <p className="text-xs text-slate-700 leading-snug">{step.body}</p>
                  {step.tips && step.tips.length > 0 && (
                    <ul className="mt-2 space-y-0.5 pl-4 list-disc text-[11px] text-slate-600">
                      {step.tips.map((t, j) => <li key={j}>{t}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTLA address */}
        <section className="mb-4 border border-slate-300 rounded-lg p-4 text-sm">
          <h2 className="font-black text-slate-900 mb-2 uppercase tracking-wide text-xs">Shipping Address (auto-filled by wizard)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase">Ship to</p>
              <p className="font-bold text-slate-900">CTLA Laboratories</p>
              <p className="text-xs text-slate-700">Chemical Technology Laboratory of America</p>
              <p className="text-xs text-slate-700">Attn: ICP-MS Intake</p>
              <p className="text-xs text-slate-700">Utah, USA</p>
              <p className="text-[11px] text-slate-500 mt-1 italic">Full street address auto-populates on the printed packet from the Lab Directory.</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Return address + reporting</p>
              <p className="font-bold text-slate-900">FUZE Biotech</p>
              <p className="text-xs text-slate-700">1895 West 2100 South</p>
              <p className="text-xs text-slate-700">Salt Lake City, UT 84119 USA</p>
              <p className="text-xs text-slate-700 mt-1">Report to: <span className="font-semibold">andrew@fuze47.com</span></p>
              <p className="text-xs text-slate-700">Invoice per fabric submission number (Atlas PO line)</p>
            </div>
          </div>
        </section>

        {/* What you're NOT missing */}
        <section className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
          <h2 className="font-black text-slate-900 mb-2 uppercase tracking-wide">✅ Pre-Ship Checklist (the wizard prints this on the packet)</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-700">
            <li>☐ Fabric record pulled, details confirmed (color, tier, customer code)</li>
            <li>☐ 100 cm² square(s) cut — clean edges, no folds</li>
            <li>☐ Mass weighed to 0.01 g and &gt; 5 g</li>
            <li>☐ Fragments ~5×5 mm</li>
            <li>☐ One fabric per bag, sealed</li>
            <li>☐ Tag printed + placed inside bag</li>
            <li>☐ Packet printed + on top of the box</li>
            <li>☐ Cutter + scissors decontaminated between fabrics</li>
            <li>☐ CTLA selected in Request Test → PO created</li>
            <li>☐ Tracking number entered in Atlas after drop-off</li>
          </ul>
        </section>

        {/* Sanity */}
        <section className="mb-4 text-xs">
          <h2 className="font-black text-slate-900 mb-1 uppercase tracking-wide">Sanity Check (what CTLA should report)</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-700">
            <span>Target F1 fabric</span><span className="font-mono">~1.0 mg/kg Ag (±20%)</span>
            <span>Target F2 fabric</span><span className="font-mono">~0.75 mg/kg Ag (±20%)</span>
            <span>Target F3 fabric</span><span className="font-mono">~0.5 mg/kg Ag (±20%)</span>
            <span>Target F4 fabric</span><span className="font-mono">~0.25 mg/kg Ag (±25%)</span>
            <span>Untreated control</span><span className="font-mono">&lt; 0.05 mg/kg Ag</span>
            <span>Method detection limit</span><span className="font-mono">~0.01 mg/kg</span>
          </div>
          <p className="mt-2 italic text-slate-600">If the reported ppm is &gt; 2× target, retest on a fresh sample — digest carry-over is common on dirty instruments.</p>
        </section>

        <footer className="mt-6 pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>FUZE Biotech · 1895 West 2100 South, Salt Lake City, UT 84119 USA</span>
          <span>Questions: andrew@fuze47.com · Lab: lab@fuze47.com</span>
        </footer>
      </div>
    </div>
  );
}
