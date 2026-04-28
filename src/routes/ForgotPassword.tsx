import { apiForgotPassword } from "@/api/auth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await apiForgotPassword(email); setMsg("If the email exists, a reset link has been sent."); }
    catch (ex) { setMsg(ex instanceof Error ? ex.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-shell">
      <h1 className="login-brand">Cyber Place</h1>
      <h2 className="login-title">Forgot password</h2>
      <form className="login-card" onSubmit={submit}>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        {msg && <div className={msg.startsWith("If") ? "muted" : "error"}>{msg}</div>}
        <Button disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
        <Link to="/login" className="login-forgot">Back to sign in</Link>
      </form>
    </div>
  );
};

export default ForgotPassword;
