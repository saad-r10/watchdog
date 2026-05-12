import { Routes, Route, Navigate } from "react-router-dom";
import { PrivateRoute } from "./components/PrivateRoute";
import DashboardPage from "./routes/dashboard";
import LoginPage from "./routes/login";
import RegisterPage from "./routes/register";
import MonitorsPage from "./routes/monitors";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/monitors"
        element={
          <PrivateRoute>
            <MonitorsPage />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
