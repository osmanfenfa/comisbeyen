import { useState } from "react";
import client from "../../api/client.js";
import { X, Truck, Building2, UserCheck, CheckCircle, AlertCircle } from "lucide-react";

export default function SupplyModal({ isOpen, onClose, onSuccess }) {
  const [commodity, setCommodity] = useState("cocoa");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalKg, setTotalKg] = useState("");
  const [totalBags, setTotalBags] = useState("");
  const [waterPercent, setWaterPercent] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyContact, setCompanyContact] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen) return null;

  const isCocoa = commodity === "cocoa";
  const kg = parseFloat(totalKg) || 0;
  const price = parseFloat(pricePerKg) || 0;
  const estimatedValue = kg > 0 && price > 0 ? (kg * price).toFixed(2) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!totalKg || kg <= 0) {
      setError("Please enter a valid Total kg weight.");
      return;
    }
    const bags = parseInt(totalBags, 10);
    if (!bags || bags <= 0) {
      setError("Please enter a valid number of Total Bags.");
      return;
    }
    if (!companyName.trim()) {
      setError("Please enter the Company Name.");
      return;
    }
    if (!witnessName.trim()) {
      setError("Please enter the Witness Name.");
      return;
    }

    const water = isCocoa ? (parseFloat(waterPercent) || 0) : 0;

    const payload = {
      commodity,
      date,
      total_kg: kg,
      total_bags: bags,
      water_percent: water,
      company_name: companyName.trim(),
      company_address: companyAddress.trim() || null,
      company_contact: companyContact.trim() || null,
      witness_name: witnessName.trim(),
      price_per_kg: price > 0 ? price : null,
      total_value: estimatedValue ? parseFloat(estimatedValue) : null,
      notes: notes.trim() || null,
    };

    setLoading(true);
    try {
      await client.post("/supplies/", payload);
      setSuccess("Supply sale recorded successfully!");
      setTimeout(() => {
        if (onSuccess) onSuccess();
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to record produce supply.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setSuccess("");
    setTotalKg("");
    setTotalBags("");
    setWaterPercent("");
    setCompanyName("");
    setCompanyAddress("");
    setCompanyContact("");
    setWitnessName("");
    setPricePerKg("");
    setNotes("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border-2 border-[#168821] p-5 sm:p-6 my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-[#168821]">
              <Truck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                Record Produce Supply / Sale
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Log aggregated produce dispatch to buyer companies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#168821] font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#168821]" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Commodity & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Commodity
              </label>
              <select
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#168821] focus:outline-none"
              >
                <option value="cocoa">Cocoa</option>
                <option value="coffee">Coffee</option>
                <option value="cola">Cola Nut</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Dispatch Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#168821] focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Produce Specs: Total kg, Total Bags, Water % */}
          <div className={`grid ${isCocoa ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total kg *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                placeholder="e.g. 500.0"
                value={totalKg}
                onChange={(e) => setTotalKg(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#168821] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total Bags *
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 10"
                value={totalBags}
                onChange={(e) => setTotalBags(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#168821] focus:outline-none"
              />
            </div>

            {isCocoa && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Water %
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 7.5"
                  value={waterPercent}
                  onChange={(e) => setWaterPercent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#168821] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Company Details Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200/80 pb-1.5">
              <Building2 className="w-4 h-4 text-[#168821]" />
              <span>Buyer Company Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Export Produce Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#168821] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  Company Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +232 77 123456"
                  value={companyContact}
                  onChange={(e) => setCompanyContact(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-[#168821] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                Company Address / Location
              </label>
              <input
                type="text"
                placeholder="e.g. Cline Town, Freetown"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#168821] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                Witness Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Driver / Agent / Official Witness Name"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 pl-8 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#168821] focus:outline-none"
                />
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Optional Price and Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Price per kg (Nle)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Optional"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#168821] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Estimated Value
              </label>
              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm font-bold text-slate-800">
                {estimatedValue ? `Nle ${parseFloat(estimatedValue).toLocaleString()}` : "—"}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Notes / Waybill Ref
            </label>
            <input
              type="text"
              placeholder="e.g. Truck Reg #, Waybill #4092"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs sm:text-sm focus:ring-2 focus:ring-[#168821] focus:outline-none font-medium"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-black text-sm py-3 rounded-full shadow-sm active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              <span>{loading ? "Recording Supply..." : "Record & Confirm Supply"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

