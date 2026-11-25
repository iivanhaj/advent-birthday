import { ImageResponse } from "next/og";
import { windowArt } from "@/components/card/art";
import { makeCard } from "@/lib/card/card";

/**
 * The card as a picture, for link previews (format=og, 1200 × 630) and for
 * saving (format=card, 600 × 840). Drawn by Satori from the same window art
 * the page uses, so a shared link previews the very card that was made.
 */

const INK = "#9e3b4c";
const svgSrc = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const card = makeCard({ name: q.get("name") ?? "", birthday: q.get("b") ?? "", type: q.get("t") ?? "" }, new Date());
  if (!card) return new Response("Not a card.", { status: 400 });
  const portrait = q.get("format") === "card";
  const [w, h] = portrait ? [600, 840] : [1200, 630];

  const face = (scale: number) => (
    <div style={{ display: "flex", padding: 10 * scale, borderRadius: 22 * scale, background: "linear-gradient(135deg, #e6d29e, #b98f45 30%, #f6e7bd 55%, #b38841 80%, #ead39a)" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 500 * scale, height: 700 * scale, borderRadius: 14 * scale, background: "#fdf7f3", border: `${2 * scale}px solid ${INK}`, color: INK, padding: 18 * scale }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 44 * scale, fontStyle: "italic", color: "#7c2a3a" }}>{card.name}</span>
            <span style={{ fontSize: 13 * scale, letterSpacing: 3 * scale, marginTop: 4 * scale }}>{`${card.sign.name} · ${card.flower.name}`.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 30 * scale }}>{card.hp.toLocaleString("en-IN")}</span>
            <span style={{ fontSize: 10 * scale, letterSpacing: 3 * scale }}>DAYS · HP</span>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgSrc(windowArt(card))} width={464 * scale} height={272 * scale} style={{ marginTop: 14 * scale, border: `${2 * scale}px solid ${INK}`, borderRadius: 6 * scale }} alt="" />
        {[
          ["TALENT", card.talent.name, String(card.talent.power), card.talent.text],
          ["BURST", card.burst.name, "100+", card.burst.text],
        ].map(([k, n, p, t]) => (
          <div key={k} style={{ display: "flex", flexDirection: "column", marginTop: 10 * scale, padding: `${8 * scale}px ${12 * scale}px`, border: `${1.5 * scale}px solid ${INK}`, borderRadius: 6 * scale, background: "#fffaf6" }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 11 * scale, letterSpacing: 3 * scale, width: 80 * scale }}>{k}</span>
              <span style={{ fontSize: 21 * scale, flex: 1, color: "#7c2a3a" }}>{n}</span>
              <span style={{ fontSize: 20 * scale }}>{p}</span>
            </div>
            <span style={{ fontSize: 13 * scale, marginTop: 3 * scale, color: "#8a4452" }}>{t}</span>
          </div>
        ))}
        <div style={{ display: "flex", marginTop: 12 * scale, borderTop: `${1.5 * scale}px solid ${INK}`, borderBottom: `${1.5 * scale}px solid ${INK}` }}>
          {[
            ["WEAKNESS", card.weakness],
            ["RESISTS", card.resists],
            ["RECHARGE", card.recharge],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${6 * scale}px ${10 * scale}px`, borderLeft: i ? `${1.5 * scale}px solid ${INK}` : "none" }}>
              <span style={{ fontSize: 10 * scale, letterSpacing: 3 * scale }}>{k}</span>
              <span style={{ fontSize: 15 * scale, color: "#7c2a3a" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", fontSize: 12 * scale, letterSpacing: 2 * scale }}>
          <span>{card.type}</span>
          <span style={{ fontSize: 26 * scale, color: "#6b1d2c", letterSpacing: 0 }}>{card.name}</span>
          <span>No. 1 / 1</span>
        </div>
      </div>
    </div>
  );

  const body = portrait ? (
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#fbf1ee" }}>{face(1.08)}</div>
  ) : (
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", background: "#fbf1ee", padding: 40, gap: 60 }}>
      <div style={{ display: "flex", position: "absolute", left: 16, top: 16, right: 16, bottom: 16, border: `2px solid ${INK}`, borderRadius: 12 }} />
      <div style={{ display: "flex", marginLeft: 60 }}>{face(0.72)}</div>
      <div style={{ display: "flex", flexDirection: "column", color: INK, maxWidth: 560 }}>
        <span style={{ fontSize: 22, letterSpacing: 6 }}>THE BIRTHDAY PRESS</span>
        <span style={{ fontSize: 76, color: "#7c2a3a", marginTop: 10, lineHeight: 1.05 }}>{card.name}</span>
        <span style={{ fontSize: 30, marginTop: 14 }}>{`${card.sign.name}, ${card.flower.name}, ${card.hp.toLocaleString("en-IN")} days`}</span>
        <span style={{ fontSize: 24, marginTop: 34, opacity: 0.85 }}>Graded mint 10. Make yours on door 8 →</span>
      </div>
    </div>
  );

  const res = new ImageResponse(body, { width: w, height: h });
  if (q.has("download")) res.headers.set("Content-Disposition", `attachment; filename="birthday-card-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png"`);
  return res;
}
