export interface CacheEntry {
  output: string;
  timestamp: number;
}

export const commandCache: Record<string, CacheEntry> = {};
export const CACHE_TTL = 60 * 1000; // 60 seconds

export function getCachedCommand(command: string): string | null {
  const isReadOnly = command.includes("list") || command.includes("show") || command.includes("available") || command.includes("query");
  if (!isReadOnly) return null;

  const entry = commandCache[command];
  if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) {
    console.log(`[Cache Hit] Returning cached output for: "${command}"`);
    return entry.output;
  }
  return null;
}

export function setCachedCommand(command: string, output: string) {
  const isReadOnly = command.includes("list") || command.includes("show") || command.includes("available") || command.includes("query");
  if (!isReadOnly) return;

  commandCache[command] = {
    output,
    timestamp: Date.now(),
  };
  console.log(`[Cache Set] Cached output for: "${command}"`);
}

export function invalidateCache(command: string) {
  const isMutation = command.includes("create") || command.includes("delete") || command.includes("update") || 
                    command.includes("start") || command.includes("stop") || command.includes("clone") || 
                    command.includes("rebind") || command.includes("refresh") || command.includes("assign") ||
                    command.includes("import");
  
  if (!isMutation) return;

  const match = command.match(/pbicli\s+([a-z]+)/);
  if (match) {
    const group = match[1];
    Object.keys(commandCache).forEach((key) => {
      if (key.includes(`pbicli ${group}`)) {
        delete commandCache[key];
        console.log(`[Cache Invalidate] Cleared cache key: "${key}" due to command: "${command}"`);
      }
    });
  }
}

export function clearCache() {
  Object.keys(commandCache).forEach((key) => {
    delete commandCache[key];
  });
}
