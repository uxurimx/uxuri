// Spotify PKCE OAuth — client-side only, no secret needed.
// Setup: create an app at https://developer.spotify.com/dashboard
// Add redirect URI: <your-origin>/420/spotify-callback
// Set NEXT_PUBLIC_SPOTIFY_CLIENT_ID in .env.local

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";

function getRedirectUri() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/420/spotify-callback`;
}

function randomString(len: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((x) => chars[x % chars.length])
    .join("");
}

async function codeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function startSpotifyAuth() {
  if (!CLIENT_ID) {
    alert("Falta NEXT_PUBLIC_SPOTIFY_CLIENT_ID en .env.local");
    return;
  }
  const verifier = randomString(64);
  const challenge = await codeChallenge(verifier);
  localStorage.setItem("verde-spotify-verifier", verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: "user-read-currently-playing user-read-playback-state",
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeSpotifyCode(code: string): Promise<boolean> {
  const verifier = localStorage.getItem("verde-spotify-verifier");
  if (!verifier || !CLIENT_ID) return false;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  localStorage.setItem("verde-spotify-token", data.access_token);
  localStorage.setItem("verde-spotify-expiry", String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) localStorage.setItem("verde-spotify-refresh", data.refresh_token);
  localStorage.removeItem("verde-spotify-verifier");
  return true;
}

export function getSpotifyToken(): string | null {
  const token = localStorage.getItem("verde-spotify-token");
  const expiry = Number(localStorage.getItem("verde-spotify-expiry") ?? 0);
  if (!token || Date.now() > expiry - 30_000) return null;
  return token;
}

export function hasSpotifyConfig(): boolean {
  return !!CLIENT_ID;
}

export async function getSpotifyCurrentTrack(): Promise<string | null> {
  const token = getSpotifyToken();
  if (!token) return null;
  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(4000),
  });
  if (res.status === 204 || !res.ok) return null;
  const data = await res.json();
  if (!data?.is_playing || !data?.item) return null;
  const name: string = data.item.name;
  const artist: string = data.item.artists?.[0]?.name ?? "";
  return artist ? `${name} — ${artist}` : name;
}
