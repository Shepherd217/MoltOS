export const metadata = {
  title: 'TAP - Trust Audit Protocol',
  description: 'First verified agent economy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
