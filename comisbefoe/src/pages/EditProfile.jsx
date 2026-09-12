import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { LogOut, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function EditProfile() {
  const { role, name: storeName, stationName: storeStation, updateProfile } = useAuthStore();
  const navigate = useNavigate();

  const isManager = role === "produce_manager";
  const isSystemAdmin = role === "system_admin";

  // Section 1: Business / System Info
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");

  // Section 2: Personal Manager / Admin Info
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [personalAddress, setPersonalAddress] = useState("");
  const [contact, setContact] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");

  // Status & Feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ text: "", type: "" });

  // Load existing profile from API
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data } = await client.get("/users/me");
        setBusinessName(data.business_name || data.station_name || "");
        setBusinessEmail(data.email || "");
        setBusinessAddress(data.address || "");
        setBusinessPhone(data.phone_number || data.contact || "");

        setFullName(data.name || "");
        setGender(data.gender || "");
        setPersonalAddress(data.address || "");
        setContact(data.contact || "");
        setPersonalEmail(data.email || "");
      } catch (err) {
        console.error("Failed to load user profile", err);
      } finally {
        setLoading(false);
      }
    }
    loadUserProfile();
  }, []);

  // Save Profile Handler
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const payload = {
        name: fullName,
        contact: contact,
        station_name: businessName,
        business_name: businessName,
        address: businessAddress || personalAddress,
        phone_number: businessPhone,
        email: businessEmail || personalEmail,
        gender: gender,
      };

      const { data } = await client.put("/users/me", payload);

      // Update authStore session so top navigation reflects changes immediately
      updateProfile({
        name: data.name,
        stationName: data.business_name || data.station_name,
      });

      setMessage({ text: "Profile updated successfully!", type: "success" });
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to update profile. Please check your information.";
      setMessage({ text: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ text: "", type: "" });

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "New passwords do not match.", type: "error" });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ text: "Password must be at least 6 characters long.", type: "error" });
      return;
    }

    setPasswordLoading(true);

    try {
      await client.post("/users/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordMessage({ text: "Password changed successfully!", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMessage({ text: "", type: "" });
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to change password. Ensure current password is correct.";
      setPasswordMessage({ text: msg, type: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const currentDisplayName = businessName || storeStation || "Confidence Produce Farmers Corporation";

  return (
    <div className="min-h-screen py-2 sm:py-6 max-w-xl mx-auto">
      {/* Outer Card with Green Outline Matching Mockup */}
      <div className="border-2 border-[#168821] rounded-3xl overflow-hidden bg-white shadow-md">
        
        {/* =========================================================================
            TOP HEADER BANNER (Golden-Yellow background matching media_1788721666868.png)
            ========================================================================= */}
        <div className="bg-[#d4a000] p-4 sm:p-5 relative text-white">
          <div className="flex items-center justify-between">
            {/* Left: Title */}
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Edit Profile
              </h2>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                Manage your produce buying business & personal details
              </p>
            </div>

            {/* Right: Exit / Return Button (Logout icon matching mockup) */}
            <button
              onClick={() => navigate(-1)}
              className="text-white hover:text-slate-900 transition p-1 cursor-pointer"
              title="Return to Dashboard"
              aria-label="Return"
            >
              <LogOut className="w-6 h-6 stroke-[2.2]" />
            </button>
          </div>

          {/* Station / Company Title Below Logo */}
          <h2 className="text-[#0f5c18] font-black text-sm sm:text-base mt-2.5 tracking-wide uppercase">
            {isSystemAdmin ? "COMIS Central Administration" : currentDisplayName}
          </h2>
        </div>

        {/* =========================================================================
            EDIT PROFILE FORM BODY
            ========================================================================= */}
        <form onSubmit={handleSaveProfile} className="p-4 sm:p-6 space-y-4">
          {message.text && (
            <div
              className={`p-3 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Section 1: Manager / Station Info (or System Admin Info) */}
          <div className="space-y-2.5">
            <h3 className="text-[#d4a000] font-black text-sm uppercase tracking-wide">
              {isSystemAdmin ? "System Administration" : "Manager"}
            </h3>

            {/* Stadium Pill 1: Business Name */}
            <input
              type="text"
              placeholder={isSystemAdmin ? "System Organization Name" : "Business Name"}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />

            {/* Stadium Pill 2: Business Email */}
            <input
              type="email"
              placeholder={isSystemAdmin ? "System Official Email" : "Business Email"}
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />

            {/* Stadium Pill 3: Address */}
            <input
              type="text"
              placeholder="Address"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />

            {/* Stadium Pill 4: Phone Number */}
            <input
              type="tel"
              placeholder="Phone Number"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />
          </div>

          {/* Section 2: Manager / Admin Info */}
          <div className="space-y-2.5 pt-2">
            <h3 className="text-[#d4a000] font-black text-sm uppercase tracking-wide">
              {isSystemAdmin ? "Admin Info" : "Manager Info"}
            </h3>

            {/* Stadium Pill 1: Full Name */}
            <input
              type="text"
              required
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />

            {/* Stadium Pill 2: Gender */}
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            >
              <option value="">Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            {/* Stadium Pill 3: Address */}
            <input
              type="text"
              placeholder="Address"
              value={personalAddress}
              onChange={(e) => setPersonalAddress(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />

            {/* Stadium Pill 4: Contact */}
            <input
              type="text"
              required
              placeholder="Contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />

            {/* Stadium Pill 5: Email */}
            <input
              type="email"
              placeholder="Email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
            />
          </div>

          {/* Green Stadium Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-bold py-3 rounded-full shadow-sm active:scale-98 transition text-sm sm:text-base cursor-pointer disabled:opacity-50 mt-4"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {/* Change Password Link in Gold */}
          <div className="text-center pt-1 pb-2">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordMessage({ text: "", type: "" });
              }}
              className="text-[#d4a000] font-black text-sm tracking-wide hover:underline cursor-pointer"
            >
              Change Password
            </button>
          </div>
        </form>
      </div>

      {/* =========================================================================
          CHANGE PASSWORD MODAL
          ========================================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl border-2 border-[#168821] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center border-b pb-2.5">
              <h3 className="text-base font-black text-[#0f5c18] uppercase tracking-wide">
                Change Password
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your account security credentials
              </p>
            </div>

            {passwordMessage.text && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                  passwordMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {passwordMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showCurrentPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNewPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-700 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#168821] focus:ring-2 focus:ring-[#168821]/20 transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 bg-[#168821] hover:bg-[#126e1a] text-white py-2.5 rounded-full text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

