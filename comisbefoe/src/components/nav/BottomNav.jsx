import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore.js";
import { Home, RotateCcw, LogOut, UserPlus } from "lucide-react";

// Illustrated SVG Icons matching the mockup circles
function CocoaPodIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none">
      {/* Cocoa pod silhouette with ridges */}
      <path
        d="M24 6C16 12 12 22 13 32C14 38 18 42 24 44C30 42 34 38 35 32C36 22 32 12 24 6Z"
        fill="#fbf5ee"
        stroke="#d08b58"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M24 6V44" stroke="#d08b58" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 12C17 18 17 28 20 38" stroke="#d08b58" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M29 12C31 18 31 28 28 38" stroke="#d08b58" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24 4V6" stroke="#487822" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CoffeeBeanIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none">
      {/* Roasted Coffee Bean */}
      <ellipse
        cx="24"
        cy="24"
        rx="14"
        ry="18"
        transform="rotate(-25 24 24)"
        fill="#f7ede2"
        stroke="#c47a46"
        strokeWidth="2.5"
      />
      <path
        d="M17 11C21 16 23 20 22 25C21 29 25 33 30 37"
        stroke="#c47a46"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ColaNutIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none">
      {/* Three clustered cola nut lobes */}
      <ellipse cx="20" cy="28" rx="9" ry="11" transform="rotate(-35 20 28)" fill="#d46b7a" stroke="#8a2034" strokeWidth="1.8" />
      <ellipse cx="30" cy="27" rx="8" ry="12" transform="rotate(35 30 27)" fill="#b8455a" stroke="#8a2034" strokeWidth="1.8" />
      <ellipse cx="25" cy="18" rx="8" ry="10" fill="#e07d8d" stroke="#8a2034" strokeWidth="1.8" />
      <path d="M21 26C24 27 27 27 29 25" stroke="#ffe3e8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function BottomNav() {
  const { role, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!role) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // =========================================================================
  // SYSTEM ADMIN BOTTOM NAV: Home | Audit/Logs | Logout
  // =========================================================================
  if (role === "system_admin") {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="w-full max-w-lg mx-auto bg-[#168821] text-white flex items-center justify-around py-2 px-4 shadow-xl border-t border-emerald-700">
          {/* Home */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-1 transition ${
                isActive ? "opacity-100" : "opacity-80 hover:opacity-100"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-11 h-10 rounded-xl flex items-center justify-center transition ${
                    isActive ? "bg-white/20 ring-2 ring-white/60" : ""
                  }`}
                >
                  <Home className="w-6 h-6 text-white" />
                </div>
                <span className="text-[11px] font-bold mt-0.5">Home</span>
              </>
            )}
          </NavLink>

          {/* Audit/Logs */}
          <NavLink
            to="/audit-logs"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-1 transition ${
                isActive ? "opacity-100" : "opacity-80 hover:opacity-100"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-11 h-10 rounded-xl flex items-center justify-center transition ${
                    isActive ? "bg-white/20 ring-2 ring-white/60" : ""
                  }`}
                >
                  <RotateCcw className="w-6 h-6 text-white" />
                </div>
                <span className="text-[11px] font-bold mt-0.5">Audit/Logs</span>
              </>
            )}
          </NavLink>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center p-1 opacity-80 hover:opacity-100 transition cursor-pointer"
          >
            <div className="w-11 h-10 rounded-xl flex items-center justify-center">
              <LogOut className="w-6 h-6 text-white" />
            </div>
            <span className="text-[11px] font-bold mt-0.5">Logout</span>
          </button>
        </div>
      </nav>
    );
  }

  // =========================================================================
  // PRODUCE MANAGER & SECRETARY BOTTOM NAV: 5 Circular Commodity Buttons
  // =========================================================================
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
      <div className="w-full max-w-lg mx-auto bg-[#168821] py-2.5 px-3 flex items-center justify-around shadow-2xl border-t border-emerald-700">
        
        {/* 1. Home button */}
        <NavLink
          to="/"
          end
          className="focus:outline-none"
        >
          {({ isActive }) => (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-95 ${
                isActive
                  ? "bg-[#e5a900] border-2 border-white ring-2 ring-[#e5a900]/50"
                  : "bg-white border border-slate-200 hover:scale-105"
              }`}
            >
              <Home
                className={`w-6 h-6 ${
                  isActive ? "text-white" : "text-[#e5a900] stroke-[2.2]"
                }`}
              />
            </div>
          )}
        </NavLink>

        {/* 2. User / Staff button */}
        <NavLink
          to="/users"
          className="focus:outline-none"
        >
          {({ isActive }) => (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-95 ${
                isActive
                  ? "bg-[#e5a900] border-2 border-white ring-2 ring-[#e5a900]/50"
                  : "bg-white border border-slate-200 hover:scale-105"
              }`}
            >
              <UserPlus
                className={`w-6 h-6 ${
                  isActive ? "text-white" : "text-[#e5a900] stroke-[2.2]"
                }`}
              />
            </div>
          )}
        </NavLink>

        {/* 3. Cocoa intake button */}
        <NavLink
          to="/cocoa"
          className="focus:outline-none"
        >
          {({ isActive }) => (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-95 ${
                isActive
                  ? "bg-[#e5a900] border-2 border-white ring-2 ring-[#e5a900]/50"
                  : "bg-white border border-slate-200 hover:scale-105"
              }`}
            >
              <CocoaPodIcon />
            </div>
          )}
        </NavLink>

        {/* 4. Coffee intake button */}
        <NavLink
          to="/coffee"
          className="focus:outline-none"
        >
          {({ isActive }) => (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-95 ${
                isActive
                  ? "bg-[#e5a900] border-2 border-white ring-2 ring-[#e5a900]/50"
                  : "bg-white border border-slate-200 hover:scale-105"
              }`}
            >
              <CoffeeBeanIcon />
            </div>
          )}
        </NavLink>

        {/* 5. Cola nut intake button */}
        <NavLink
          to="/cola"
          className="focus:outline-none"
        >
          {({ isActive }) => (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-95 ${
                isActive
                  ? "bg-[#e5a900] border-2 border-white ring-2 ring-[#e5a900]/50"
                  : "bg-white border border-slate-200 hover:scale-105"
              }`}
            >
              <ColaNutIcon />
            </div>
          )}
        </NavLink>

      </div>
    </nav>
  );
}

