import { Routes, Route, Navigate } from "react-router-dom";
import { PrivateRoute } from "./components/PrivateRoute";
import { Layout } from "./components/Layout";
import DashboardPage from "./routes/dashboard";
import LoginPage from "./routes/login";
import RegisterPage from "./routes/register";
import MonitorsPage from "./routes/monitors";
import MonitorDetailPage from "./routes/monitor-detail";
import SettingsPage from "./routes/settings";

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<PrivateLayout><DashboardPage /></PrivateLayout>} />
      <Route path="/monitors" element={<PrivateLayout><MonitorsPage /></PrivateLayout>} />
      <Route path="/monitors/:id" element={<PrivateLayout><MonitorDetailPage /></PrivateLayout>} />
      <Route path="/settings" element={<PrivateLayout><SettingsPage /></PrivateLayout>} />
    </Routes>
  );
}
