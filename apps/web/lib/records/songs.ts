/**
 * The crate: eight songs, in this order.
 *
 * Each record is painted from the birthday mixed with the song's Spotify
 * track ID, so to add or swap a song, change a line here: the ID is the part
 * after /track/ in the song's share link.
 */
export type Song = { id: string; title: string; artist: string; length: string };

export const SONGS: Song[] = [
  { id: "113xf7t4qNM7038YJvauik", title: "Nervous", artist: "The Neighbourhood", length: "4:05" },
  { id: "2UhbCSrBaDe2QgDEuha9od", title: "Flaming Hot Cheetos", artist: "Clairo", length: "2:03" },
  { id: "6U9OkV9oa8kN8LyBGf3wvJ", title: "BLACKJACK", artist: "Aminé", length: "1:57" },
  { id: "514joG57v4yKTsfQmz7stz", title: "Janice STFU", artist: "Drake", length: "3:57" },
  { id: "06KyNuuMOX1ROXRhj787tj", title: "We Don't Talk Anymore", artist: "Charlie Puth, Selena Gomez", length: "3:37" },
  { id: "0JXXNGljqupsJaZsgSbMZV", title: "Sure Thing", artist: "Miguel", length: "3:15" },
  { id: "29iva9idM6rFCPUlu7Rhxl", title: "YUKON", artist: "Justin Bieber", length: "2:43" },
  { id: "18uwL0vNUanqZH0ro2QcOP", title: "comethru", artist: "Jeremy Zucker", length: "3:01" },
];

/** The site owner's birthday, as month-day only. */
export const MY_BIRTHDAY = "11-28";
