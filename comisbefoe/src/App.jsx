import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore.js";

// Components & Layout
import ProtectedRoute from "./components/shared/ProtectedRoute.jsx";
import OfflineBanner from "./components/shared/OfflineBanner.jsx";
import TopHeader from "./components/nav/TopHeader.jsx";
import BottomNav from "./components/nav/BottomNav.jsx";

// Pages
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Seller from "./pages/Seller.jsx";
import Cocoa from "./pages/Cocoa.jsx";
import Coffee from "./pages/Coffee.jsx";
import Cola from "./pages/Cola.jsx";
import Transactions from "./pages/Transactions.jsx";
import Loan from "./pages/Loan.jsx";
import Receipts from "./pages/Receipts.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";
import Settings from "./pages/Settings.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import TermsOfService from "./pages/TermsOfService.jsx";
import UserAgreement from "./pages/UserAgreement.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import About from "./pages/About.jsx";

function AppLayout({ children }) {
  const { role } = useAuthStore();

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
        <OfflineBanner />
        <main className="flex-1 w-full">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <OfflineBanner />
      <TopHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login initialMode="signin" />} />
          <Route path="/signup" element={<Login initialMode="signup" />} />
          <Route path="/register" element={<Login initialMode="signup" />} />

          {/* Public Legal & Informational Pages */}
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/user-agreement" element={<UserAgreement />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<About />} />

          {/* Core Dashboard / Home */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* Seller Registry */}
          <Route
            path="/seller"
            element={
              <ProtectedRoute>
                <Seller />
              </ProtectedRoute>
            }
          />

          {/* Commodity Intake Pages */}
          <Route
            path="/cocoa"
            element={
              <ProtectedRoute>
                <Cocoa />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coffee"
            element={
              <ProtectedRoute>
                <Coffee />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cola"
            element={
              <ProtectedRoute>
                <Cola />
              </ProtectedRoute>
            }
          />

          {/* Secretary Submitted Transactions */}
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />

          {/* Loans Management (Manager & Admin) */}
          <Route
            path="/loan"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <Loan />
              </ProtectedRoute>
            }
          />

          {/* Receipts & Pending Verification (Manager & Secretary only) */}
          <Route
            path="/receipts"
            element={
              <ProtectedRoute roles={["produce_manager", "produce_secretary"]}>
                <Receipts />
              </ProtectedRoute>
            }
          />

          {/* Reporting & Analytics (Manager & Secretary only) */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute roles={["produce_manager", "produce_secretary"]}>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Staff & User Management (Manager & Admin) */}
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <Users />
              </ProtectedRoute>
            }
          />

          {/* Operational Settings (Manager & Admin) */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Audit Logs (Admin & Manager) */}
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />

          {/* Edit Profile (Manager & System Admin only) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <EditProfile />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
