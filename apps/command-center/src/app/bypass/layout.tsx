// Bypass layout with no CSS imports
export default function BypassLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Bypass Test</title>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Arial, sans-serif' }}>{children}</body>
    </html>
  );
}
