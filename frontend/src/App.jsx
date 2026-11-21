import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import AdminLayout from "./components/AdminLayout.jsx";
import FarmerLayout from "./components/FarmerLayout.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import RequireRole, { PublicOnly } from "./components/RequireRole.jsx";
import { buttonClass } from "./components/ui.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminFarmerDetail from "./pages/admin/AdminFarmerDetail.jsx";
import AdminFarmers from "./pages/admin/AdminFarmers.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import Dashboard from "./pages/farmer/Dashboard.jsx";
import ActivityDetail from "./pages/farmer/ActivityDetail.jsx";
import EditActivity from "./pages/farmer/EditActivity.jsx";
import FarmDetail from "./pages/farmer/FarmDetail.jsx";
import FarmForm from "./pages/farmer/FarmForm.jsx";
import Farms from "./pages/farmer/Farms.jsx";
import History from "./pages/farmer/History.jsx";
import Profile from "./pages/farmer/Profile.jsx";
import RecordActivity from "./pages/farmer/RecordActivity.jsx";
import SyncStatus from "./pages/farmer/SyncStatus.jsx";
import ForgotPin from "./pages/ForgotPin.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Welcome from "./pages/Welcome.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-bold text-ink">This page is not here</h1>
      <p className="max-w-sm text-sm text-ink-soft">
        The page you were looking for may have moved. Go back to your home screen to continue.
      </p>
      <Link to="/" className={buttonClass("primary", "lg")}>
        Go to start
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <InstallPrompt />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-pin" element={<ForgotPin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin/login" element={<Login standalone />} />
        </Route>

        <Route element={<RequireRole role="farmer" />}>
          <Route path="/app" element={<FarmerLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="farms" element={<Farms />} />
            <Route path="farms/new" element={<FarmForm />} />
            <Route path="farms/:farmId" element={<FarmDetail />} />
            <Route path="farms/:farmId/edit" element={<FarmForm />} />
            <Route path="record" element={<RecordActivity />} />
            <Route path="history" element={<History />} />
            <Route path="activities/:clientId" element={<ActivityDetail />} />
            <Route path="activities/:clientId/edit" element={<EditActivity />} />
            <Route path="sync" element={<SyncStatus />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="farmers" element={<AdminFarmers />} />
            <Route path="farmers/:farmerId" element={<AdminFarmerDetail />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
