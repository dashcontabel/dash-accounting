import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dash Contábil — Plataforma de gestão contábil corporativa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "36px",
          }}
        >
          {/* B&S icon */}
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${baseUrl}/logo-barros-e-sa-icon.png`}
              width={140}
              height={140}
              alt=""
              style={{ borderRadius: "50%" }}
            />
            {/* Divider */}
            <div style={{ width: 2, height: 100, background: "rgba(255,255,255,0.25)", borderRadius: 2 }} />
            {/* Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 300, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>
                Barros &amp; Sá
              </span>
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
                Assessoria Empresarial e Condominial
              </span>
            </div>
          </div>

          {/* Logotype */}
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 88, fontWeight: 800, color: "white", letterSpacing: "-2px" }}>
              Dash
            </span>
            <span style={{ fontSize: 88, fontWeight: 300, color: "rgba(255,255,255,0.85)", letterSpacing: "-2px" }}>
              Contábil
            </span>
          </div>

          {/* Tagline */}
          <p style={{ fontSize: 26, color: "rgba(255,255,255,0.6)", fontWeight: 400, margin: 0 }}>
            Plataforma de gestão contábil corporativa
          </p>
        </div>
      </div>
    ),
    size,
  );
}
