"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
      <p className="text-xl mb-8">
        {error.message || "An unexpected error occurred"}
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="text-blue-500 hover:text-blue-600"
        >
          Try again
        </button>
        <Link href="/" className="text-blue-500 hover:text-blue-600">
          Return to home
        </Link>
      </div>
    </div>
  );
} 