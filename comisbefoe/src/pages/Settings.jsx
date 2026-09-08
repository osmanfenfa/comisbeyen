import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  Settings as SettingsIcon, Save, ShieldAlert, CheckCircle, 
  AlertCircle, DollarSign, Percent, Building
} from "lucide-react";

export default function Settings() {
  const { role } = useAuthStore();
  const { fetchSettings } = useAppStore();

  const isAdmin = role === "system_admin";

  const [stationName, setStationName] = useState("");
  const [standardMoisture, setStandardMoisture] = useState("");
  const [cocoaPrice, setCocoaPrice] = useState("");
  const [coffeePrice, setCoffeePrice] = useState("");
  const [colaPrice, setColaPrice] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/settings/");
      setStationName(data.station_name || "Main Buying Station");
      setStandardMoisture(data.standard_moisture_percent?.toString() || "7.0");
      setCocoaPrice(data.cocoa_price_per_kg?.toString() || "25.0");
      setCoffeePrice(data.coffee_price_per_kg?.toString() || "20.0");
      setColaPrice(data.cola_price_per_kg?.toString() || "15.0");
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = {
        station_name: stationName,
        cocoa_price_per_kg: parseFloat(cocoaPrice),
        coffee_price_per_kg: parseFloat(coffeePrice),
        cola_price_per_kg: parseFloat(colaPrice),
      };

      if (isAdmin && standardMoisture !== "") {
        payload.standard_moisture_percent = parseFloat(standardMoisture);
      }

      await client.put("/settings/", payload);
      setMessage({ type: "success", text: "Settings saved and updated successfully!" });
      fetchSettings(); // update global app store cache
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-emerald-800" />
          <span>Operational Pricing & Settings</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdmin
            ? "Global system configuration, standard moisture baseline, and baseline rates"
            : "Station operational purchase prices per kilogram"}
        </p>
      </div>

      {message.text && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold border flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-xs text-slate-400">Loading settings...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Produce Identity (SaaS Account) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-emerald-800" />
              <span>Produce Information</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Produce Name
              </label>
              <input
                type="text"
                required
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="e.g. Kenema Produce Enterprise"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Primary business name for your SaaS produce account (can oversee multiple buying stations).
              </p>
            </div>
          </div>

          {/* Commodity Base Prices Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-800" />
              <span>Operational Purchase Rates (Nle / kg)</span>
            </h3>
            <p className="text-xs text-slate-500">
              These rates automatically pre-populate scale forms for fast intake at the counter.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  🍫 Cocoa Rate (Nle per kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={cocoaPrice}
                  onChange={(e) => setCocoaPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ☕ Coffee Rate (Nle per kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={coffeePrice}
                  onChange={(e) => setCoffeePrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  🌰 Cola Nut Rate (Nle per kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={colaPrice}
                  onChange={(e) => setColaPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Standard Moisture Deduction Baseline */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-purple-700" />
                <span>Standard Moisture Baseline (%)</span>
              </h3>
              {!isAdmin && (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Admin Lock
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              National standard moisture allowance for export grade. Deductions are calculated as $(W\% - \text{Standard}\%)$.
            </p>

            <div>
              <input
                type="number"
                step="0.1"
                disabled={!isAdmin}
                value={standardMoisture}
                onChange={(e) => setStandardMoisture(e.target.value)}
                className={`w-full border rounded-xl p-2.5 text-sm font-bold focus:outline-none ${
                  isAdmin
                    ? "bg-slate-50 border-slate-300 focus:ring-2 focus:ring-purple-700"
                    : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                }`}
              />
              {!isAdmin && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Only System Administrators have the governance authority to alter the standard moisture percentage.
                </p>
              )}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3.5 px-4 rounded-2xl text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Changes..." : "Save Configuration"}</span>
          </button>
        </form>
      )}
    </div>
  );
}

