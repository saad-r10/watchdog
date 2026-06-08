import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { PrivateRoute } from "./components/PrivateRoute";
import { Layout } from "./components/Layout";
import LandingPage from "./routes/landing";
import DashboardPage from "./routes/dashboard";
import LoginPage from "./routes/login";
import RegisterPage from "./routes/register";
import MonitorsPage from "./routes/monitors";
import MonitorDetailPage from "./routes/monitor-detail";
import SettingsPage from "./routes/settings";
import StatusPagesPage from "./routes/status-pages";
import StatusPagePublic from "./routes/status-page-public";
import OnboardingPage from "./routes/onboarding";
import ForgotPasswordPage from "./routes/forgot-password";
import ResetPasswordPage from "./routes/reset-password";
import VerifyEmailPage from "./routes/verify-email";

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  );
}

function HomeRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboarding" element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/dashboard" element={<PrivateLayout><DashboardPage /></PrivateLayout>} />
      <Route path="/monitors" element={<PrivateLayout><MonitorsPage /></PrivateLayout>} />
      <Route path="/monitors/:id" element={<PrivateLayout><MonitorDetailPage /></PrivateLayout>} />
      <Route path="/settings" element={<PrivateLayout><SettingsPage /></PrivateLayout>} />
      <Route path="/agents" element={<Navigate to="/settings" replace />} />
      <Route path="/status-pages" element={<PrivateLayout><StatusPagesPage /></PrivateLayout>} />
      <Route path="/status/:slug" element={<StatusPagePublic />} />
    </Routes>
  );
}
