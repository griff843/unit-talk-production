export default function MinimalPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Minimal Test Page</h1>
      <p>This is a minimal page with no external dependencies.</p>
      <p>If you can see this, basic Next.js routing is working.</p>
      <p>Current time: {new Date().toISOString()}</p>
    </div>
  );
}
