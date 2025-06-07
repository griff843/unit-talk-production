'use client'

export default function Error({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold text-red-600 mb-4">⚠️ Something went wrong!</h1>
      <p className="mb-4">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        🔄 Try Again
      </button>
    </div>
  )
}
