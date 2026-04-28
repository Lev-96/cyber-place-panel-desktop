import { apiResetPassword } from "@/api/auth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setMsg("Passwords do not match"); return; }
    setBusy(true); setMsg(null);
    try {
      await apiResetPassword({ token, new_password: pw, new_password_confirmation: pw2 });
      setMsg("Password updated. You can now sign in.");
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="login-shell">
      <h1 className="login-brand">Cyber Place</h1>
      <h2 className="login-title">Reset password</h2>
      <form className="login-card" onSubmit={submit}>
        <Input label="Reset token" value={token} onChange={(e) => setToken(e.target.value)} required />
        <Input label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
        <Input label="Confirm new password" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
        {msg && <div className={msg.startsWith("Password updated") ? "muted" : "error"}>{msg}</div>}
        <Button disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
        <Link to="/login" className="login-forgot">Back to sign in</Link>
      </form>
    </div>
  );
};

export default ResetPassword;
