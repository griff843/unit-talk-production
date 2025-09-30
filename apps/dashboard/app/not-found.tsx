import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4">404</h2>
        <h3 className="text-2xl font-semibold mb-4">Page Not Found</h3>
        <p className="text-muted-foreground mb-6">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 inline-block"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}