import type { Metadata } from 'next'
import { Sora, Inter } from 'next/font/google'
import './globals.css'

const sora = Sora({ variable: '--font-sora', subsets: ['latin'], weight: ['400','600','700'] })
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Solid'Pilot — YCID",
  description: 'Application de pilotage de projets de solidarite internationale',
}

// Applique les préférences d'apparence avant le premier rendu (pas de flash)
const appearanceInit = `try{var p=JSON.parse(localStorage.getItem('sp-appearance')||'{}');var h=document.documentElement;if(p.textSize)h.setAttribute('data-textsize',p.textSize);if(p.contrast)h.setAttribute('data-contrast','high');if(p.motion)h.setAttribute('data-motion','reduced');}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className={[sora.variable, inter.variable, 'antialiased min-h-full flex flex-col'].join(' ')} style={{ background: '#F5F6F4' }}>
        <script dangerouslySetInnerHTML={{ __html: appearanceInit }} />
        {children}
      </body>
    </html>
  )
}
