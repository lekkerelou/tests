const port = process.env.PORT ?? "3000";

try {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(2_500),
  });

  if (!response.ok) {
    throw new Error(`Health endpoint returned HTTP ${response.status}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Health check failed");
  process.exit(1);
}
