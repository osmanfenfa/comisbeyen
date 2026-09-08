import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  Wallet, Plus, DollarSign, Calendar, Clock, 
  CheckCircle, AlertTriangle, ChevronRight, X, History,
  Printer, Download, User as UserIcon, Check, FileText
} from "lucide-react";

export default function Loan() {
  const { role, stationName, name: currentUserName } = useAuthStore();
  const { sellers, fetchSellers } = useAppStore();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formMsg, setFormMsg] = useState({ type: "", text: "" });

  // Loan Form State (matching Mockup Split Pills)
  const [newSellerId, setNewSellerId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTime, setNewTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [newNotes, setNewNotes] = useState("");
  const [submittingLoan, setSubmittingLoan] = useState(false);

  // Repayment Modal
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [repaymentModalLoan, setRepaymentModalLoan] = useState(null);
  const [selectedDebtorId, setSelectedDebtorId] = useState("");
  const [repayDate, setRepayDate] = useState(new Date().toISOString().split("T")[0]);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayNotes, setRepayNotes] = useState("");
  const [submittingRepay, setSubmittingRepay] = useState(false);
  const [repayError, setRepayError] = useState("");

  // History Modal
  const [historyLoanData, setHistoryLoanData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Official Debtor Statement / Receipt Modal
  const [statementModalDebtor, setStatementModalDebtor] = useState(null);

  useEffect(() => {
    fetchSellers();
    loadLoans();

    // Listen for "Enter Loan Payment" event from TopHeader
    const handleOpenPayment = () => {
      setSelectedDebtorId("");
      setRepaymentModalLoan(null);
      setRepayAmount("");
      setRepayNotes("");
      setRepayError("");
      setRepaymentModalOpen(true);
    };

    window.addEventListener("open-loan-payment", handleOpenPayment);
    return () => {
      window.removeEventListener("open-loan-payment", handleOpenPayment);
    };
  }, []);

  const loadLoans = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/loans/");
      setLoans(data);
    } catch (err) {
      console.error("Failed to load loans", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();
    if (!newSellerId) {
      setFormMsg({ type: "error", text: "Please select a registered seller." });
      return;
    }
    if (!newAmount || parseFloat(newAmount) <= 0) {
      setFormMsg({ type: "error", text: "Please enter a valid loan amount." });
      return;
    }

    setFormMsg({ type: "", text: "" });
    setSubmittingLoan(true);

    const fullNotes = [
      newTime ? `Time: ${newTime}` : null,
      newNotes ? newNotes.trim() : null,
    ].filter(Boolean).join(" | ");

    try {
      await client.post("/loans/", {
        seller_id: newSellerId,
        date: newDate,
        loan_taken: parseFloat(newAmount),
        due_date: newDueDate || null,
        notes: fullNotes || null,
      });

      setFormMsg({ type: "success", text: "Loan successfully issued and recorded in ledger!" });
      setNewSellerId("");
      setNewAmount("");
      setNewDueDate("");
      setNewNotes("");
      loadLoans();

      setTimeout(() => setFormMsg({ type: "", text: "" }), 4000);
    } catch (err) {
      setFormMsg({
        type: "error",
        text: err.response?.data?.detail || "Failed to create loan.",
      });
    } finally {
      setSubmittingLoan(false);
    }
  };

  const handleRecordRepayment = async (e) => {
    e.preventDefault();
    const targetLoan = repaymentModalLoan || loans.find((l) => l.id === selectedDebtorId);
    if (!targetLoan) {
      setRepayError("Please choose a debtor to apply repayment.");
      return;
    }

    setRepayError("");
    setSubmittingRepay(true);

    try {
      await client.post("/loans/repayments", {
        loan_id: targetLoan.id,
        date: repayDate,
        amount_paid: parseFloat(repayAmount),
        notes: repayNotes || null,
      });

      setRepaymentModalOpen(false);
      setRepaymentModalLoan(null);
      setRepayAmount("");
      setRepayNotes("");
      loadLoans();
    } catch (err) {
      setRepayError(err.response?.data?.detail || "Failed to record repayment.");
    } finally {
      setSubmittingRepay(false);
    }
  };

  const openHistory = async (loanId) => {
    setLoadingHistory(true);
    setHistoryLoanData(null);
    try {
      const { data } = await client.get(`/loans/${loanId}`);
      setHistoryLoanData(data);
    } catch (err) {
      alert("Failed to load repayment history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const activeDebtors = loans.filter((l) => l.balance > 0);
  const displayLoans = loans;

  return (
    <div className="p-3 sm:p-4 space-y-4 pb-28">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
            <span className="text-xl">💰</span>
            <span>Loan & Advance Credit</span>
          </h1>
          <p className="text-[11px] text-slate-500">
            Issue loans and track recovery from future produce
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedDebtorId("");
            setRepaymentModalLoan(null);
            setRepayAmount("");
            setRepayNotes("");
            setRepayError("");
            setRepaymentModalOpen(true);
          }}
          className="bg-[#168821] hover:bg-[#126e1a] text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-xs active:scale-95 transition"
        >
          Enter Loan Payment
        </button>
      </div>

      {formMsg.text && (
        <div
          className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
            formMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-red-50 text-red-800 border-red-300"
          }`}
        >
          {formMsg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
          <span>{formMsg.text}</span>
        </div>
      )}

      {/* Main Grid: Single column on mobile, 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            CARD 1: LOAN FORM (EXACT MATCH TO MOCKUP media_1788701866468.png)
            ========================================================================= */}
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs lg:col-span-5">
          {/* Yellow Header Banner */}
          <div className="bg-[#d4a000] py-2 px-4 text-center">
          <h2 className="text-[#0f5c18] font-black text-sm sm:text-base tracking-wide uppercase">
            Loan Form
          </h2>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateLoan} className="p-3.5 space-y-2.5">
          {/* 1. Seller Select Stadium Pill */}
          <div className="border border-slate-700 rounded-full px-3.5 py-1.5 bg-white flex items-center justify-between shadow-2xs">
            <span className="text-xs font-bold text-slate-700 shrink-0 mr-2">
              Select Seller:
            </span>
            <select
              required
              value={newSellerId}
              onChange={(e) => setNewSellerId(e.target.value)}
              className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="">-- Choose registered seller --</option>
              {sellers.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.seller_id})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Date Loan Taken (Split Pill) */}
          <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-10">
            <div className="w-[48%] h-full bg-[#168821] text-white font-bold text-xs sm:text-sm flex items-center justify-center border-r border-slate-700 px-2 text-center select-none">
              Date Loan Taken
            </div>
            <div className="w-[52%] h-full flex items-center px-3">
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-800 bg-transparent focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* 3. Amount Taken (Nle) (Split Pill) */}
          <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-10">
            <div className="w-[48%] h-full bg-[#168821] text-white font-bold text-xs sm:text-sm flex items-center justify-center border-r border-slate-700 px-2 text-center select-none">
              Amount Taken (Nle)
            </div>
            <div className="w-[52%] h-full flex items-center px-3">
              <input
                type="number"
                step="1"
                min="1"
                required
                placeholder="e.g. 5000"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* 4. Due Date (Split Pill) */}
          <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-10">
            <div className="w-[48%] h-full bg-[#168821] text-white font-bold text-xs sm:text-sm flex items-center justify-center border-r border-slate-700 px-2 text-center select-none">
              Due Date
            </div>
            <div className="w-[52%] h-full flex items-center px-3">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-800 bg-transparent focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* 5. Time Loan Taken (Split Pill) */}
          <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-10">
            <div className="w-[48%] h-full bg-[#168821] text-white font-bold text-xs sm:text-sm flex items-center justify-center border-r border-slate-700 px-2 text-center select-none">
              Time Loan Taken
            </div>
            <div className="w-[52%] h-full flex items-center px-3">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-800 bg-transparent focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* 6. Note (Split Pill) */}
          <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-10">
            <div className="w-[48%] h-full bg-[#168821] text-white font-bold text-xs sm:text-sm flex items-center justify-center border-r border-slate-700 px-2 text-center select-none">
              Note
            </div>
            <div className="w-[52%] h-full flex items-center px-3">
              <input
                type="text"
                placeholder="Terms / remarks"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submittingLoan}
            className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-black text-sm sm:text-base py-2.5 rounded-full shadow-sm active:scale-98 transition flex items-center justify-center cursor-pointer disabled:opacity-50 mt-2"
          >
            {submittingLoan ? "Recording..." : "Submit"}
          </button>
        </form>
      </div>

        {/* =========================================================================
            CARD 2: LIST OF DEBTORS (EXACT MATCH TO MOCKUP media_1788701866468.png)
            ========================================================================= */}
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs lg:col-span-7">
          {/* Yellow Header Banner */}
          <div className="bg-[#d4a000] py-2 px-4 text-center">
          <h2 className="text-[#0f5c18] font-black text-sm sm:text-base tracking-wide uppercase">
            List of Debtors
          </h2>
        </div>

        {/* Debtors List Body */}
        <div className="p-3 divide-y divide-slate-100">
          {loading ? (
            <p className="text-center py-6 text-xs text-slate-400">Loading debtors ledger...</p>
          ) : displayLoans.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400">No loan records found.</p>
          ) : (
            displayLoans.map((loan) => {
              const seller = sellers.find((s) => s.id === loan.seller_id);
              const isCleared = loan.status === "cleared" || loan.balance <= 0;

              return (
                <div key={loan.id} className="py-3 first:pt-1 last:pb-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar icon */}
                      <div className="w-9 h-9 rounded-full bg-emerald-50 border border-[#168821] flex items-center justify-center shrink-0">
                        <UserIcon className="w-5 h-5 text-[#168821]" />
                      </div>

                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                          {seller?.name || "Seller"} <span className="text-[10px] text-slate-500">({seller?.seller_id || "SELLER"})</span>
                        </p>
                        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                          {seller?.address || "Station Area"}{seller?.contact ? ` · ${seller.contact}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                        isCleared
                          ? "bg-emerald-100 text-emerald-800"
                          : loan.status === "overdue"
                          ? "bg-red-100 text-red-800 animate-pulse"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isCleared ? "Cleared" : loan.status}
                    </span>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Loan Taken</span>
                      <span className="font-bold text-slate-700">Nle {loan.loan_taken.toLocaleString()}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Paid Back</span>
                      <span className="font-bold text-emerald-700">
                        Nle {(loan.loan_taken - loan.balance).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Balance Due</span>
                      <span className="font-black text-amber-900">
                        Nle {loan.balance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Receipt Download */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setStatementModalDebtor({ loan, seller })}
                      className="text-[11px] font-bold text-[#168821] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download Full Receipt</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openHistory(loan.id)}
                        className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition cursor-pointer"
                      >
                        History
                      </button>

                      {!isCleared && (
                        <button
                          type="button"
                          onClick={() => {
                            setRepaymentModalLoan(loan);
                            setSelectedDebtorId(loan.id);
                            setRepayAmount("");
                            setRepayNotes("");
                            setRepayError("");
                            setRepaymentModalOpen(true);
                          }}
                          className="text-[11px] font-bold text-white bg-[#168821] hover:bg-[#126e1a] px-3 py-1 rounded-full shadow-2xs active:scale-95 transition cursor-pointer"
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      </div>

      {/* =========================================================================
          REPAYMENT MODAL (Triggered by Enter Loan Payment or Pay button)
          ========================================================================= */}
      {repaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border-2 border-[#168821]">
            <div className="bg-[#d4a000] py-2 px-4 flex items-center justify-between">
              <h3 className="text-[#0f5c18] font-black text-sm uppercase">Record Loan Repayment</h3>
              <button
                type="button"
                onClick={() => setRepaymentModalOpen(false)}
                className="text-[#0f5c18] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              {repayError && (
                <div className="p-2 bg-red-50 text-red-700 rounded-xl text-[11px] font-semibold border border-red-200">
                  {repayError}
                </div>
              )}

              {/* Debtor Selector (if not pre-selected) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Debtor</label>
                <select
                  value={repaymentModalLoan?.id || selectedDebtorId}
                  onChange={(e) => {
                    const sel = loans.find((l) => l.id === e.target.value);
                    setRepaymentModalLoan(sel);
                    setSelectedDebtorId(e.target.value);
                  }}
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs bg-slate-50 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                >
                  <option value="">-- Choose active debtor --</option>
                  {activeDebtors.map((l) => {
                    const s = sellers.find((sel) => sel.id === l.seller_id);
                    return (
                      <option key={l.id} value={l.id}>
                        {s?.name || "Seller"} ({s?.seller_id}) — Bal: Nle {l.balance.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Selected Debtor Snapshot */}
              {(repaymentModalLoan || selectedDebtorId) && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loan Principal:</span>
                    <span className="font-bold text-slate-800">
                      Nle {(repaymentModalLoan?.loan_taken || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remaining Balance:</span>
                    <span className="font-bold text-amber-900">
                      Nle {(repaymentModalLoan?.balance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <form onSubmit={handleRecordRepayment} className="space-y-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Repayment Date</label>
                  <input
                    type="date"
                    required
                    value={repayDate}
                    onChange={(e) => setRepayDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Amount Repaid (Nle)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max={repaymentModalLoan?.balance}
                    required
                    placeholder="e.g. 1000"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="Cash at station counter"
                    value={repayNotes}
                    onChange={(e) => setRepayNotes(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRepaymentModalOpen(false)}
                    className="flex-1 border border-slate-300 py-2 rounded-xl text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRepay}
                    className="flex-1 bg-[#168821] hover:bg-[#126e1a] text-white py-2 rounded-xl font-bold shadow-xs disabled:opacity-50"
                  >
                    {submittingRepay ? "Saving..." : "Confirm Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          OFFICIAL DEBTOR LOAN STATEMENT / RECEIPT MODAL
          ========================================================================= */}
      {statementModalDebtor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border-2 border-[#168821]">
            <div className="bg-[#d4a000] py-2 px-4 flex items-center justify-between">
              <h3 className="text-[#0f5c18] font-black text-sm uppercase">Official Loan Statement</h3>
              <button
                type="button"
                onClick={() => setStatementModalDebtor(null)}
                className="text-[#0f5c18] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="text-center border-b pb-2">
                <p className="font-black text-sm text-slate-900">
                  {stationName || "COMIS Buying Station Network"}
                </p>
                <p className="text-[11px] text-slate-500">Debtor Statement & Receipt</p>
                <p className="font-mono text-[10px] text-emerald-800 mt-0.5">
                  REF: LOAN-{statementModalDebtor.loan.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Debtor Name:</span>
                  <span className="font-bold text-slate-900">{statementModalDebtor.seller?.name || "Seller"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Seller ID:</span>
                  <span className="font-mono font-bold text-slate-700">{statementModalDebtor.seller?.seller_id || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Disbursed Date:</span>
                  <span className="text-slate-700">{statementModalDebtor.loan.date}</span>
                </div>
                {statementModalDebtor.loan.due_date && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Due Date:</span>
                    <span className="text-slate-700">{statementModalDebtor.loan.due_date}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 border-t border-b py-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Original Principal:</span>
                  <span className="font-bold text-slate-900">Nle {statementModalDebtor.loan.loan_taken.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Repaid to Date:</span>
                  <span className="font-bold text-emerald-700">
                    Nle {(statementModalDebtor.loan.loan_taken - statementModalDebtor.loan.balance).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200">
                  <span>OUTSTANDING BALANCE:</span>
                  <span className="text-amber-900">Nle {statementModalDebtor.loan.balance.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementModalDebtor(null)}
                  className="flex-1 bg-[#168821] hover:bg-[#126e1a] text-white py-2 rounded-xl font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          REPAYMENT HISTORY MODAL
          ========================================================================= */}
      {historyLoanData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border-2 border-[#168821] max-h-[85vh] flex flex-col">
            <div className="bg-[#d4a000] py-2 px-4 flex items-center justify-between">
              <h3 className="text-[#0f5c18] font-black text-sm uppercase">Repayment Ledger</h3>
              <button
                type="button"
                onClick={() => setHistoryLoanData(null)}
                className="text-[#0f5c18] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Principal:</span>
                  <span className="font-bold text-slate-800">Nle {historyLoanData.loan_taken.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Balance:</span>
                  <span className="font-black text-amber-900">Nle {historyLoanData.balance.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  Installment Receipts ({historyLoanData.repayments?.length || 0})
                </h4>

                {(!historyLoanData.repayments || historyLoanData.repayments.length === 0) ? (
                  <p className="text-slate-400 py-3 text-center">No repayments recorded yet.</p>
                ) : (
                  historyLoanData.repayments.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-xl border border-slate-200 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-emerald-800">Nle {r.amount_paid.toLocaleString()}</span>
                        <p className="text-[10px] text-slate-400">{r.date} {r.notes && `· ${r.notes}`}</p>
                      </div>
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t">
              <button
                type="button"
                onClick={() => setHistoryLoanData(null)}
                className="w-full bg-[#168821] text-white py-2 rounded-xl font-bold cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
