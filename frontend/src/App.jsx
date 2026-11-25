import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import AdminLayout from "./components/AdminLayout.jsx";
import FarmerLayout from "./components/FarmerLayout.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import RequireRole, { PublicOnly } from "./components/RequireRole.jsx";
import { buttonClass } from "./components/ui.jsx";
import AdminAudit from "./pages/admin/AdminAudit.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminFarmerDetail from "./pages/admin/AdminFarmerDetail.jsx";
import AdminFarmers from "./pages/admin/AdminFarmers.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements.jsx";
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
import ExpenseForm from "./pages/farmer/ExpenseForm.jsx";
import Group, { GroupDashboard } from "./pages/farmer/Group.jsx";
import HarvestDetail from "./pages/farmer/HarvestDetail.jsx";
import HarvestForm from "./pages/farmer/HarvestForm.jsx";
import Harvests from "./pages/farmer/Harvests.jsx";
import InspectionForm from "./pages/farmer/InspectionForm.jsx";
import Money from "./pages/farmer/Money.jsx";
import SaleDetail from "./pages/farmer/SaleDetail.jsx";
import SaleForm from "./pages/farmer/SaleForm.jsx";
import Passport from "./pages/Passport.jsx";
import AdminCooperatives, { AdminCooperativeDetail } from "./pages/admin/AdminCooperatives.jsx";
import ForgotPin from "./pages/ForgotPin.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Welcome from "./pages/Welcome.jsx";
import WhoIsUsing from "./pages/WhoIsUsing.jsx";
import Buyers, { BuyerForm } from "./pages/farmer/Buyers.jsx";
import Report from "./pages/farmer/Report.jsx";
import Notifications from "./pages/farmer/Notifications.jsx";
import SeasonCompare from "./pages/farmer/SeasonCompare.jsx";
import BuyerRequests from "./pages/farmer/BuyerRequests.jsx";
import Prices from "./pages/farmer/Prices.jsx";
import Market from "./pages/Market.jsx";
import { AnimalEventForm, ProductionDetail, ProductionForm } from "./pages/farmer/Productions.jsx";

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

        <Route path="/who" element={<WhoIsUsing />} />
        {/* Public: buyers scan a harvest batch's QR code. */}
        <Route path="/p/:code" element={<Passport />} />
        <Route path="/market" element={<Market />} />

        <Route element={<RequireRole role="farmer" />}>
          <Route path="/app" element={<FarmerLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="farms" element={<Farms />} />
            <Route path="farms/new" element={<FarmForm />} />
            <Route path="farms/:farmId" element={<FarmDetail />} />
            <Route path="farms/:farmId/edit" element={<FarmForm />} />
            <Route path="farms/:farmId/productions/new" element={<ProductionForm />} />
            <Route path="productions/:clientId" element={<ProductionDetail />} />
            <Route path="productions/:clientId/edit" element={<ProductionForm />} />
            <Route path="productions/:clientId/animals/new" element={<AnimalEventForm />} />
            <Route path="animal-events/:eventId" element={<AnimalEventForm />} />
            <Route path="record" element={<RecordActivity />} />
            <Route path="history" element={<History />} />
            <Route path="activities/:clientId" element={<ActivityDetail />} />
            <Route path="activities/:clientId/edit" element={<EditActivity />} />
            <Route path="sync" element={<SyncStatus />} />
            <Route path="profile" element={<Profile />} />
            <Route path="harvests" element={<Harvests />} />
            <Route path="harvests/new" element={<HarvestForm />} />
            <Route path="harvests/:clientId" element={<HarvestDetail />} />
            <Route path="harvests/:clientId/edit" element={<HarvestForm />} />
            <Route path="harvests/:clientId/check" element={<InspectionForm />} />
            <Route path="harvests/:clientId/check/:checkId" element={<InspectionForm />} />
            <Route path="money" element={<Money />} />
            <Route path="money/sell" element={<SaleForm />} />
            <Route path="money/sales/:clientId" element={<SaleDetail />} />
            <Route path="money/sales/:clientId/edit" element={<SaleForm />} />
            <Route path="report" element={<Report />} />
            <Route path="messages" element={<Notifications />} />
            <Route path="compare" element={<SeasonCompare />} />
            <Route path="requests" element={<BuyerRequests />} />
            <Route path="prices" element={<Prices />} />
            <Route path="money/buyers" element={<Buyers />} />
            <Route path="money/buyers/new" element={<BuyerForm />} />
            <Route path="money/buyers/:clientId" element={<BuyerForm />} />
            <Route path="money/spend" element={<ExpenseForm />} />
            <Route path="money/spend/:clientId" element={<ExpenseForm />} />
            <Route path="group" element={<Group />} />
            <Route path="group/:groupId" element={<GroupDashboard />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="farmers" element={<AdminFarmers />} />
            <Route path="farmers/:farmerId" element={<AdminFarmerDetail />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="cooperatives" element={<AdminCooperatives />} />
            <Route path="cooperatives/:cooperativeId" element={<AdminCooperativeDetail />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
