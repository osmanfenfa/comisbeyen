import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  ClipboardList, AlertTriangle, Edit3, CheckCircle, 
  Clock, XCircle, FileCheck, RefreshCw 
} from "lucide-react";

export default function Transactions() {
  const { userId } = useAuthStore();
  const { sellers, fetchSellers } = useAppStore();

  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [commodityFilter, setCommodityFilter] = useState("all");

  // Edit & Resubmit Modal state
  const [editingTxn, setEditingTxn] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [editWater, setEditWater] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editOverride, setEditOverride] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [modalError, setModalError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  useEffect(() => {
    fetchSellers();
    loadMyTransactions();
  }, []);

  const loadMyTransactions = async () => {
    setLoading(true);
    try {
      const [cocoaRes, coffeeRes, colaRes] = await Promise.all([
        client.get("/cocoa/"),
        client.get("/coffee/"),
        client.get("/cola/"),
      ]);

      const taggedCocoa = (cocoaRes.data || []).map((t) => ({ ...t, commodity: "cocoa" }));
      const taggedCoffee = (coffeeRes.data || []).map((t) => ({ ...t, commodity: "coffee" }));
      const taggedCola = (colaRes.data || []).map((t) => ({ ...t, commodity: "cola" }));

      const all = [...taggedCocoa, ...taggedCoffee, ...taggedCola];
      const own = all.filter((t) => !userId || t.created_by === userId);
      own.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

      setTxns(own);
    } catch (err) {
      console.error("Failed to load transactions", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTxns = txns.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (commodityFilter !== "all" && t.commodity !== commodityFilter) return false;
    return true;
  });

  const openEditModal = (t) => {
    setEditingTxn(t);
    setEditWeight(t.weight_kg?.toString() || "");
    setEditWater(t.water_percent?.toString() || "");
    setEditPrice(t.price_per_kg?.toString() || "");
    setEditOverride(t.manual_total_override?.toString() || "");
    setModalError("");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTxn) return;
    setSavingEdit(true);
    setModalError("");

    try {
      const payload = {
        weight_kg: parseFloat(editWeight),
        price_per_kg: parseFloat(editPrice),
      };
      if (editingTxn.commodity !== "cola") {
        payload.water_percent = parseFloat(editWater);
      } else if (editOverride !== "") {
        payload.manual_total_override = parseFloat(editOverride);
      }

      await client.put(`/${editingTxn.commodity}/${editingTxn.id}`, payload);
      setSuccessToast(`Transaction updated & resubmitted as PENDING!`);
      setTimeout(() => setSuccessToast(""), 4000);
      setEditingTxn(null);
      loadMyTransactions();
    } catch (err) {
      setModalError(err.response?.data?.detail || "Failed to update transaction.");
    } finally {
      setSavingEdit(false);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-300">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full border border-red-300">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case "finalized":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
            <FileCheck className="w-3 h-3" /> Finalized
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  const commodityIcon = (commodity) => {
    if (commodity === "cocoa") return "🍫 Cocoa";
    if (commodity === "coffee") return "☕ Coffee";
    return "🌰 Cola Nut";
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-800" />
            <span>My Submitted Transactions</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track status, view rejection feedback, and resubmit corrected records
          </p>
        </div>
        <button
          onClick={loadMyTransactions}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="space-y-2">
        {/* Status Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {["all", "pending", "rejected", "approved", "finalized"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl font-semibold capitalize whitespace-nowrap transition ${
                statusFilter === st
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st} {st !== "all" && `(${txns.filter((t) => t.status === st).length})`}
            </button>
          ))}
        </div>

        {/* Commodity selector */}
        <div className="flex gap-2 text-xs">
          {["all", "cocoa", "coffee", "cola"].map((cmd) => (
            <button
              key={cmd}
              onClick={() => setCommodityFilter(cmd)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                commodityFilter === cmd
                  ? "bg-emerald-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cmd === "all" ? "All Commodities" : cmd.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-10 text-xs text-slate-400">Loading your transactions...</div>
      ) : filteredTxns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-1">
          <p>No transactions found matching the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTxns.map((t) => {
            const seller = sellers.find((s) => s.id === t.seller_id);
            const isRejected = t.status === "rejected";
            const canEdit = t.status === "pending" || t.status === "rejected";

            return (
              <div
                key={t.id}
                className={`bg-white border rounded-2xl p-4 shadow-sm transition space-y-3 ${
                  isRejected ? "border-red-300 ring-1 ring-red-200 bg-red-50/20" : "border-slate-200"
                }`}
              >
                {/* Top row */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {commodityIcon(t.commodity)}
                      </span>
                      {statusBadge(t.status)}
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1.5">
                      {seller?.name || "Seller"} <span className="font-mono text-xs text-slate-500">({seller?.seller_id})</span>
                    </p>
                    <p className="text-[11px] text-slate-400">{t.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-900">
                      Nle {t.total_price?.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {t.commodity === "cola"
                        ? `${t.weight_kg} kg @ Nle ${t.price_per_kg}`
                        : `${t.net_weight_kg || t.weight_kg} kg net`}
                    </p>
                  </div>
                </div>

                {/* Breakdown details */}
                <div className="bg-slate-50 p-2.5 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Gross Wt</span>
                    <span className="font-bold text-slate-700">{t.weight_kg} kg</span>
                  </div>
                  {t.commodity !== "cola" ? (
                    <div>
                      <span className="text-[10px] text-slate-400 block">Water %</span>
                      <span className="font-bold text-slate-700">{t.water_percent}%</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-slate-400 block">Type</span>
                      <span className="font-bold text-slate-700">Direct</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-slate-400 block">Rate/kg</span>
                    <span className="font-bold text-slate-700">Nle {t.price_per_kg}</span>
                  </div>
                </div>

                {/* Prominent Rejection Alert */}
                {isRejected && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-red-800">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Manager Rejection Reason:</span>
                    </div>
                    <p className="text-red-700 pl-5 italic">
                      "{t.rejection_reason || "Correction requested by manager"}"
                    </p>
                  </div>
                )}

                {/* Edit & Resubmit Action */}
                {canEdit && (
                  <button
                    onClick={() => openEditModal(t)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>{isRejected ? "Correct Values & Resubmit" : "Edit Submission"}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          EDIT & RESUBMIT MODAL
          ========================================================================= */}
      {editingTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Edit & Resubmit {editingTxn.commodity.toUpperCase()} Purchase
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Saving will flip this transaction back to PENDING for manager review.
              </p>
            </div>

            {modalError && (
              <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Scale Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              {editingTxn.commodity !== "cola" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Water / Moisture %</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editWater}
                    onChange={(e) => setEditWater(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Price per kg (Nle)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              {editingTxn.commodity === "cola" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Manual Total Override (Nle) <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editOverride}
                    onChange={(e) => setEditOverride(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTxn(null)}
                  className="flex-1 border border-slate-300 py-2.5 rounded-xl font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50"
                >
                  {savingEdit ? "Resubmitting..." : "Resubmit for Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
