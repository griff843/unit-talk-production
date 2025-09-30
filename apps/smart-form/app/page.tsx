// Force dynamic rendering to avoid prerendering issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Home() {
  return (
    <div>
      <h1>Unit Talk Smart Form</h1>
      <p>Welcome to the Unit Talk Smart Form application.</p>
      <a href="/submit-ticket">Go to Submit Ticket Form</a>
    </div>
  );
}
