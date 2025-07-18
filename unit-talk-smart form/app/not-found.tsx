"use client";

export const dynamic = "error";
export const revalidate = 0;

export default function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>Sorry, this page does not exist.</p>
      <a href="/">Return Home</a>
    </div>
  );
}