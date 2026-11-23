"use client";

import { useEffect, useState } from "react";
import { checkNote, mergeNotes, type Note } from "@/lib/booth/guestbook";
import { browserClient } from "@/lib/supabase/browser";

type Status = { kind: "sending" | "ok" | "error"; text: string } | null;

/**
 * The guestbook's notes: loaded once, then kept live with Supabase Realtime,
 * so a note signed in one browser appears on the booth wall in every other.
 */
export function useGuestbook() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/guestbook")
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((d: { notes: Note[] }) => alive && setNotes((cur) => mergeNotes(cur, d.notes)))
      .catch(() => {});
    const sb = browserClient();
    const channel = sb
      ?.channel("guest-notes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "guest_notes" }, (p) => {
        const n = p.new as Note & { hidden?: boolean };
        if (!n.hidden) setNotes((cur) => mergeNotes(cur, [{ id: n.id, message: n.message, name: n.name, created_at: n.created_at }]));
      })
      .subscribe();
    return () => {
      alive = false;
      if (channel) sb?.removeChannel(channel);
    };
  }, []);

  /** Sign the book. Returns true when the note was kept. */
  async function sign(message: string, name: string): Promise<boolean> {
    const check = checkNote(message, name);
    if (!check.ok) {
      setStatus({ kind: "error", text: check.reason });
      return false;
    }
    setStatus({ kind: "sending", text: "Signing…" });
    try {
      const res = await fetch("/api/guestbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: check.message, name: check.name }) });
      const body = (await res.json().catch(() => ({}))) as { note?: Note; error?: string };
      if (!res.ok || !body.note) {
        setStatus({ kind: "error", text: body.error ?? "The guestbook couldn't take that just now." });
        return false;
      }
      setNotes((cur) => mergeNotes(cur, [body.note!]));
      setStatus({ kind: "ok", text: "Signed. Thank you." });
      return true;
    } catch {
      setStatus({ kind: "error", text: "The guestbook couldn't be reached." });
      return false;
    }
  }

  return { notes, sign, status, setStatus };
}
