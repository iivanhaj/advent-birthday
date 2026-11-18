"use client";

import { useEffect, useState } from "react";
import type { PushRow } from "@/lib/pushes";
import { browserClient } from "@/lib/supabase/browser";

/**
 * The list of pushes, kept live. Supabase Realtime sends an INSERT event for
 * every new row in `pushes` (the webhook writes one per GitHub push), and we
 * append it. `fresh` holds the ones that arrived while the page was open, so
 * only those animate in; everything loaded with the page is simply there.
 */
export function useLivePushes(initial: PushRow[]) {
  const [pushes, setPushes] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("pushes-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pushes" }, (payload) => {
        const row = payload.new as PushRow;
        setPushes((prev) => (prev.some((p) => p.delivery_id === row.delivery_id) ? prev : [...prev, row]));
        setFresh((prev) => new Set(prev).add(row.delivery_id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { pushes, fresh };
}
