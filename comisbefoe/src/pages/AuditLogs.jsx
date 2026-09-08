import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { 
  ShieldCheck, Filter, Clock, ChevronDown, ChevronUp, 
  Search, RefreshCw, User, Activity
} from "lucide-react";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;

      const { data } = await client.get("/audit-logs/", { params });
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const actionColor = (act) => {
    if (act.includes("approve")) return "bg-blue-100 text-blue-800 border-blue-200";
    if (act.includes("reject")) return "bg-red-100 text-red-800 border-red-200";
    if (act.includes("receipt")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (act.includes("suspend")) return "bg-rose-100 text-rose-800 border-rose-200";
    if (act.includes("loan") || act.includes("repay")) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-700" />
            <span>Immutable Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographic ledger of all approvals, price overrides, and user changes
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-slate-500 mb-1">Filter Action</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); }}
            className="w-full bg-white border border-slate-300 rounded-xl p-2 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="create">Create Purchase</option>
            <option value="approve">Approve Purchase</option>
            <option value="reject">Reject Purchase</option>
            <option value="issue_receipt">Issue Receipt</option>
            <option value="create_loan">Create Loan</option>
            <option value="record_repayment">Record Repayment</option>
            <option value="suspend_user">Suspend User</option>
            <option value="update_settings">Update Settings</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-500 mb-1">Entity Type</label>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); }}
            className="w-full bg-white border border-slate-300 rounded-xl p-2 focus:outline-none"
          >
            <option value="">All Entities</option>
            <option value="CocoaTransaction">Cocoa</option>
            <option value="CoffeeTransaction">Coffee</option>
            <option value="ColaTransaction">Cola Nut</option>
            <option value="Loan">Loan</option>
            <option value="User">User</option>
            <option value="AppSettings">Settings</option>
          </select>
        </div>
      </div>

      <button
        onClick={loadLogs}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
      >
        Apply Filter
      </button>

      {/* Log list */}
      {loading ? (
        <div className="text-center py-10 text-xs text-slate-400">Loading audit history...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
          No audit log entries found matching criteria.
        </div>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => {
            const isExpanded = expandedLogId === log.id;

            return (
              <div
                key={log.id}
                className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs text-xs space-y-2"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="flex justify-between items-start cursor-pointer select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-800">{log.entity_type}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString()} · Role: {log.user_role}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    <span className="text-[10px]">{isExpanded ? "Hide" : "Details"}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Expanded state snapshot diff */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-mono text-slate-400">
                      Target Entity ID: {log.entity_id}
                    </p>

                    {log.old_value && (
                      <div className="bg-red-50/70 border border-red-200 rounded-xl p-2.5 text-[11px]">
                        <span className="font-bold text-red-800 block mb-1">Previous State:</span>
                        <pre className="font-mono text-[10px] text-red-900 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.old_value, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.new_value && (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-[11px]">
                        <span className="font-bold text-emerald-800 block mb-1">New State / Payload:</span>
                        <pre className="font-mono text-[10px] text-emerald-900 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

