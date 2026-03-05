"use client";
import { useState, useEffect } from "react";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterFabricType, setFilterFabricType] = useState("");
  const [filterFuzeTier, setFilterFuzeTier] = useState("");
  const [filterAppMethod, setFilterAppMethod] = useState("");

  const [matchMode, setMatchMode] = useState(false);
  const [matchGsm, setMatchGsm] = useState("");
  const [matchFiber, setMatchFiber] = useState("");
  const [matchYarn, setMatchYarn] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    name: "",
    fabricType: "",
    fiberContent: "",
    gsmMin: "",
    gsmMax: "",
    yarnType: "",
    fuzeTier: "",
    applicationMethod: "",
    padPickupPercent: "",
    bathConcentration: "",
    squeezePressure: "",
    dryingTemp: "",
    dryingTime: "",
    curingTemp: "",
    curingTime: "",
    phRange: "",
    avgIcpAg: "",
    avgReduction: "",
    testMethod: "",
    passRate: "",
    notes: "",
  });

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (matchMode) {
        if (matchGsm) params.append("matchGsm", matchGsm);
        if (matchFiber) params.append("matchFiber", matchFiber);
        if (matchYarn) params.append("matchYarn", matchYarn);
        params.append("convert", "true");
      } else {
        if (filterFabricType) params.append("fabricType", filterFabricType);
        if (filterFuzeTier) params.append("fuzeTier", filterFuzeTier);
        if (filterAppMethod) params.append("applicationMethod", filterAppMethod);
      }

      const res = await fetch(`/api/recipes?${params}`);
      const data = await res.json();
      if (data.ok) {
        setRecipes(data.recipes);
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (matchMode) {
      fetchRecipes();
    } else {
      fetchRecipes();
    }
  }, [
    filterFabricType,
    filterFuzeTier,
    filterAppMethod,
    matchMode,
    matchGsm,
    matchFiber,
    matchYarn,
  ]);

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newRecipe,
        gsmMin: newRecipe.gsmMin ? parseFloat(newRecipe.gsmMin) : null,
        gsmMax: newRecipe.gsmMax ? parseFloat(newRecipe.gsmMax) : null,
        padPickupPercent: newRecipe.padPickupPercent
          ? parseFloat(newRecipe.padPickupPercent)
          : null,
        bathConcentration: newRecipe.bathConcentration
          ? parseFloat(newRecipe.bathConcentration)
          : null,
        squeezePressure: newRecipe.squeezePressure
          ? parseFloat(newRecipe.squeezePressure)
          : null,
        dryingTemp: newRecipe.dryingTemp ? parseFloat(newRecipe.dryingTemp) : null,
        dryingTime: newRecipe.dryingTime ? parseFloat(newRecipe.dryingTime) : null,
        curingTemp: newRecipe.curingTemp ? parseFloat(newRecipe.curingTemp) : null,
        curingTime: newRecipe.curingTime ? parseFloat(newRecipe.curingTime) : null,
        avgIcpAg: newRecipe.avgIcpAg ? parseFloat(newRecipe.avgIcpAg) : null,
        avgReduction: newRecipe.avgReduction ? parseFloat(newRecipe.avgReduction) : null,
        passRate: newRecipe.passRate ? parseFloat(newRecipe.passRate) : null,
      };

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        setShowCreateForm(false);
        setNewRecipe({
          name: "",
          fabricType: "",
          fiberContent: "",
          gsmMin: "",
          gsmMax: "",
          yarnType: "",
          fuzeTier: "",
          applicationMethod: "",
          padPickupPercent: "",
          bathConcentration: "",
          squeezePressure: "",
          dryingTemp: "",
          dryingTime: "",
          curingTemp: "",
          curingTime: "",
          phRange: "",
          avgIcpAg: "",
          avgReduction: "",
          testMethod: "",
          passRate: "",
          notes: "",
        });
        fetchRecipes();
      }
    } catch (error) {
      console.error("Error creating recipe:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Recipe Library</h1>
            <p className="text-slate-600 mt-1">
              Treatment parameters for fabric types and finishes
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all"
          >
            {showCreateForm ? "Cancel" : "Create Recipe"}
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">New Recipe</h3>
            <form
              onSubmit={handleCreateRecipe}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <input
                type="text"
                placeholder="Recipe Name *"
                value={newRecipe.name}
                onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                required
                className="col-span-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              />

              <select
                value={newRecipe.fabricType}
                onChange={(e) => setNewRecipe({ ...newRecipe, fabricType: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              >
                <option value="">Fabric Type</option>
                <option value="Knit">Knit</option>
                <option value="Woven">Woven</option>
                <option value="Nonwoven">Nonwoven</option>
              </select>

              <input
                type="text"
                placeholder="Fiber Content"
                value={newRecipe.fiberContent}
                onChange={(e) => setNewRecipe({ ...newRecipe, fiberContent: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              />

              <select
                value={newRecipe.fuzeTier}
                onChange={(e) => setNewRecipe({ ...newRecipe, fuzeTier: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              >
                <option value="">FUZE Tier</option>
                <option value="F1">F1</option>
                <option value="F2">F2</option>
                <option value="F3">F3</option>
                <option value="F4">F4</option>
              </select>

              <select
                value={newRecipe.applicationMethod}
                onChange={(e) => setNewRecipe({ ...newRecipe, applicationMethod: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              >
                <option value="">Application Method</option>
                <option value="Pad">Pad</option>
                <option value="Exhaust">Exhaust</option>
                <option value="Spray">Spray</option>
                <option value="Foam">Foam</option>
              </select>

              <input
                type="number"
                placeholder="Avg ICP Ag (ppm)"
                value={newRecipe.avgIcpAg}
                onChange={(e) => setNewRecipe({ ...newRecipe, avgIcpAg: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              />

              <input
                type="number"
                placeholder="Avg Reduction (%)"
                value={newRecipe.avgReduction}
                onChange={(e) => setNewRecipe({ ...newRecipe, avgReduction: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              />

              <input
                type="number"
                placeholder="Pass Rate (%)"
                value={newRecipe.passRate}
                onChange={(e) => setNewRecipe({ ...newRecipe, passRate: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
              />

              <textarea
                placeholder="Notes"
                value={newRecipe.notes}
                onChange={(e) => setNewRecipe({ ...newRecipe, notes: e.target.value })}
                className="col-span-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                rows={2}
              />

              <button
                type="submit"
                className="col-span-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-2 rounded-lg font-medium text-sm hover:shadow-lg transition-all"
              >
                Create Recipe
              </button>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setMatchMode(!matchMode)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                !matchMode
                  ? "bg-[#00b4c3] text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setMatchMode(!matchMode)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                matchMode
                  ? "bg-[#00b4c3] text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Find Similar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {matchMode ? (
              <>
                <input
                  type="number"
                  placeholder="GSM"
                  value={matchGsm}
                  onChange={(e) => setMatchGsm(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
                <input
                  type="text"
                  placeholder="Fiber Content (e.g., Cotton)"
                  value={matchFiber}
                  onChange={(e) => setMatchFiber(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
                <input
                  type="text"
                  placeholder="Yarn Type"
                  value={matchYarn}
                  onChange={(e) => setMatchYarn(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </>
            ) : (
              <>
                <select
                  value={filterFabricType}
                  onChange={(e) => setFilterFabricType(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">All Fabric Types</option>
                  <option value="Knit">Knit</option>
                  <option value="Woven">Woven</option>
                  <option value="Nonwoven">Nonwoven</option>
                </select>

                <select
                  value={filterFuzeTier}
                  onChange={(e) => setFilterFuzeTier(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">All FUZE Tiers</option>
                  <option value="F1">F1</option>
                  <option value="F2">F2</option>
                  <option value="F3">F3</option>
                  <option value="F4">F4</option>
                </select>

                <select
                  value={filterAppMethod}
                  onChange={(e) => setFilterAppMethod(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">All Methods</option>
                  <option value="Pad">Pad</option>
                  <option value="Exhaust">Exhaust</option>
                  <option value="Spray">Spray</option>
                  <option value="Foam">Foam</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Recipes Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-600">Loading...</div>
        ) : recipes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-600">No recipes found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-900">
                      {recipe.name}
                    </h3>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {recipe.fabricType && (
                        <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
                          {recipe.fabricType}
                        </span>
                      )}
                      {recipe.fuzeTier && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded">
                          {recipe.fuzeTier}
                        </span>
                      )}
                      {recipe.applicationMethod && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded">
                          {recipe.applicationMethod}
                        </span>
                      )}
                    </div>
                  </div>

                  {recipe.matchScore && (
                    <div className="mb-4 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="text-xs text-emerald-800 font-medium">
                        Match Score: {recipe.matchScore}%
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    {recipe.fiberContent && (
                      <div className="flex justify-between text-slate-600">
                        <span>Fiber:</span>
                        <span className="font-medium text-slate-900">
                          {recipe.fiberContent}
                        </span>
                      </div>
                    )}
                    {recipe.avgIcpAg && (
                      <div className="flex justify-between text-slate-600">
                        <span>Avg ICP Ag:</span>
                        <span className="font-medium text-slate-900">
                          {recipe.avgIcpAg} ppm
                        </span>
                      </div>
                    )}
                    {recipe.avgReduction && (
                      <div className="flex justify-between text-slate-600">
                        <span>Avg Reduction:</span>
                        <span className="font-medium text-slate-900">
                          {recipe.avgReduction}%
                        </span>
                      </div>
                    )}
                    {recipe.passRate && (
                      <div className="flex justify-between text-slate-600">
                        <span>Pass Rate:</span>
                        <span className="font-medium text-slate-900">
                          {recipe.passRate}%
                        </span>
                      </div>
                    )}
                  </div>

                  {recipe.notes && (
                    <p className="mt-4 text-xs text-slate-600 border-t border-slate-100 pt-4">
                      {recipe.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
