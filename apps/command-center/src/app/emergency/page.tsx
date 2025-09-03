// Emergency fallback page with no external dependencies at all
export default function EmergencyPage() {
  return (
    <html>
      <head>
        <title>Emergency Command Center</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: '20px',
          fontFamily: 'Arial, sans-serif',
          backgroundColor: '#1a1a1a',
          color: '#white',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>🚨 Emergency Command Center</h1>

          <div
            style={{
              backgroundColor: '#2a2a2a',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ color: '#4ecdc4' }}>System Status</h2>
            <p>✅ Next.js Server: Running</p>
            <p>✅ Basic Routing: Operational</p>
            <p>⚠️ Full Command Center: Under Maintenance</p>
          </div>

          <div
            style={{
              backgroundColor: '#2a2a2a',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ color: '#4ecdc4' }}>Quick Actions</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px',
              }}
            >
              <div style={{ backgroundColor: '#3a3a3a', padding: '15px', borderRadius: '4px' }}>
                <h3 style={{ color: '#45b7d1', margin: '0 0 10px 0' }}>Agent Status</h3>
                <p style={{ color: '#888', margin: 0 }}>All agents: Unknown</p>
              </div>

              <div style={{ backgroundColor: '#3a3a3a', padding: '15px', borderRadius: '4px' }}>
                <h3 style={{ color: '#45b7d1', margin: '0 0 10px 0' }}>System Health</h3>
                <p style={{ color: '#888', margin: 0 }}>Status: Checking...</p>
              </div>

              <div style={{ backgroundColor: '#3a3a3a', padding: '15px', borderRadius: '4px' }}>
                <h3 style={{ color: '#45b7d1', margin: '0 0 10px 0' }}>Database</h3>
                <p style={{ color: '#888', margin: 0 }}>Connection: Unknown</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px' }}>
            <h2 style={{ color: '#4ecdc4' }}>Emergency Information</h2>
            <p>If you can see this page, the Next.js server is working at a basic level.</p>
            <p>
              This is a minimal fallback interface while the main Command Center is being repaired.
            </p>
            <p>Timestamp: {new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
    </html>
  );
}
