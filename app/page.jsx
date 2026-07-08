"use client";
import dynamic from "next/dynamic";

// Chargement client uniquement : l'app utilise window (exports CSV, etc.)
const SolidPilot = dynamic(() => import("../components/SolidPilot"), { ssr: false });

export default function Page() {
  return <SolidPilot />;
}
