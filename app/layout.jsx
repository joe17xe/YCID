import "./globals.css";

export const metadata = {
  title: "Solid'Pilot — YCID",
  description: "Pilotage du programme CEM Liban-Yvelines",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
