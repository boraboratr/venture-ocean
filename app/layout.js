export const metadata = { title: "Venture Ocean", description: "AI Startup Mentor" }

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
