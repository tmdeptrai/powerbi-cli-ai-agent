import { describe, it, expect, beforeEach } from "vitest";
import { UrlMinifier } from "./urlMinifier";

describe("UrlMinifier", () => {
  let minifier: UrlMinifier;

  beforeEach(() => {
    minifier = new UrlMinifier();
  });

  it("should replace URLs longer than 20 chars with placeholders", () => {
    const rawText = "Check out my report: https://app.powerbi.com/groups/me/reports/0080d057-0d5c-468e-80dd-8706fbe3d7f8 and also https://google.com";
    const minified = minifier.minify(rawText);

    // Long URL should be minified
    expect(minified).toContain("__URL_REF_1__");
    expect(minified).not.toContain("0080d057-0d5c-468e-80dd-8706fbe3d7f8");

    // Short URL should NOT be minified
    expect(minified).toContain("https://google.com");
  });

  it("should restore minified text to its original state", () => {
    const rawText = "Open this: https://app.powerbi.com/groups/me/reports/0080d057-0d5c-468e-80dd-8706fbe3d7f8";
    const minified = minifier.minify(rawText);
    const restored = minifier.restore(minified);

    expect(restored).toBe(rawText);
  });

  it("should correctly restore URLs when streamed in chunks", () => {
    const rawText = "Open this: https://app.powerbi.com/groups/me/reports/0080d057-0d5c-468e-80dd-8706fbe3d7f8 - Thanks!";
    const minified = minifier.minify(rawText);

    // Let's split "Open this: __URL_REF_1__ - Thanks!" into chunks
    // "Open this: __"
    // "URL_REF_"
    // "1__ - Th"
    // "anks!"
    const chunk1 = minified.substring(0, minified.indexOf("__") + 2);
    const remaining = minified.substring(minified.indexOf("__") + 2);

    const chunk2 = remaining.substring(0, 8); // "URL_REF_"
    const remaining2 = remaining.substring(8);

    const chunk3 = remaining2.substring(0, 7); // "1__ - Th"
    const chunk4 = remaining2.substring(7); // "anks!"

    let restored = "";
    restored += minifier.restoreStreamChunk(chunk1);
    restored += minifier.restoreStreamChunk(chunk2);
    restored += minifier.restoreStreamChunk(chunk3);
    restored += minifier.restoreStreamChunk(chunk4);
    restored += minifier.flush();

    expect(restored).toBe(rawText);
  });

  it("should minify all URLs in the user's JSON payload", () => {
    const rawJson = `[
 {
  "id": "0080d057-0d5c-468e-80dd-8706fbe3d78f",
  "reportType": "PowerBIReport",
  "format": "PBIR",
  "name": "DirectLake-BU-FSU-report",
  "webUrl": "https://app.powerbi.com/groups/me/reports/0080d057-0d5c-468e-80dd-8706fbe3d78f",
  "embedUrl": "https://app.powerbi.com/reportEmbed?reportId=0080d057-0d5c-468e-80dd-8706fbe3d78f&appId=5971f4f5-e0c2-40fe-9240-2703a1b8087d&config=eyJjbHVzdGVyVXJsIjoiaHR0cHM6Ly9XQUJJLVNPVVRILUVBU1QtQVNJQS1yZWRpcmVjdC5hbmFseXNpcy53aW5kb3dzLm5ldCIsImVtYmVkRmVhdHVyZXMiOnsidXNhZ2VNZXRyaWNzVk5leHQiOnRydWV9fQ%3d%3d",
  "isOwnedByMe": true
 }
]`;
    const minified = minifier.minify(rawJson);
    expect(minified).toContain("__URL_REF_1__");
    expect(minified).toContain("__URL_REF_2__");
    expect(minified).not.toContain("https://app.powerbi.com");
  });
});
