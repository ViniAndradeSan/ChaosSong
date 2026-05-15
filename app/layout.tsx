import type { Metadata, Viewport } from 'next'
import { Inter, Cinzel, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const cinzel = Cinzel({ 
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '700'],
})

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'Chaos Song · Grimório dos Cantores',
  description: 'Sistema de fichas de RPG de mesa em tempo real. Um grimório vivo onde cada ficha é um instrumento arcano.',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a0a1f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${cinzel.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'oklch(0.18 0.05 295 / 0.95)',
              border: '1px solid oklch(0.55 0.15 300 / 0.3)',
              color: 'oklch(0.96 0.02 300)',
              backdropFilter: 'blur(12px)',
            },
          }}
        />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
