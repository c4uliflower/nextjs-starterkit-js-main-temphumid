"use client";

import { useCallback, useEffect, useRef } from "react";

import jsQR from "jsqr";

export function DowntimeQrScanner({ onScan, label, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const doneRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    rafRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || doneRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code?.data) {
        doneRef.current = true;
        stopCamera();
        onScan(code.data);
        return;
      }
    }

    setTimeout(() => requestAnimationFrame(tick), 150);
  }, [onScan, stopCamera]);

  useEffect(() => {
    doneRef.current = false;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", true);
          videoRef.current.play();
          rafRef.current = requestAnimationFrame(tick);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.name === "AbortError" || error.name === "NotReadableError") return;

        onError?.(
          error.name === "NotAllowedError"
            ? "Camera access denied. Please allow camera permissions and try again."
            : `Camera error: ${error.message}`
        );
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [tick, stopCamera, onError]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: 5,
          overflow: "hidden",
          background: "#000",
          aspectRatio: "4/3",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <svg
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <path
            d="M10 25 L10 10 L25 10"
            stroke="#fff"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M75 10 L90 10 L90 25"
            stroke="#fff"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M90 75 L90 90 L75 90"
            stroke="#fff"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M25 90 L10 90 L10 75"
            stroke="#fff"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <line x1="12" y1="50" x2="88" y2="50" stroke="#435ebe" strokeWidth="1.5" opacity="0.7">
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 -30"
              to="0 30"
              dur="1.6s"
              repeatCount="indefinite"
              additive="sum"
            />
          </line>
        </svg>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <p className="text-center text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
