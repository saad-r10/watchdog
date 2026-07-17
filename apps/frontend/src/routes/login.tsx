import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { WatchdogMark } from "@/components/WatchdogMark";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didReset = searchParams.get("reset") === "1";
  const { login, mfaVerify } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result?.requiresMfa) {
        setMfaToken(result.mfaToken);
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      if (err?.response?.status === 423) {
        const sec = err.response.data?.retryAfter ?? 60;
        const mins = Math.ceil(sec / 60);
        setError(`Account locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`);
      } else {
        setError(msg ?? "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError("");
    setLoading(true);
    try {
      await mfaVerify(mfaToken, mfaCode);
      navigate("/dashboard");
    } catch {
      setError("Invalid verification code. Please try again.");
      setMfaCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <WatchdogMark className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Watchdog</span>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl shadow-black/40">
          {mfaToken ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-semibold text-foreground">Two-factor authentication</h1>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Enter the 6-digit code from your authenticator app.
              </p>

              <form className="space-y-4" onSubmit={handleMfaSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-code" className="text-xs text-muted-foreground">Verification code</Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="text-center text-lg tracking-widest"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading || mfaCode.length !== 6} className="w-full" size="default">
                  {loading ? "Verifying…" : "Verify"}
                </Button>

                <button
                  type="button"
                  onClick={() => { setMfaToken(null); setMfaCode(""); setError(""); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
                >
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground mb-1">Sign in</h1>
              <p className="text-sm text-muted-foreground mb-6">to your Watchdog account</p>

              {didReset && (
                <Alert className="mb-5 border-emerald-500/20 bg-emerald-500/10">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <AlertDescription className="text-emerald-400 text-sm">
                    Password reset - you can now sign in.
                  </AlertDescription>
                </Alert>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading} className="w-full" size="default">
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </>
          )}
        </div>

        {!mfaToken && (
          <p className="mt-5 text-sm text-muted-foreground text-center">
            No account?{" "}
            <Link to="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
