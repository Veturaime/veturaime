import { Navigate, Route, Routes } from "react-router-dom";
import CarSetupPage from "./pages/CarSetupPage";
import DashboardPage from "./pages/DashboardPage";
import DesignVariantPage from "./pages/DesignVariantPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MyGaragePage from "./pages/MyGaragePage";
import OnboardingPage from "./pages/OnboardingPage";
import RegisterPage from "./pages/RegisterPage";
import VehicleDashboardPage from "./pages/VehicleDashboardPage";
import VerificationPage from "./pages/VerificationPage";

function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Auth flow */}
      <Route path="/verify" element={<VerificationPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/car-setup" element={<CarSetupPage />} />
      
      {/* Main app */}
      <Route path="/my-garage" element={<MyGaragePage />} />
      <Route path="/vehicle/:carId" element={<VehicleDashboardPage />} />
      
      {/* Legacy dashboard (kept for compatibility) */}
      <Route path="/dashboard" element={<DashboardPage />} />
      
      {/* Design variants */}
      <Route path="/1" element={<DesignVariantPage variant={1} />} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
