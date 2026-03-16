import './globals.css'

export const metadata = {
  title: 'Cellar',
  description: 'Wine portfolio management',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
