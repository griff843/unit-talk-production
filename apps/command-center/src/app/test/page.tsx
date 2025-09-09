export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Command Center Test Page</h1>
      <p>If you can see this, the basic Next.js routing is working.</p>
      <div className="mt-4">
        <p>Environment variables:</p>
        <ul className="list-disc list-inside">
          <li>Supabase URL: {process.env['NEXT_PUBLIC_SUPABASE_URL'] ? '✅ Set' : '❌ Missing'}</li>
          <li>
            Supabase Key: {process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ? '✅ Set' : '❌ Missing'}
          </li>
        </ul>
      </div>
    </div>
  );
}
