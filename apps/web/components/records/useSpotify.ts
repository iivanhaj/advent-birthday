"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spotify's official embed, driven through its iFrame API.
 *
 * The API script is loaded once; it calls `onSpotifyIframeApiReady` with a
 * factory that turns a <div> into a player we can control. We load tracks by
 * URI and listen to `playback_update`, which reports position and duration
 * a few times a second: that's what moves the tonearm across the record.
 * Visitors signed in to Spotify hear whole songs; everyone else hears previews.
 */

type Controller = {
  loadUri(uri: string): void;
  play(): void;
  togglePlay(): void;
  addListener(event: "playback_update", cb: (e: { data: { position: number; duration: number; isPaused: boolean } }) => void): void;
  destroy(): void;
};
type IFrameAPI = { createController(el: HTMLElement, opts: { uri: string; width?: string | number; height?: string | number }, cb: (c: Controller) => void): void };

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
    __spotifyApi?: Promise<IFrameAPI>;
  }
}

function loadApi(): Promise<IFrameAPI> {
  if (window.__spotifyApi) return window.__spotifyApi;
  window.__spotifyApi = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    document.body.appendChild(s);
  });
  return window.__spotifyApi;
}

export function useSpotify(firstTrack: string, height = 152) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<Controller | null>(null);
  /** A track picked before the player finished loading: played as soon as it's ready. */
  const pending = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState({ position: 0, duration: 0, paused: true });

  useEffect(() => {
    let cancelled = false;
    loadApi().then((api) => {
      if (cancelled || !host.current) return;
      // The API replaces the element it's given, so hand it a child it can own.
      const el = document.createElement("div");
      host.current.appendChild(el);
      api.createController(el, { uri: `spotify:track:${firstTrack}`, width: "100%", height }, (c) => {
        if (cancelled) return c.destroy();
        ctl.current = c;
        c.addListener("playback_update", (e) => setState({ position: e.data.position, duration: e.data.duration, paused: e.data.isPaused }));
        setReady(true);
        if (pending.current) {
          c.loadUri(`spotify:track:${pending.current}`);
          pending.current = null;
        }
      });
    });
    return () => {
      cancelled = true;
      ctl.current?.destroy();
      ctl.current = null;
    };
    // the first track only seeds the player; later tracks go through play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback((trackId: string) => {
    const c = ctl.current;
    if (!c) {
      pending.current = trackId;
      return;
    }
    c.loadUri(`spotify:track:${trackId}`);
    // Browsers may block starting audio inside the iframe; then the embed's own play button does it.
    setTimeout(() => c.play(), 300);
  }, []);

  return { host, ready, state, play, toggle: () => ctl.current?.togglePlay() };
}
