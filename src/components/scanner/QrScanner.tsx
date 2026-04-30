import jsQR from "jsqr";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useRef, useState } from "react";

interface Props {
  onResult: (text: string) => void;
  onClose?: () => void;
  height?: number;
}

const QrScanner = ({ onResult, onClose, height = 360 }: Props) => {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        tick();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("qr.deniedPrefix"));
      }
    };

    const tick = () => {
      if (stoppedRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w > 0 && h > 0) {
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (code && code.data) {
              stoppedRef.current = true;
              onResult(code.data);
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    void start();

    return () => {
      active = false;
      stoppedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onResult]);

  return (
    <div style={wrap}>
      {error && <div className="error" style={{ padding: 16 }}>{error}</div>}
      <video ref={videoRef} style={{ width: "100%", height, objectFit: "cover", background: "#000", borderRadius: 12 }} muted playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {!ready && !error && t("qr.requesting")}
        {ready && t("qr.aim")}
      </div>
      {onClose && (
        <button className="btn secondary" onClick={onClose} style={{ marginTop: 8 }}>{t("qr.stopScan")}</button>
      )}
    </div>
  );
};

const wrap: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
};

export default QrScanner;
