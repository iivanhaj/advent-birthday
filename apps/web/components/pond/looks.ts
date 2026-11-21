import type { SkyPhase } from "@/lib/sky";
import type { WaterLook } from "./water";

/**
 * The pond's three looks. By default the pond follows Bangalore's real sky,
 * like the building: the sunlit garden by day, ink and watercolour at dawn
 * and dusk, the lantern pond at night.
 */
export type LookId = "garden" | "ink" | "lantern";

export type PondLook = {
  id: LookId;
  label: string;
  floor: [string, string]; // pond-floor gradient (centre → edge)
  pebbles: string;
  pad: string;
  padInk: string | null;
  koiBase: string;
  koiInk: string | null; // outline colour, or none
  glow: boolean; // koi glow at night
  shadow: string;
  water: WaterLook;
};

export const LOOKS: Record<LookId, PondLook> = {
  garden: {
    id: "garden",
    label: "Sunlit garden",
    floor: ["#3f7f69", "#204b3c"],
    pebbles: "rgba(225,240,220,0.10)",
    pad: "#5E9C5A",
    padInk: null,
    koiBase: "#F6F1E8",
    koiInk: null,
    glow: false,
    shadow: "rgba(0,25,18,0.28)",
    water: { tint: [0.92, 1, 0.94], caustic: 0.42, refraction: 0.02, spec: [1, 1, 0.92], specStrength: 0.35, water: [0.1, 0.3, 0.25, 0.12] },
  },
  ink: {
    id: "ink",
    label: "Ink and watercolour",
    floor: ["#FBF1EE", "#F2DCD6"],
    pebbles: "rgba(158,59,76,0.10)",
    pad: "rgba(169,201,164,0.75)",
    padInk: "#9E3B4C",
    koiBase: "#FBF1EE",
    koiInk: "#9E3B4C",
    glow: false,
    shadow: "rgba(158,59,76,0.10)",
    water: { tint: [1, 1, 1], caustic: 0.08, refraction: 0.016, spec: [1, 0.93, 0.95], specStrength: 0.2, water: [0.62, 0.23, 0.3, 0.03] },
  },
  lantern: {
    id: "lantern",
    label: "Night lanterns",
    floor: ["#231d4a", "#0d0b20"],
    pebbles: "rgba(255,246,224,0.06)",
    pad: "#2f5a4a",
    padInk: null,
    koiBase: "#FFE6BF",
    koiInk: null,
    glow: true,
    shadow: "rgba(0,0,0,0.35)",
    water: { tint: [0.95, 0.95, 1.15], caustic: 0.22, refraction: 0.02, spec: [1, 0.92, 0.75], specStrength: 0.3, water: [0.05, 0.05, 0.15, 0.18] },
  },
};

export const lookForSky = (phase: SkyPhase): LookId => (phase === "day" ? "garden" : phase === "night" ? "lantern" : "ink");
