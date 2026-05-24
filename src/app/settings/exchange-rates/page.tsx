"use client";
import { useState, useEffect } from "react";
import { formatCurrency, CURRENCIES } from "@/lib/currency";
import { useI18n } from "@/i18n";

export default function ExchangeRatesPage() {
  const { t } = useI18n();
  const T = t.settingsExchangeRates;
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [convertFrom, setConvertFrom] = useState("USD");
  const [convertTo, setConvertTo] = useState("CNY");
  const [convertAmount, setConvertAmount] = useState("100");
  const [convertResult, setConvertResult] = useState<any>(null);

  const [showForm, setShowForm] = useState(false);
  const [newRate, setNewRate] = useState({
    fromCurrency: "USD",
    toCurrency: "CNY",
    rate: "",
    source: "manual",
  });

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exchange-rates");
      const data = await res.json();
      if (data.ok) {
        setRates(data.rates);
      }
    } catch (error) {
      console.error("Error fetching rates:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleConvert = async () => {
    try {
      const params = new URLSearchParams({
        convert: "true",
        from: convertFrom,
        to: convertTo,
        amount: convertAmount,
      });

      const res = await fetch(`/api/exchange-rates?${params}`);
      const data = await res.json();

      if (data.ok) {
        setConvertResult(data);
      }
    } catch (error) {
      console.error("Error converting:", error);
    }
  };

  const handleCreateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRate,
          rate: parseFloat(newRate.rate),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setNewRate({
          fromCurrency: "USD",
          toCurrency: "CNY",
          rate: "",
          source: "manual",
        });
        fetchRates();
      }
    } catch (error) {
      console.error("Error creating rate:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{T.title}</h1>
            <p className="text-slate-600 mt-1">
              {T.subtitle}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all"
          >
            {showForm ? T.cancelBtn : T.addRateBtn}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{T.addFormTitle}</h3>
            <form onSubmit={handleCreateRate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                value={newRate.fromCurrency}
                onChange={(e) => setNewRate({ ...newRate, fromCurrency: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-center text-slate-600">
                →
              </div>

              <select
                value={newRate.toCurrency}
                onChange={(e) => setNewRate({ ...newRate, toCurrency: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder={T.ratePlaceholder}
                step="0.001"
                value={newRate.rate}
                onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                required
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              />

              <button
                type="submit"
                className="col-span-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-2 rounded-lg font-medium text-sm hover:shadow-lg transition-all"
              >
                {T.submitAddBtn}
              </button>
            </form>
          </div>
        )}

        {/* Converter */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {T.converterTitle}
            </h3>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {T.fromLabel}
                </label>
                <select
                  value={convertFrom}
                  onChange={(e) => setConvertFrom(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {T.toLabel}
                </label>
                <select
                  value={convertTo}
                  onChange={(e) => setConvertTo(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {T.amountLabel}
                </label>
                <input
                  type="number"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleConvert}
              className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-2 rounded-lg font-medium text-sm hover:shadow-lg transition-all"
            >
              {T.convertBtn}
            </button>

            {convertResult && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-800">
                  <span className="font-bold">
                    {formatCurrency(convertResult.amount, convertResult.from)}
                  </span>
                  {" = "}
                  <span className="font-bold">
                    {formatCurrency(convertResult.converted, convertResult.to)}
                  </span>
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {T.rateResultPrefix} 1 {convertResult.from} = {convertResult.rate}{" "}
                  {convertResult.to}
                </p>
              </div>
            )}
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-sm p-6 text-white">
            <h4 className="font-semibold mb-4">{T.quickStatsTitle}</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-400">{T.totalCurrenciesLabel}</p>
                <p className="text-2xl font-bold">{CURRENCIES.length}</p>
              </div>
              <div>
                <p className="text-slate-400">{T.activeRatesLabel}</p>
                <p className="text-2xl font-bold">{rates.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rates Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              {T.currentRatesTitle}
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-600">{T.loading}</div>
          ) : rates.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              {T.emptyState}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      {T.colCurrencyPair}
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      {T.colRate}
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      {T.colEffectiveDate}
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      {T.colSource}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900">
                          {rate.fromCurrency}
                        </span>
                        <span className="text-slate-500 mx-2">→</span>
                        <span className="font-medium text-slate-900">
                          {rate.toCurrency}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-slate-900">
                          1 {rate.fromCurrency} = {rate.rate}{" "}
                          {rate.toCurrency}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(rate.effectiveDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {rate.source || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
