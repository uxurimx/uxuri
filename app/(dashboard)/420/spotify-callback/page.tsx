"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeSpotifyCode } from "@/lib/spotify-pkce";

export default function SpotifyCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      router.replace("/420");
      return;
    }

    exchangeSpotifyCode(code).then((ok) => {
      // Go back — if we came from an active session the history stack has it
      if (ok) router.back();
      else router.replace("/420");
    });
  }, [searchParams, router]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center flex-col gap-3"
      style={{ background: "#050a07" }}
    >
      <span className="text-3xl animate-pulse">🎵</span>
      <p className="text-sm font-mono" style={{ color: "#00c896" }}>
        Conectando Spotify...
      </p>
    </div>
  );
}
