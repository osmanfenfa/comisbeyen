import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  AlertTriangle, CheckCircle2, Clock, 
  User as UserIcon, Check, RefreshCw
} from "lucide-react";

export default function Home() {
  const { role, name, stationName, produceName } = useAuthStore();
  const { prices, fetchSettings } = useAppStore();
  const [data, setData] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await client.get("/dashboard/summary");
      setData(resp.data);

      // If Admin, fetch users and audit logs to render the mockup cards
      if (role === "system_admin") {
        try {
          const [usersRes, logsRes] = await Promise.all([
            client.get("/users/"),
            client.get("/audit-logs/"),
          ]);
          setAdminUsers(usersRes.data || []);
          setAuditLogs(logsRes.data || []);
        } catch {
          // Keep graceful fallback if empty
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    fetchSettings();
  }, []);

  // Quick action handlers for System Admin
  const handleApproveUser = async (userId) => {
    setApprovingId(userId);
    try {
      await client.post(`/users/${userId}/approve`);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve user");
    } finally {
      setApprovingId(null);
    }
  };

  const handleSuspendUser = async (userId) => {
    if (!confirm("Are you sure you want to suspend this user?")) return;
    setApprovingId(userId);
    try {
      await client.post(`/users/${userId}/suspend`);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to suspend user");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReactivateUser = async (userId) => {
    setApprovingId(userId);
    try {
      await client.post(`/users/${userId}/reactivate`);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reactivate user");
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to permanently delete user "${userName}"? All associations will be cleaned up. This cannot be undone.`)) return;
    setApprovingId(userId);
    try {
      await client.delete(`/users/${userId}`);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    } finally {
      setApprovingId(null);
    }
  };

  // Dedicated CSV Generator for each Commodity (Cocoa, Coffee, Cola)
  const handleDownloadCSV = async (commodity) => {
    try {
      const endpoint = commodity === "cocoa" ? "/cocoa/" : commodity === "coffee" ? "/coffee/" : "/cola/";
      const { data: txns } = await client.get(endpoint);
      const todayStr = new Date().toISOString().split("T")[0];
      const filename = `${commodity}_sales_${todayStr}.csv`;
      
      const rows = [];
      if (commodity === "cola") {
        rows.push(["Date", "Seller Code", "Seller Name", "Contact", "Weight (Kg)", "Price/Kg (Nle)", "Total Amount (Nle)", "Station", "Status"]);
        (txns || []).forEach((t) => {
          rows.push([
            t.date,
            t.seller_code || "N/A",
            `"${(t.seller_name || t.random_seller_name || "Walk-in").replace(/"/g, '""')}"`,
            t.seller_contact || "N/A",
            t.weight_kg,
            t.price_per_kg,
            t.total_price,
            `"${(t.station_name || stationName || "").replace(/"/g, '""')}"`,
            t.status
          ]);
        });
      } else {
        rows.push(["Date", "Seller Code", "Seller Name", "Contact", "Gross Weight (Kg)", "Water %", "Std %", "Net Weight (Kg)", "Price/Kg (Nle)", "Total Amount (Nle)", "Station", "Status"]);
        (txns || []).forEach((t) => {
          rows.push([
            t.date,
            t.seller_code || "N/A",
            `"${(t.seller_name || t.random_seller_name || "Walk-in").replace(/"/g, '""')}"`,
            t.seller_contact || "N/A",
            t.weight_kg,
            t.water_percent,
            t.standard_percent,
            t.net_weight_kg,
            t.price_per_kg,
            t.total_price,
            `"${(t.station_name || stationName || "").replace(/"/g, '""')}"`,
            t.status
          ]);
        });
      }

      if (!txns || txns.length === 0) {
        const stat = data?.[commodity] || {};
        rows.push([
          todayStr,
          "SUMMARY",
          commodity.toUpperCase(),
          "N/A",
          stat.total_weight_kg || 0,
          stat.highest_water_percent ? `${stat.highest_water_percent}%` : "0%",
          "7.0%",
          stat.total_weight_kg || 0,
          "0",
          stat.total_value || 0,
          produceName || stationName || "COMIS",
          "Summary"
        ]);
      }

      const csvContent = "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(`Failed to download ${commodity} CSV`, err);
      alert(`Could not download ${commodity} CSV`);
    }
  };

  return (
    <div className="p-3.5 space-y-4 pb-24">
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* =========================================================================
          1. SYSTEM ADMIN DASHBOARD
          ========================================================================= */}
      {role === "system_admin" && (
        <div className="space-y-4">
          {/* Main Gold Banner: OVERVIEW */}
          <div className="w-full bg-[#d4a000] text-[#0f5c18] font-black text-center py-2.5 rounded-2xl tracking-wider text-base uppercase shadow-xs">
            OVERVIEW
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Card 1: USERS */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2 uppercase tracking-wide">
                USERS
              </div>
              
              <div className="p-3.5 divide-y divide-slate-100 space-y-3">
                {adminUsers.length > 0 ? (
                  adminUsers.map((u) => (
                    <div key={u.id} className="pt-3 first:pt-0 flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3">
                        <div className="p-1 rounded-full text-slate-700 shrink-0 mt-0.5">
                          <UserIcon className="w-7 h-7 stroke-[1.8]" />
                        </div>
                        <div>
                          <h3 className="text-[#168821] font-bold text-xs sm:text-sm leading-tight">
                            {u.business_name || u.name || "Confidence Produce Farmers Corporation"}
                          </h3>
                          <p className="text-[#168821] text-xs mt-0.5 font-medium">
                            Address: {u.address || "Kainkordu Road, Koidu"}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons for SaaS admin */}
                      <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                        {u.status === "pending" && (
                          <button
                            onClick={() => handleApproveUser(u.id)}
                            disabled={approvingId === u.id}
                            className="bg-[#168821] hover:bg-green-800 text-white font-bold text-[11px] px-2.5 py-1 rounded-full shadow-xs transition cursor-pointer"
                          >
                            {approvingId === u.id ? "..." : "Approve"}
                          </button>
                        )}
                        {u.status === "active" && u.role !== "system_admin" && (
                          <button
                            onClick={() => handleSuspendUser(u.id)}
                            disabled={approvingId === u.id}
                            className="border border-red-300 text-red-700 hover:bg-red-50 font-bold text-[10px] px-2 py-0.5 rounded-full transition cursor-pointer"
                          >
                            Suspend
                          </button>
                        )}
                        {u.status === "suspended" && (
                          <button
                            onClick={() => handleReactivateUser(u.id)}
                            disabled={approvingId === u.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs transition cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}
                        {u.role !== "system_admin" && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            disabled={approvingId === u.id}
                            className="text-red-500 hover:text-red-700 font-bold text-[10px] px-1.5 py-0.5 rounded transition cursor-pointer"
                            title="Delete User"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fallback listing matching mockup typography */
                  [1, 2, 3].map((i) => (
                    <div key={i} className="pt-3 first:pt-0 flex items-start gap-3">
                      <div className="p-1 rounded-full text-slate-700 shrink-0 mt-0.5">
                        <UserIcon className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div>
                        <h3 className="text-[#168821] font-bold text-xs sm:text-sm leading-tight">
                          Confidence Produce Farmers Corporation
                        </h3>
                        <p className="text-[#168821] text-xs mt-0.5 font-medium">
                          Address: Kainkordu Road, Koidu
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 2: AUDIT/LOGS */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2 uppercase tracking-wide">
                AUDIT/LOGS
              </div>

              <div className="p-3.5 space-y-2">
                <h3 className="text-[#168821] font-bold text-xs sm:text-sm mb-2">
                  Confidence Produce Farmers Corporation
                </h3>

                <div className="space-y-1.5 text-xs text-slate-800 font-medium">
                  {auditLogs.length > 0 ? (
                    auditLogs.slice(0, 8).map((log, idx) => (
                      <p key={idx} className="leading-snug">
                        {log.action_description || `${log.user_name || "System Administrator"} ${log.action.replace("_", " ")}.`}
                      </p>
                    ))
                  ) : (
                    <>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                      <p className="leading-snug">System Administrator approved a user account.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. PRODUCE MANAGER DASHBOARD
          ========================================================================= */}
      {role === "produce_manager" && (
        <div className="space-y-4">
          {/* Main Gold Banner: Today Sales Analysis */}
          <div className="w-full bg-[#d4a000] text-[#0f5c18] font-black text-center py-2.5 rounded-2xl tracking-wider text-base shadow-xs">
            Today Sales Analysis
          </div>

          {/* Pending Reviews Alert if any */}
          {((data?.pending_transactions_total || 0) > 0 || (data?.pending_review_count || 0) > 0) && (
            <Link
              to="/cocoa"
              className="flex items-center justify-between p-3 bg-amber-500 text-white rounded-2xl shadow-sm text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 animate-pulse text-amber-100" />
                <span>{(data?.pending_transactions_total || data?.pending_review_count)} Purchase(s) Awaiting Review</span>
              </div>
              <span className="underline">Review Now</span>
            </Link>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {/* Cocoa Card */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2">
                Cocoa
              </div>
              <div className="p-4 space-y-1.5 text-xs text-slate-800">
                <p>
                  <strong className="text-[#168821] font-bold">Total (Kg):</strong>{" "}
                  <span className="font-bold">{(data?.cocoa?.total_weight_kg ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total bags:</strong>{" "}
                  <span className="font-bold">{data?.cocoa?.total_bags ?? 0}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.cocoa?.highest_water_percent ? `${data.cocoa.highest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Lowest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.cocoa?.lowest_water_percent ? `${data.cocoa.lowest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total Amount Bought (Nle):</strong>{" "}
                  <span className="font-bold">{(data?.cocoa?.total_value ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Seller:</strong>{" "}
                  <span className="font-bold">{data?.cocoa?.highest_seller || "None yet"}</span>
                </p>

                <div className="text-right pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCSV("cocoa")}
                    className="text-[#168821] font-bold text-xs hover:underline cursor-pointer"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Coffee Card */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2">
                Coffee
              </div>
              <div className="p-4 space-y-1.5 text-xs text-slate-800">
                <p>
                  <strong className="text-[#168821] font-bold">Total (Kg):</strong>{" "}
                  <span className="font-bold">{(data?.coffee?.total_weight_kg ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total bags:</strong>{" "}
                  <span className="font-bold">{data?.coffee?.total_bags ?? 0}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.coffee?.highest_water_percent ? `${data.coffee.highest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Lowest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.coffee?.lowest_water_percent ? `${data.coffee.lowest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total Amount Bought (Nle):</strong>{" "}
                  <span className="font-bold">{(data?.coffee?.total_value ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Seller:</strong>{" "}
                  <span className="font-bold">{data?.coffee?.highest_seller || "None yet"}</span>
                </p>

                <div className="text-right pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCSV("coffee")}
                    className="text-[#168821] font-bold text-xs hover:underline cursor-pointer"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Cola Card */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2">
                Cola
              </div>
              <div className="p-4 space-y-1.5 text-xs text-slate-800">
                <p>
                  <strong className="text-[#168821] font-bold">Total (Kg):</strong>{" "}
                  <span className="font-bold">{(data?.cola?.total_weight_kg ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total bags:</strong>{" "}
                  <span className="font-bold">{data?.cola?.total_bags ?? 0}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total Amount Bought (Nle):</strong>{" "}
                  <span className="font-bold">{(data?.cola?.total_value ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Seller:</strong>{" "}
                  <span className="font-bold">{data?.cola?.highest_seller || "None yet"}</span>
                </p>

                <div className="text-right pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCSV("cola")}
                    className="text-[#168821] font-bold text-xs hover:underline cursor-pointer"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. PRODUCE SECRETARY DASHBOARD
          ========================================================================= */}
      {role === "produce_secretary" && (
        <div className="space-y-4">
          <div className="w-full bg-[#d4a000] text-[#0f5c18] font-black text-center py-2.5 rounded-2xl tracking-wider text-base shadow-xs">
            Today Shift Analysis
          </div>

          {data?.submissions_status?.rejected > 0 && (
            <Link
              to="/transactions"
              className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-bold shadow-xs"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{data.submissions_status.rejected} Rejected Submission(s)</span>
              </div>
              <span className="underline">Fix Now</span>
            </Link>
          )}

          {/* Commodity Cards Grid for Secretary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {/* Cocoa Card */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2">
                Cocoa
              </div>
              <div className="p-4 space-y-1.5 text-xs text-slate-800">
                <p>
                  <strong className="text-[#168821] font-bold">Total (Kg):</strong>{" "}
                  <span className="font-bold">{(data?.cocoa?.total_weight_kg ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total bags:</strong>{" "}
                  <span className="font-bold">{data?.cocoa?.total_bags ?? 0}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.cocoa?.highest_water_percent ? `${data.cocoa.highest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Lowest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.cocoa?.lowest_water_percent ? `${data.cocoa.lowest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total Amount Bought (Nle):</strong>{" "}
                  <span className="font-bold">{(data?.cocoa?.total_value ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Seller:</strong>{" "}
                  <span className="font-bold">{data?.cocoa?.highest_seller || "None yet"}</span>
                </p>

                <div className="text-right pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCSV("cocoa")}
                    className="text-[#168821] font-bold text-xs hover:underline cursor-pointer"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Coffee Card */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2">
                Coffee
              </div>
              <div className="p-4 space-y-1.5 text-xs text-slate-800">
                <p>
                  <strong className="text-[#168821] font-bold">Total (Kg):</strong>{" "}
                  <span className="font-bold">{(data?.coffee?.total_weight_kg ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total bags:</strong>{" "}
                  <span className="font-bold">{data?.coffee?.total_bags ?? 0}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.coffee?.highest_water_percent ? `${data.coffee.highest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Lowest Water %:</strong>{" "}
                  <span className="font-bold">
                    {data?.coffee?.lowest_water_percent ? `${data.coffee.lowest_water_percent}%` : "N/A"}
                  </span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total Amount Bought (Nle):</strong>{" "}
                  <span className="font-bold">{(data?.coffee?.total_value ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Seller:</strong>{" "}
                  <span className="font-bold">{data?.coffee?.highest_seller || "None yet"}</span>
                </p>

                <div className="text-right pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCSV("coffee")}
                    className="text-[#168821] font-bold text-xs hover:underline cursor-pointer"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Cola Card */}
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2">
                Cola
              </div>
              <div className="p-4 space-y-1.5 text-xs text-slate-800">
                <p>
                  <strong className="text-[#168821] font-bold">Total (Kg):</strong>{" "}
                  <span className="font-bold">{(data?.cola?.total_weight_kg ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total bags:</strong>{" "}
                  <span className="font-bold">{data?.cola?.total_bags ?? 0}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Total Amount Bought (Nle):</strong>{" "}
                  <span className="font-bold">{(data?.cola?.total_value ?? 0).toLocaleString()}</span>
                </p>
                <p>
                  <strong className="text-[#168821] font-bold">Highest Seller:</strong>{" "}
                  <span className="font-bold">{data?.cola?.highest_seller || "None yet"}</span>
                </p>

                <div className="text-right pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCSV("cola")}
                    className="text-[#168821] font-bold text-xs hover:underline cursor-pointer"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Intake summary cards */}
          <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#d4a000] text-[#0f5c18] font-black text-sm px-4 py-2">
              Intake Counter Summary
            </div>
            <div className="p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#168821] font-bold">Submissions Today:</span>
                <span className="font-black text-slate-900">{data?.today_purchases_recorded || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#168821] font-bold">Gross Volume:</span>
                <span className="font-black text-slate-900">{data?.today_gross_kg || 0} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#168821] font-bold">Gross Intake Value:</span>
                <span className="font-black text-emerald-800">Nle {(data?.today_gross_nle || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
