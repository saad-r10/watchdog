import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Nav } from "../components/Nav";
import { api } from "../services/api";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
  });

  const [alertEmail, setAlertEmail] = useState("");
  const [alertDowntime, setAlertDowntime] = useState(true);
  const [alertSslExpiry, setAlertSslExpiry] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setAlertEmail(data.alertEmail ?? "");
      setAlertDowntime(data.alertDowntime);
      setAlertSslExpiry(data.alertSslExpiry);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      api.settings.update({
        alertEmail: alertEmail.trim() || null,
        alertDowntime,
        alertSslExpiry,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav current="settings" />
      <main className="max-w-xl mx-auto p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Alert Settings</h2>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <form
            className="bg-white rounded-lg border divide-y"
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          >
            {/* Alert email */}
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alert email address
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Leave blank to use your account email. Alerts are sent here when an incident is detected.
              </p>
              <input
                type="email"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="alerts@yourdomain.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
              />
            </div>

            {/* Alert types */}
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium text-gray-700">Notify me when…</p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={alertDowntime}
                  onChange={(e) => setAlertDowntime(e.target.checked)}
                />
                <div>
                  <p className="text-sm text-gray-800 font-medium">Site is down</p>
                  <p className="text-xs text-gray-400">One email per incident, no repeat spam.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={alertSslExpiry}
                  onChange={(e) => setAlertSslExpiry(e.target.checked)}
                />
                <div>
                  <p className="text-sm text-gray-800 font-medium">SSL certificate expiring soon</p>
                  <p className="text-xs text-gray-400">Triggered when fewer than 14 days remain.</p>
                </div>
              </label>
            </div>

            {/* Save */}
            <div className="p-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {mutation.isPending ? "Saving…" : "Save settings"}
              </button>
              {saved && <p className="text-sm text-green-600 font-medium">Saved ✓</p>}
              {mutation.isError && <p className="text-sm text-red-600">Failed to save.</p>}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
