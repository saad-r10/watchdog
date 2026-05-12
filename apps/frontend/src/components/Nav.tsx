import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function Nav({ current }: { current?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const linkClass = (name: string) =>
    `text-sm font-medium ${current === name ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`;

  return (
    <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="text-xl font-bold text-gray-900">Watchdog</Link>
        <span className="text-gray-200">|</span>
        <Link to="/dashboard" className={linkClass("dashboard")}>Dashboard</Link>
        <Link to="/monitors" className={linkClass("monitors")}>Monitors</Link>
        <Link to="/settings" className={linkClass("settings")}>Settings</Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">{user?.email}</span>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">
          Sign out
        </button>
      </div>
    </header>
  );
}
