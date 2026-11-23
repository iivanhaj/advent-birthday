import type { BoothSky } from "@/lib/booth/strip";
import type { Note } from "@/lib/booth/guestbook";

/**
 * The room with the booth in it, drawn in the site's fine rose line with only
 * faint colour: a pale wash of the real sky in the window, a blush curtain,
 * gold bulbs, sage leaves and a little lamplight. Everything that moves is a
 * CSS animation, so the room costs nothing to keep on screen.
 */

const INK = "#9E3B4C";
const C = { blush: "#F3D9D6", butter: "#FBE3B0", gold: "#F2C45A", sage: "#8DBF6A", blue: "#7FA9D1", rose: "#E58FA8", lav: "#9E8BD6" };
const SKY_WASH: Record<BoothSky, [string, number]> = { day: [C.blue, 0.22], golden: [C.rose, 0.22], night: [C.lav, 0.28], rain: ["#9AA7B8", 0.25] };
const ARCH = "M60 380 V180 Q60 100 140 100 Q220 100 220 180 V380 Z";
const LEAVES: [number, number, number][] = [
  [232, 400, -0.6],
  [318, 396, 0.6],
  [280, 380, 0],
  [252, 428, -0.9],
  [300, 424, 0.8],
];
const serif = { fontFamily: "var(--font-playfair), Georgia, serif" };

function WindowSky({ sky }: { sky: BoothSky }) {
  if (sky === "day")
    return (
      <g>
        <circle cx="176" cy="160" r="16" fill={C.butter} fillOpacity=".6" />
        <g className="booth-spin" style={{ transformOrigin: "176px 160px" }} strokeWidth="1">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <path key={i} d={`M${176 + Math.cos(a) * 22} ${160 + Math.sin(a) * 22} L${176 + Math.cos(a) * 28} ${160 + Math.sin(a) * 28}`} />;
          })}
        </g>
        <path className="booth-cloud" d="M86 220 q8 -12 20 -6 q6 -10 18 -2 q12 0 10 10 h-48z" strokeWidth="1" />
      </g>
    );
  if (sky === "golden")
    return (
      <g>
        <path d="M150 330 a26 26 0 0 1 52 0" fill={C.butter} fillOpacity=".7" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${82 + i * 8} ${350 + i * 8} H${200 - i * 8}`} strokeWidth="1" opacity=".5" />
        ))}
      </g>
    );
  if (sky === "night")
    return (
      <g>
        <path d="M184 146 a18 18 0 1 0 12 28 a14 14 0 1 1 -12 -28z" fill={C.butter} fillOpacity=".6" />
        {Array.from({ length: 14 }, (_, i) => {
          const x = 78 + ((i * 53) % 126);
          const y = 126 + ((i * 41) % 230);
          return <path key={i} className="booth-twinkle" style={{ animationDelay: `${-(i * 0.37) % 3}s` }} d={`M${x - 3} ${y} H${x + 3} M${x} ${y - 3} V${y + 3}`} strokeWidth="1" />;
        })}
      </g>
    );
  return (
    <g clipPath="url(#booth-arch)">
      {/* each streak is one long dashed line; sliding the dashes along it is rain that never runs out */}
      <g strokeWidth="1" opacity=".6">
        {Array.from({ length: 15 }, (_, i) => {
          const x = 70 + i * 11;
          return <path key={i} className="booth-rain" style={{ animationDelay: `${-((i * 0.29) % 0.6)}s` }} d={`M${x + 30} 90 L${x - 30} 390`} strokeDasharray="11 49" />;
        })}
      </g>
    </g>
  );
}

export function BoothRoom({ sky, notes, onEnter, compact }: { sky: BoothSky; notes: Note[]; onEnter: () => void; compact: boolean }) {
  const [wash, op] = SKY_WASH[sky];
  // on a phone, frame the booth and the guestbook; the window and plant fall outside
  const viewBox = compact ? "268 28 628 534" : "0 0 960 640";
  return (
    <svg viewBox={viewBox} className="block h-auto w-full" role="img" aria-label={`A photo booth drawn in ink, in a room whose window shows Bangalore's sky (${sky}). Step behind the curtain to take four photos.`} strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="booth-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={wash} stopOpacity={op} />
          <stop offset="1" stopColor={sky === "golden" ? C.butter : wash} stopOpacity={sky === "golden" ? 0.35 : 0} />
        </linearGradient>
        <radialGradient id="booth-lamp">
          <stop offset="0" stopColor={C.butter} stopOpacity=".5" />
          <stop offset="1" stopColor={C.butter} stopOpacity="0" />
        </radialGradient>
        <clipPath id="booth-arch">
          <path d={ARCH} />
        </clipPath>
        <clipPath id="booth-feed">
          <rect x="536" y="378" width="42" height="124" />
        </clipPath>
      </defs>

      {/* the only colour: faint washes under the ink */}
      <path d={ARCH} fill="url(#booth-sky)" />
      <path d="M298 178 H452 V512 Q412 504 376 512 Q340 520 304 512 L298 512Z" fill={C.blush} opacity=".55" />
      <circle className="lamp-flicker" cx="786" cy="112" r="48" fill="url(#booth-lamp)" />

      <g fill="none" stroke={INK} strokeWidth="1.5">
        {/* floor */}
        <path d="M0 540 H960" />
        <path d="M0 548 H960" opacity=".3" />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M${30 + i * 70} 548 l-14 92`} opacity=".18" />
        ))}

        {/* window */}
        <WindowSky sky={sky} />
        <path d={ARCH} />
        <path d="M68 380 V182 Q68 108 140 108 Q212 108 212 182 V380" opacity=".45" />
        <path d="M140 108 V380 M68 250 H212" strokeWidth="1" />
        <path d="M48 380 H232 M52 388 H228" />

        {/* plant */}
        <path d="M250 540 l6 -60 h40 l6 60" />
        <g className="flower-sway" style={{ transformBox: "view-box", transformOrigin: "276px 480px" }}>
          <path d="M276 480 C270 440 240 430 232 400 M276 480 C282 430 300 410 318 396 M276 480 C276 440 272 410 280 380" strokeWidth="1.2" />
          {LEAVES.map(([x, y, r]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx="12" ry="5" transform={`rotate(${r * 57} ${x} ${y})`} fill={C.sage} fillOpacity=".3" strokeWidth="1.2" />
          ))}
        </g>

        {/* the booth */}
        <path d="M280 150 H660 V540 H280 Z" strokeWidth="1.8" />
        <path d="M286 156 H654" opacity=".4" />
        <path d="M300 96 H640 V150 H300 Z" strokeWidth="1.8" />
        <path d="M308 104 H632 V142 H308 Z" opacity=".5" />
        <text x="470" y="133" textAnchor="middle" fontSize="27" letterSpacing="9" fill={INK} stroke="none" style={serif}>
          PHOTOBOOTH
        </text>
        <path d="M310 88 H630" opacity=".3" strokeWidth="1" />
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i} className="booth-bulb" style={{ animationDelay: `${-(i % 3) * 0.5}s` }} cx={318 + i * 28} cy="88" r="3" fill={C.gold} strokeWidth="1" />
        ))}

        {/* curtain: click it to step in */}
        <g className="cursor-pointer outline-none" role="button" tabIndex={0} aria-label="Step behind the curtain" onClick={onEnter} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onEnter())}>
          <rect x="298" y="178" width="154" height="352" fill="transparent" stroke="none" />
          <path d="M298 178 H452 V530 H298 Z" />
          <path d="M292 172 H458" strokeWidth="2.2" />
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={304 + i * 24.5} cy="178" r="3" strokeWidth="1" />
          ))}
          <g className="booth-curtain" style={{ transformOrigin: "375px 181px" }}>
            {Array.from({ length: 8 }, (_, i) => {
              const x = 306 + i * 19;
              return <path key={i} d={`M${x} 181 C${x + 6} 280 ${x - 4} 400 ${x + 3} 512`} strokeWidth="1.1" opacity={i % 2 ? 0.55 : 0.9} />;
            })}
            <path d="M304 512 Q340 520 376 512 Q412 504 446 514" strokeWidth="1.2" />
          </g>
        </g>

        {/* the panel: screen, coin slot, where the prints come out */}
        <rect x="482" y="186" width="150" height="104" rx="4" />
        <rect x="490" y="194" width="134" height="88" rx="2" opacity=".5" />
        <text x="557" y="244" textAnchor="middle" fontSize="18" fontStyle="italic" fill={INK} stroke="none" style={serif}>
          enter
        </text>
        <path d="M532 254 H582" strokeWidth="1" opacity=".5" />
        <circle cx="500" cy="324" r="9" />
        <circle cx="500" cy="324" r="3" strokeWidth="1" />
        <text x="520" y="328" fontSize="10" letterSpacing="2" fill={INK} stroke="none" style={serif}>
          FOUR POSES · FREE
        </text>
        <rect x="530" y="370" width="54" height="8" rx="2" />
        <g clipPath="url(#booth-feed)">
          <g className="booth-feed">
            <rect x="540" y="378" width="34" height="120" strokeWidth="1.2" fill="#FBF1EE" />
            {[0, 1, 2, 3].map((j) => (
              <rect key={j} x="545" y={384 + j * 29} width="24" height="22" strokeWidth=".9" opacity=".7" />
            ))}
          </g>
        </g>
        <path d="M482 520 H632" opacity=".5" />
        <text x="557" y="514" textAnchor="middle" fontSize="9" letterSpacing="3" fill={INK} stroke="none" style={serif}>
          PRINTS HERE
        </text>
        <path d="M300 540 V552 M640 540 V552" strokeWidth="2" />

        {/* the guestbook, under a lamp */}
        <rect x="684" y="146" width="204" height="306" rx="3" />
        <rect x="692" y="154" width="188" height="290" opacity=".45" />
        <text x="786" y="180" textAnchor="middle" fontSize="11" letterSpacing="5" fill={INK} stroke="none" style={serif}>
          GUESTBOOK
        </text>
        <path d="M786 28 V84 M766 84 H806 L796 104 H776 Z" />
      </g>

      <foreignObject x="698" y="190" width="176" height="246">
        <div className="h-full overflow-hidden text-line">
          {notes.length === 0 && <p className="pt-2 text-center font-serif text-[12px] italic opacity-60">No notes yet. Be the first to sign.</p>}
          {notes.slice(0, 6).map((n) => (
            <div key={n.id} className="border-b border-dashed border-line/30 py-[5px] font-serif text-[11.5px] leading-snug italic">
              <span className="line-clamp-2">{n.message}</span>
              <span className="mt-0.5 block font-sans text-[8.5px] tracking-[0.18em] uppercase not-italic opacity-60">{n.name}</span>
            </div>
          ))}
        </div>
      </foreignObject>
    </svg>
  );
}
