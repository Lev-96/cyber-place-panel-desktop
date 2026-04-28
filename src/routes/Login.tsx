import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FormEvent, useState } from "react";

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await login(email, password); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Login failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-shell">
      <h1 className="login-brand">Cyber Place</h1>
      <img className="login-logo" src="./logo.png" alt="Cyber Place" />
      <h2 className="login-title">Sign in</h2>
      <form className="login-card" onSubmit={onSubmit}>
        <Input label="Email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <div className="error" style={{ textAlign: "center" }}>{err}</div>}
        <a className="login-forgot" href="#/forgot-password">Forgot password?</a>
        <Button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
};

export default Login;
