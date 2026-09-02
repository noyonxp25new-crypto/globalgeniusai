"use client";
import React from "react";
import { Download } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  onDownload: (url: string) => void;
  onPreview: (url: string) => void;
}

export default function ImageWithShimmer({ src, alt, onDownload, onPreview }: Props) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  return (
    <div className="my-4 group relative inline-block max-w-full">
      <div
        className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#1a1a1a]"
        style={{ minWidth: loaded ? 0 : 288, minHeight: loaded ? 0 : 288 }}
      >
        {/* Shimmer — shown until image loads */}
        {!loaded && !error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: 288,
              height: 288,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Animated background */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #16213e 75%, #1a1a2e 100%)",
                  backgroundSize: "400% 400%",
                  animation: "imgShiftBg 3s ease infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
                  animation: "imgSweep 1.6s ease-in-out infinite",
                }}
              />
            </div>

            {/* Colored blobs */}
            <div style={{ position: "absolute", inset: 0, opacity: 0.3 }}>
              <div
                style={{
                  position: "absolute",
                  top: "20%",
                  left: "15%",
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: "#7c3aed",
                  filter: "blur(40px)",
                  animation: "imgBlob 4s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "20%",
                  right: "15%",
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "#2563eb",
                  filter: "blur(35px)",
                  animation: "imgBlob 4s ease-in-out 1.5s infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "#ec4899",
                  filter: "blur(30px)",
                  animation: "imgBlob 4s ease-in-out 3s infinite",
                }}
              />
            </div>

            {/* Center icon + spinning ring */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ position: "relative", display: "inline-flex" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation: "imgIconPulse 2s ease-in-out infinite",
                  }}
                >
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                  </svg>
                </div>
                <div
                  style={{
                    position: "absolute",
                    inset: -8,
                    borderRadius: 26,
                    border: "2px solid transparent",
                    borderTopColor: "#a855f7",
                    borderRightColor: "#3b82f6",
                    animation: "imgSpin 1.4s linear infinite",
                  }}
                />
              </div>
            </div>

            {/* Label + dots */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                marginTop: 20,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Generating image...
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {(["#a855f7", "#3b82f6", "#ec4899"] as const).map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: c,
                      animation: `imgDot 1s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                background: "rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #a855f7, #3b82f6, #ec4899)",
                  animation: "imgProgress 3s ease-in-out infinite",
                }}
              />
            </div>

            {/* Keyframes */}
            <style>{`
              @keyframes imgShiftBg { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
              @keyframes imgSweep { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
              @keyframes imgBlob { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.15) translate(5px,-5px)} }
              @keyframes imgIconPulse { 0%,100%{opacity:0.8;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
              @keyframes imgSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
              @keyframes imgDot { 0%,100%{transform:translateY(0);opacity:0.6} 50%{transform:translateY(-5px);opacity:1} }
              @keyframes imgProgress { 0%{width:5%} 60%{width:80%} 90%{width:93%} 100%{width:97%} }
            `}</style>
          </div>
        )}

        {/* Real image — fades in on load */}
        <img
          src={src}
          alt={alt || "Generated image"}
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(true); setError(true); }}
          onClick={() => src && onPreview(src)}
          style={{
            maxHeight: 420,
            width: "auto",
            maxWidth: "100%",
            objectFit: "cover",
            borderRadius: 16,
            cursor: "pointer",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />
      </div>

      {/* Download bar — shown after image loads */}
      {loaded && !error && src && (
        <div className="mt-2 flex items-center justify-between px-1 text-xs text-gray-400">
          {alt && (
            <span className="truncate max-w-[280px] italic">"{alt}"</span>
          )}
          <button
            type="button"
            onClick={() => onDownload(src)}
            className="p-1.5 hover:bg-white/10 rounded-lg hover:text-white transition-colors flex items-center gap-1 cursor-pointer ml-auto"
          >
            <Download size={13} />
            <span>Download</span>
          </button>
        </div>
      )}
    </div>
  );
}
