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
      <form className="login-card" onSubmit={onSubmit}>
        <h2>Cyberplace Panel</h2>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <div className="error">{err}</div>}
        <Button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
};

export default Login;
