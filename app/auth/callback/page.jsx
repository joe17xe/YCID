"use client";
import { useEffect } from "react";
import { supabase, DEMO } from "../../../lib/supabaseClient";

export default function AuthCallback() {
  useEffect(() => {
    const goHome = () => window.location.replace("/");
    if (DEMO || !supabase) return goHome();

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (code) {
      // PKCE flow: exchange the authorization code for a session.
      supabase.auth.exchangeCodeForSession(window.location.href).finally(goHome);
    } else {
      // Implicit flow: detectSessionInUrl parses the hash tokens on load.
      supabase.auth.getSession().finally(() => setTimeout(goHome, 300));
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#475569",
      }}
    >
      Connexion en cours…
    </div>
  );
}
