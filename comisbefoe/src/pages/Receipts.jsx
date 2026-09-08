import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  Receipt as ReceiptIcon, Printer, Search, Filter, 
  Check, X, FileText 
} from "lucide-react";
import OfficialReceiptModal from "../components/shared/OfficialReceiptModal.jsx";

export default function Receipts() {
  const { role } = useAuthStore();
  const { sellers, fetchSellers } = useAppStore();

  const [activeTab, setActiveTab] = useState("issued"); // 'issued' | 'pending'
  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  // Filters for issued receipts
  const [typeFilter, setTypeFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pending reviews
  const [pendingTxns, setPendingTxns] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [rejectModalTxn, setRejectModalTxn] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [receiptPrepTxn, setReceiptPrepTxn] = useState(null);
  const [loanDeductionInput, setLoanDeductionInput] = useState(0);

  useEffect(() => {
    fetchSellers();
    loadReceipts();
    loadPending();
  }, []);

  const loadReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const { data } = await client.get("/receipts/");
      setReceipts(data);
    } catch (err) {
      console.error("Failed to load receipts", err);
    } finally {
      setLoadingReceipts(false);
    }
  };

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const [cPending, cApproved, cofPending, cofApproved, colPending, colApproved] = await Promise.all([
        client.get("/cocoa/?status=pending"),
        client.get("/cocoa/?status=approved"),
        client.get("/coffee/?status=pending"),
        client.get("/coffee/?status=approved"),
        client.get("/cola/?status=pending"),
        client.get("/cola/?status=approved"),
      ]);
      const cocoa = [...(cPending.data || []), ...(cApproved.data || [])].map((t) => ({ ...t, commodity: "cocoa" }));
      const coffee = [...(cofPending.data || []), ...(cofApproved.data || [])].map((t) => ({ ...t, commodity: "coffee" }));
      const cola = [...(colPending.data || []), ...(colApproved.data || [])].map((t) => ({ ...t, commodity: "cola" }));
      const combined = [...cocoa, ...coffee, ...cola].sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0).getTime();
        const dateB = new Date(b.date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      setPendingTxns(combined);
    } catch (err) {
      console.error("Failed to load review queue", err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApprove = async (txn) => {
    try {
      await client.post(`/${txn.commodity}/${txn.id}/approve`);
      loadPending();
    } catch (err) {
      alert(err.response?.data?.detail || "Approval failed");
    }
  };

  const handleApproveAndIssue = async (txn) => {
    try {
      if (txn.status === "pending") {
        await client.post(`/${txn.commodity}/${txn.id}/approve`);
      }
      await openReceiptPrep({ ...txn, status: "approved" });
    } catch (err) {
      alert(err.response?.data?.detail || "Approval failed");
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalTxn) return;
    try {
      await client.post(`/${rejectModalTxn.commodity}/${rejectModalTxn.id}/reject`, {
        reason: rejectReason || "Correction required",
      });
      setRejectModalTxn(null);
      setRejectReason("");
      loadPending();
    } catch (err) {
      alert(err.response?.data?.detail || "Rejection failed");
    }
  };

  const openReceiptPrep = async (txn) => {
    setReceiptPrepTxn(txn);
    setLoanDeductionInput(0);
    if (!txn.seller_id) {
      setReceiptPrepTxn({ ...txn, sellerDebt: 0 });
      return;
    }
    try {
      const { data } = await client.get(`/sellers/${txn.seller_id}/balance`);
      setReceiptPrepTxn({ ...txn, sellerDebt: data.outstanding_balance });
    } catch {
      setReceiptPrepTxn({ ...txn, sellerDebt: 0 });
    }
  };

  const handleConfirmIssueReceipt = async () => {
    if (!receiptPrepTxn) return;
    try {
      const deduction = parseFloat(loanDeductionInput) || 0;
      const { data } = await client.post(
        `/${receiptPrepTxn.commodity}/${receiptPrepTxn.id}/issue-receipt?loan_deduction=${deduction}`
      );
      setReceiptPrepTxn(null);
      setSelectedReceipt(data);
      loadPending();
      loadReceipts();
    } catch (err) {
      alert(err.response?.data?.detail || "Receipt issuance failed");
    }
  };

  const filteredReceipts = receipts.filter((r) => {
    if (typeFilter !== "all" && r.transaction_type !== typeFilter) return false;
    if (sellerFilter && r.seller_id !== sellerFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numMatch = r.receipt_number?.toLowerCase().includes(q);
      const sellerMatch = r.seller_name?.toLowerCase().includes(q) || r.seller_code?.toLowerCase().includes(q) || r.seller_contact?.toLowerCase().includes(q);
      if (!numMatch && !sellerMatch) return false;
    }
    return true;
  });

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-emerald-800" />
            <span>Receipts & Verification</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Official station purchase certificates & co-located review queue
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("issued")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === "issued" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Issued Receipts ({receipts.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "pending" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Pending & Approved</span>
          {pendingTxns.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {pendingTxns.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ISSUED RECEIPTS */}
      {activeTab === "issued" && (
        <div className="space-y-3">
          {/* Search & Commodity Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by receipt # or seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex gap-1 overflow-x-auto text-xs flex-1 no-scrollbar">
                {["all", "cocoa", "coffee", "cola"].map((typ) => (
                  <button
                    key={typ}
                    onClick={() => setTypeFilter(typ)}
                    className={`px-3 py-1.5 rounded-xl font-semibold capitalize whitespace-nowrap transition ${
                      typeFilter === typ
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {typ === "all" ? "All Commodities" : typ}
                  </button>
                ))}
              </div>

              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Sellers</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.seller_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Receipts list */}
          {loadingReceipts ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading receipts...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              No receipts found matching your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredReceipts.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReceipt(r)}
                  className="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition space-y-2 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {r.receipt_number}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <p className="text-sm font-bold text-slate-900">
                          {r.seller_name || "Seller"}
                        </p>
                        {r.is_random_seller ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            Walk-in
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-500">({r.seller_code})</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(r.issued_at).toLocaleString()} · {r.station_name || "Station"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 block">
                        Nle {r.net_amount_paid?.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        {r.transaction_type}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl flex justify-between text-xs text-slate-600">
                    <span>Gross: Nle {r.gross_amount}</span>
                    <span className="text-red-600">Loan Ded: -Nle {r.loan_deduction}</span>
                    <span className="font-bold text-emerald-800">Net: Nle {r.net_amount_paid}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING APPROVAL QUEUE */}
      {activeTab === "pending" && (
        <div className="space-y-3">
          {loadingPending ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading pending reviews...</div>
          ) : pendingTxns.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              No transactions currently waiting for manager review.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {pendingTxns.map((txn) => {
                const sellerObj = sellers.find((s) => s.id === txn.seller_id);
                const isApproved = txn.status === "approved";
                return (
                  <div
                    key={txn.id}
                    className={`rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between transition ${
                      isApproved
                        ? "bg-emerald-50/25 border-2 border-emerald-400"
                        : "bg-white border border-amber-200"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase bg-slate-900 text-white px-2 py-0.5 rounded-md">
                              {txn.commodity}
                            </span>
                            {isApproved ? (
                              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md">
                                ✓ Ready to Print
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                                Pending Review
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-900">
                              {txn.seller_name || sellerObj?.name || "Seller"}
                            </span>
                            {txn.is_random_seller || sellerObj?.is_random ? (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                Walk-in
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-slate-400">
                                ({txn.seller_code || sellerObj?.seller_id})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            {txn.date} · Weight: <span className="font-bold text-slate-800">{txn.weight_kg} kg</span> @ Nle {txn.price_per_kg}/kg
                          </p>
                          {txn.water_percent != null && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Moisture: {txn.water_percent}% · Net Wt: {txn.net_weight_kg || txn.weight_kg} kg
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900 block">
                            Nle {txn.total_price}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isApproved ? "Approved Total" : "Gross Payable"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      {isApproved ? (
                        <button
                          onClick={() => openReceiptPrep(txn)}
                          className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Issue & Print Official Receipt</span>
                        </button>
                      ) : (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { setRejectModalTxn(txn); setRejectReason(""); }}
                            className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-2.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>

                          <button
                            onClick={() => handleApprove(txn)}
                            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => handleApproveAndIssue(txn)}
                            className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-xs transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Approve & Issue</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ISSUE RECEIPT PREP MODAL
          ========================================================================= */}
      {receiptPrepTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Issue Receipt & Settle</h3>
            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Amount:</span>
                <span className="text-slate-500">Gross Payable:</span>
                <span className="font-bold text-slate-900">Nle {receiptPrepTxn.total_price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Seller Outstanding Debt:</span>
                <span className="font-bold text-amber-700">Nle {receiptPrepTxn.sellerDebt || 0}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Loan Deduction Amount (Nle)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max={Math.min(receiptPrepTxn.total_price, receiptPrepTxn.sellerDebt || receiptPrepTxn.total_price)}
                value={loanDeductionInput}
                onChange={(e) => setLoanDeductionInput(e.target.value)}
                placeholder="0"
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Net cash to hand seller: Nle {Math.max(0, receiptPrepTxn.total_price - (parseFloat(loanDeductionInput) || 0)).toFixed(2)}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setReceiptPrepTxn(null)}
                className="flex-1 border border-slate-300 py-2.5 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIssueReceipt}
                className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white py-2.5 rounded-xl text-xs font-semibold shadow-sm"
                className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs"
              >
                Issue Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          REJECT MODAL
          ========================================================================= */}
      {rejectModalTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Reject Purchase</h3>
            <p className="text-xs text-slate-500">Provide a reason for the Secretary to correct:</p>
            <textarea
              rows={3}
              required
              placeholder="e.g. Moisture re-test required; weight adjustment needed"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setRejectModalTxn(null)}
                className="flex-1 border border-slate-300 py-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-semibold"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Teller Landscape Official Receipt Modal */}
      <OfficialReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
