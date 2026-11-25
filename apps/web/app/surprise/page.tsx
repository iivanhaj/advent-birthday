import type { Metadata } from "next";
import { Surprise } from "@/components/surprise/Surprise";

export const metadata: Metadata = { title: "for Jae", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function SurprisePage() {
  return <Surprise />;
}
