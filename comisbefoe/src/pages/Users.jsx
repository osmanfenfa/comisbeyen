import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  Users as UsersIcon, UserPlus, CheckCircle, ShieldAlert, 
  X, Check, Lock, Building, Phone, UserCheck, Mail, MapPin, 
  FileText, User, Search
} from "lucide-react";

export default function Users() {
  const { role, stationName } = useAuthStore();
  const { sellers, fetchSellers } = useAppStore();

  const [activeTab, setActiveTab] = useState("secretary"); // 'secretary' | 'seller'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formMsg, setFormMsg] = useState({ type: "", text: "" });

  // Add Secretary Form State (matching media_1788701910498.png 6 stadium pill inputs)
  const [secFullName, setSecFullName] = useState("");
  const [secEmail, setSecEmail] = useState("");
  const [secPhone, setSecPhone] = useState("");
  const [secAddress, setSecAddress] = useState("");
  const [secPassword, setSecPassword] = useState("");
  const [secConfirmPassword, setSecConfirmPassword] = useState("");
  const [submittingSec, setSubmittingSec] = useState(false);

  // Add Seller Form State
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerGender, setSellerGender] = useState("male");
  const [sellerNIN, setSellerNIN] = useState("");
  const [submittingSeller, setSubmittingSeller] = useState(false);

  // Filter for admin list
  const [adminRoleFilter, setAdminRoleFilter] = useState("all");

  useEffect(() => {
    loadUsers();
    fetchSellers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (role === "system_admin") {
        const { data } = await client.get("/users/");
        setUsers(data);
      } else {
        const { data } = await client.get("/users/me");
        setUsers([data]);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSecretary = async (e) => {
    e.preventDefault();
    if (secPassword !== secConfirmPassword) {
      setFormMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (secPassword.length < 6) {
      setFormMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setFormMsg({ type: "", text: "" });
    setSubmittingSec(true);

    try {
      await client.post("/users/secretaries", {
        name: secFullName,
        contact: secPhone || secEmail,
        email: secEmail || null,
        phone_number: secPhone || null,
        address: secAddress || null,
        password: secPassword,
        station_name: stationName || "Main Station",
      });

      setFormMsg({
        type: "success",
        text: `Secretary "${secFullName}" account created and active immediately!`,
      });
      setSecFullName("");
      setSecEmail("");
      setSecPhone("");
      setSecAddress("");
      setSecPassword("");
      setSecConfirmPassword("");
      loadUsers();

      setTimeout(() => setFormMsg({ type: "", text: "" }), 5000);
    } catch (err) {
      setFormMsg({
        type: "error",
        text: err.response?.data?.detail || "Failed to create secretary account.",
      });
    } finally {
      setSubmittingSec(false);
    }
  };

  const handleRegisterSeller = async (e) => {
    e.preventDefault();
    setFormMsg({ type: "", text: "" });
    setSubmittingSeller(true);

    try {
      await client.post("/sellers/", {
        name: sellerName,
        gender: sellerGender,
        address: sellerAddress,
        contact: sellerPhone,
      });

      setFormMsg({
        type: "success",
        text: `Seller "${sellerName}" registered successfully!`,
      });
      setSellerName("");
      setSellerPhone("");
      setSellerAddress("");
      setSellerNIN("");
      fetchSellers();

      setTimeout(() => setFormMsg({ type: "", text: "" }), 5000);
    } catch (err) {
      setFormMsg({
        type: "error",
        text: err.response?.data?.detail || "Failed to register seller.",
      });
    } finally {
      setSubmittingSeller(false);
    }
  };

  const handleApproveManager = async (userId) => {
    try {
      await client.post(`/users/${userId}/approve`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Approval failed");
    }
  };

  const handleSuspendUser = async (userId) => {
    if (!confirm("Are you sure you want to suspend this user account?")) return;
    try {
      await client.post(`/users/${userId}/suspend`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Suspension failed");
    }
  };

  const handleReactivateUser = async (userId) => {
    try {
      await client.post(`/users/${userId}/reactivate`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Reactivation failed");
    }
  };

  const pendingManagersCount = users.filter(
    (u) => u.role === "produce_manager" && u.status === "pending"
  ).length;

  return (
    <div className="p-3 sm:p-4 space-y-4 pb-28">
      {/* Top Toggle Tabs (EXACT MATCH TO MOCKUP media_1788701910498.png) */}
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab("secretary");
            setFormMsg({ type: "", text: "" });
          }}
          className={`py-2 px-6 rounded-full font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer shadow-xs ${
            activeTab === "secretary"
              ? "bg-[#168821] text-white shadow-md scale-102"
              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          Add Secretary
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("seller");
            setFormMsg({ type: "", text: "" });
          }}
          className={`py-2 px-6 rounded-full font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer shadow-xs ${
            activeTab === "seller"
              ? "bg-[#168821] text-white shadow-md scale-102"
              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          Add Seller
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
          {formMsg.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{formMsg.text}</span>
        </div>
      )}

      {/* Main Responsive Grid: Single column on mobile, 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          {/* =========================================================================
              CARD: ADD SECRETARY / ADD SELLER (MATCHING media_1788701910498.png)
              ========================================================================= */}
          {activeTab === "secretary" ? (
            <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
              {/* Yellow Header Banner */}
              <div className="bg-[#d4a000] py-2 px-4 text-center">
                <h2 className="text-[#0f5c18] font-black text-sm sm:text-base tracking-wide uppercase">
              Add Secretary
            </h2>
          </div>

          {/* 6 Stadium Pill Inputs with Green Icon Badges */}
          <form onSubmit={handleCreateSecretary} className="p-4 space-y-2.5">
            {/* 1. Full Name */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <User className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="text"
                required
                placeholder="Full Name"
                value={secFullName}
                onChange={(e) => setSecFullName(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 2. Email */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <Mail className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="email"
                placeholder="Email"
                value={secEmail}
                onChange={(e) => setSecEmail(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 3. Phone Number */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <Phone className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="tel"
                required
                placeholder="Phone Number"
                value={secPhone}
                onChange={(e) => setSecPhone(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 4. Address */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="text"
                placeholder="Address"
                value={secAddress}
                onChange={(e) => setSecAddress(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 5. Password */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <Lock className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="password"
                required
                placeholder="Password"
                value={secPassword}
                onChange={(e) => setSecPassword(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 6. Confirm Password */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <Lock className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="password"
                required
                placeholder="Confirm Password"
                value={secConfirmPassword}
                onChange={(e) => setSecConfirmPassword(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* Create User Button */}
            <button
              type="submit"
              disabled={submittingSec}
              className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-black text-sm sm:text-base py-2.5 rounded-full shadow-sm active:scale-98 transition flex items-center justify-center cursor-pointer disabled:opacity-50 mt-2"
            >
              {submittingSec ? "Creating Account..." : "Create User"}
            </button>
          </form>
        </div>
      ) : (
        /* ADD SELLER CARD */
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="bg-[#d4a000] py-2 px-4 text-center">
            <h2 className="text-[#0f5c18] font-black text-sm sm:text-base tracking-wide uppercase">
              Add Seller
            </h2>
          </div>

          <form onSubmit={handleRegisterSeller} className="p-4 space-y-2.5">
            {/* 1. Full Name */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <User className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="text"
                required
                placeholder="Full Name"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 2. Phone Number */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <Phone className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="tel"
                required
                placeholder="Phone Number / Contact"
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 3. Community / Address */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="text"
                required
                placeholder="Community / Town / Address"
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* 4. Gender Selector */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-3">
              <span className="text-xs font-bold text-slate-700 mr-3 shrink-0">Gender:</span>
              <div className="flex gap-4 text-xs font-semibold text-slate-800">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={sellerGender === "male"}
                    onChange={(e) => setSellerGender(e.target.value)}
                    className="text-[#168821] focus:ring-emerald-600"
                  />
                  <span>Male</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={sellerGender === "female"}
                    onChange={(e) => setSellerGender(e.target.value)}
                    className="text-[#168821] focus:ring-emerald-600"
                  />
                  <span>Female</span>
                </label>
              </div>
            </div>

            {/* 5. National ID / NIN (Optional) */}
            <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
              <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                <FileText className="w-4 h-4" />
              </div>
              <div className="h-6 w-px bg-slate-300 mx-2.5" />
              <input
                type="text"
                placeholder="National ID / NIN (Optional)"
                value={sellerNIN}
                onChange={(e) => setSellerNIN(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
              />
            </div>

            {/* Register Seller Button */}
            <button
              type="submit"
              disabled={submittingSeller}
              className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-black text-sm sm:text-base py-2.5 rounded-full shadow-sm active:scale-98 transition flex items-center justify-center cursor-pointer disabled:opacity-50 mt-2"
            >
              {submittingSeller ? "Registering..." : "Register Seller"}
            </button>
          </form>
        </div>
      )}
      </div>

      {/* =========================================================================
          DIRECTORY SECTION (Preserving all user/seller listing & admin controls)
          ========================================================================= */}
      <div className="lg:col-span-7">
      {role === "system_admin" ? (
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="bg-[#d4a000] py-2 px-4 text-center flex items-center justify-between">
            <h3 className="text-[#0f5c18] font-black text-sm uppercase">SaaS System Users</h3>
            {pendingManagersCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingManagersCount} Pending
              </span>
            )}
          </div>

          <div className="p-3 divide-y divide-slate-100">
            {loading ? (
              <p className="text-center py-6 text-xs text-slate-400">Loading users...</p>
            ) : (
              users.map((u) => {
                const isPending = u.status === "pending";
                const isSuspended = u.status === "suspended";

                return (
                  <div key={u.id} className="py-2.5 first:pt-1 last:pb-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{u.name}</span>
                          <span className="text-[10px] text-[#168821] font-semibold">({u.role.replace("_", " ")})</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {u.business_name || u.station_name || "Buying Station"} · {u.contact}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          u.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : isPending
                            ? "bg-amber-100 text-amber-800 animate-pulse"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>

                    {/* Admin Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      {isPending && u.role === "produce_manager" && (
                        <button
                          type="button"
                          onClick={() => handleApproveManager(u.id)}
                          className="flex-1 bg-[#168821] hover:bg-[#126e1a] text-white py-1.5 rounded-full text-xs font-bold shadow-xs active:scale-95 transition"
                        >
                          Approve Account
                        </button>
                      )}

                      {!isPending && !isSuspended && u.role !== "system_admin" && (
                        <button
                          type="button"
                          onClick={() => handleSuspendUser(u.id)}
                          className="flex-1 border border-red-300 text-red-700 hover:bg-red-50 py-1 rounded-full text-xs font-bold transition"
                        >
                          Suspend
                        </button>
                      )}

                      {isSuspended && (
                        <button
                          type="button"
                          onClick={() => handleReactivateUser(u.id)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded-full text-xs font-bold shadow-xs transition"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Manager / Secretary view: Registered Sellers list */
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="bg-[#d4a000] py-2 px-4 text-center">
            <h3 className="text-[#0f5c18] font-black text-sm uppercase">Registered Sellers</h3>
          </div>

          <div className="p-3 divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {sellers.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">No sellers registered yet.</p>
            ) : (
              sellers.map((s) => (
                <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{s.name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({s.seller_id})</span>
                    <p className="text-[11px] text-slate-500">{s.address} · {s.contact || "No phone"}</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
