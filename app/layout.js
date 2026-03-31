import './globals.css'

export const metadata = {
  title: 'Cellar',
  description: 'Wine portfolio management',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Cellar" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#140f0a" />
      </head>
      <body>{children}</body>
    </html>
  )
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
