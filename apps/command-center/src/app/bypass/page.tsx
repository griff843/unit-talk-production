// Complete bypass page
export default function BypassPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: 'green' }}>🟢 BYPASS SUCCESS</h1>
      <p>This page completely bypasses all CSS, middleware, and complex components.</p>
      <p>Time: {new Date().toISOString()}</p>
      <p>If you see this, Next.js core functionality works.</p>
    </div>
  );
}
