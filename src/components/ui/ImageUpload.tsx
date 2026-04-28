import SmartImage from "@/components/ui/SmartImage";
import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  /** Optional URL to an existing image (e.g. server-stored). */
  initialUrl?: string | null;
  /** Used to render a first-letter placeholder if no image is set. */
  name?: string;
  required?: boolean;
  onChange: (file: File | null) => void;
}

/**
 * Image picker with live preview and styled custom button.
 * Shows the existing image (if `initialUrl` set) until the user picks a new
 * file, then a local blob preview. If neither is present, falls back to a
 * first-letter placeholder via SmartImage.
 */
const ImageUpload = ({ label, initialUrl, name, required, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setBlobUrl(null); return; }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = blobUrl ?? initialUrl ?? null;

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    onChange(f);
  };

  const clear = () => {
    setFile(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const open = () => inputRef.current?.click();

  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="label">{label}{required ? " *" : ""}</span>
      <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
        <div onClick={open} style={{ cursor: "pointer", position: "relative" }}>
          <SmartImage src={previewUrl} name={name ?? label} size={110} shape="square" />
          {!previewUrl && (
            <div style={{
              position: "absolute", inset: 0,
              border: "1.5px dashed #1f2a44", borderRadius: 10,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              color: "#94a3b8", fontSize: 11, gap: 2,
              background: "rgba(11,18,36,0.6)",
              transition: "border-color 160ms",
              pointerEvents: "none",
            }}>
              <span style={{ fontSize: 22, color: "#07ddf1" }}>＋</span>
              <span>Click to upload</span>
            </div>
          )}
        </div>
        <div className="col" style={{ flex: 1, gap: 8 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPick}
            style={{ position: "absolute", left: -9999, opacity: 0, pointerEvents: "none" }}
          />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn secondary" onClick={open} style={{ padding: "8px 14px" }}>
              {previewUrl ? "Change image" : "Choose image"}
            </button>
            {file && (
              <button type="button" className="btn secondary" onClick={clear} style={{ padding: "8px 14px", color: "#ef4444", borderColor: "#4a1a1a" }}>
                Clear
              </button>
            )}
          </div>
          {file && (
            <span className="muted" style={{ fontSize: 11 }}>
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
          <span className="muted" style={{ fontSize: 11 }}>PNG / JPG / WebP, ≤ 5 MB</span>
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;
