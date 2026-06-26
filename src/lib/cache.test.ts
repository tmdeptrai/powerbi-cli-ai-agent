import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCachedCommand,
  setCachedCommand,
  invalidateCache,
  clearCache,
  CACHE_TTL,
} from "./cache";

describe("Caching System (Read-Only Commands)", () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should cache read-only commands containing 'list', 'show', or 'available'", () => {
    const cmdList = "pbicli workspace list";
    const cmdShow = "pbicli report show --id 123";
    const cmdAvail = "pbicli gateway available";

    setCachedCommand(cmdList, "list-output");
    setCachedCommand(cmdShow, "show-output");
    setCachedCommand(cmdAvail, "avail-output");

    expect(getCachedCommand(cmdList)).toBe("list-output");
    expect(getCachedCommand(cmdShow)).toBe("show-output");
    expect(getCachedCommand(cmdAvail)).toBe("avail-output");
  });

  it("should not cache non-read-only commands", () => {
    const cmdCreate = "pbicli workspace create --name temp";
    setCachedCommand(cmdCreate, "create-output");
    expect(getCachedCommand(cmdCreate)).toBeNull();
  });

  it("should expire cache entries after TTL (60 seconds)", () => {
    const cmd = "pbicli workspace list";
    setCachedCommand(cmd, "test-output");

    // Before TTL
    vi.advanceTimersByTime(CACHE_TTL - 1);
    expect(getCachedCommand(cmd)).toBe("test-output");

    // After TTL
    vi.advanceTimersByTime(2);
    expect(getCachedCommand(cmd)).toBeNull();
  });

  it("should invalidate matching group caches when a mutation command runs", () => {
    // Setup some cached lists
    const listWorkspaces = "pbicli workspace list";
    const listWorkspacesQuery = "pbicli workspace list --query name";
    const listReports = "pbicli report list";

    setCachedCommand(listWorkspaces, "ws-list");
    setCachedCommand(listWorkspacesQuery, "ws-query-list");
    setCachedCommand(listReports, "rep-list");

    // Execute mutation on workspace group
    invalidateCache("pbicli workspace create --name NewWorkspace");

    // Workspace cache should be cleared
    expect(getCachedCommand(listWorkspaces)).toBeNull();
    expect(getCachedCommand(listWorkspacesQuery)).toBeNull();

    // Report cache should remain intact
    expect(getCachedCommand(listReports)).toBe("rep-list");
  });

  it("should not invalidate cache for non-mutation commands", () => {
    const cmd = "pbicli workspace list";
    setCachedCommand(cmd, "ws-list");

    // Running a read-only list/show should not invalidate anything
    invalidateCache("pbicli workspace list");
    expect(getCachedCommand(cmd)).toBe("ws-list");
  });
});
