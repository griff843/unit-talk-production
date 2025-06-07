"use client";

export function NotFoundContent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl mb-8">Page not found</p>
      <a href="/" className="text-blue-500 hover:text-blue-600">
        Return to home
      </a>
    </div>
  );
} 