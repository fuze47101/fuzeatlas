"use client";
import FuzePickupCalculator from "@/components/FuzePickupCalculator";

export default function PickupCalculatorPage() {
  return (
    <div className="max-w-[1000px] mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Application Calculator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Calculate FUZE bath concentration, spray parameters, and volume requirements for your application method.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Looking for cost per meter? See the <a href="/pricing" className="underline text-emerald-700 hover:text-emerald-900">Pricing Calculator</a>.
        </p>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <FuzePickupCalculator />
      </div>
    </div>
  );
}
