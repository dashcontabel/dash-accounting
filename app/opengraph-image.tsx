import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dash Contábil — Plataforma de gestão contábil corporativa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a3560 0%, #0f4c81 60%, #1a6eb5 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
          }}
        >
          {/* Icon */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "12px",
              paddingBottom: "12px",
              borderBottom: "3px solid rgba(255,255,255,0.25)",
            }}
          >
            {/* Bar chart icon */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <div style={{ width: 28, height: 52, background: "rgba(255,255,255,0.55)", borderRadius: 6 }} />
              <div style={{ width: 28, height: 84, background: "white", borderRadius: 6 }} />
              <div style={{ width: 28, height: 112, background: "rgba(255,255,255,0.8)", borderRadius: 6 }} />
            </div>
          </div>

          {/* Logotype */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "0px" }}>
            <span style={{ fontSize: 88, fontWeight: 800, color: "white", letterSpacing: "-2px" }}>
              Dash
            </span>
            <span style={{ fontSize: 88, fontWeight: 300, color: "rgba(255,255,255,0.85)", letterSpacing: "-2px" }}>
              Contábil
            </span>
          </div>

          {/* Tagline */}
          <p
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.65)",
              fontWeight: 400,
              margin: 0,
              letterSpacing: "0.5px",
            }}
          >
            Plataforma de gestão contábil corporativa
          </p>
        </div>
      </div>
    ),
    size,
  );
}
