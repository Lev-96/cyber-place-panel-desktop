import Button from "@/components/ui/Button";
import { IPcApi } from "@/types/sessions";
import { useState } from "react";

interface Props {
  pc: IPcApi;
  onClose: () => void;
}

const PairingTokenModal = ({ pc, onClose }: Props) => {
  const [copied, setCopied] = useState(false);
  const token = pc.pairing_token ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div style={overlay}>
      <div className="card" style={{ width: 480, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0 }}>Pairing token · {pc.label}</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          Save this token now — it will not be shown again. You'll need it on the agent during PC setup, along with PC ID <b style={{ color: "#fff" }}>{pc.id}</b>.
        </div>
        <code style={{
          background: "#020514", border: "1px solid #1f2a44", borderRadius: 8,
          padding: 14, wordBreak: "break-all", fontSize: 13, color: "#07ddf1",
        }}>{token}</code>
        <div className="row-between">
          <Button variant="secondary" onClick={copy}>{copied ? "Copied!" : "Copy token"}</Button>
          <Button onClick={onClose}>I saved it</Button>
        </div>
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(2,5,20,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
};

export default PairingTokenModal;
