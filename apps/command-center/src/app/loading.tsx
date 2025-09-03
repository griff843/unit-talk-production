export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Loading Command Center</h2>
          <p className="text-sm text-muted-foreground">Initializing dashboard...</p>
        </div>
      </div>
    </div>
  );
}
