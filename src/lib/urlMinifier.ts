export class UrlMinifier {
  private urlMap = new Map<string, string>();
  private counter = 0;
  private buffer = "";

  minify(text: string): string {
    if (!text) return text;
    // Match URLs starting with http:// or https:// up to a quote, space, or bracket
    const urlRegex = /https?:\/\/[^\s"'\(\)\[\]<>]+/g;
    return text.replace(urlRegex, (url) => {
      // Ignore short or already minified URLs
      if (url.length < 20 || url.includes("__URL_REF_")) {
        return url;
      }
      this.counter++;
      const placeholder = `__URL_REF_${this.counter}__`;
      this.urlMap.set(placeholder, url);
      return placeholder;
    });
  }

  restore(text: string): string {
    if (!text) return text;
    let restored = text;
    this.urlMap.forEach((url, placeholder) => {
      restored = restored.replaceAll(placeholder, url);
    });
    return restored;
  }

  restoreStreamChunk(chunk: string): string {
    this.buffer += chunk;
    let restored = "";
    let searchIndex = 0;

    while (true) {
      const startIndex = this.buffer.indexOf("__URL_REF_", searchIndex);
      if (startIndex === -1) {
        // No placeholder pattern starts in the buffer.
        // We can safely flush everything up to the last 12 characters, 
        // to prevent splitting a potential "__URL_REF_" prefix that might be starting.
        const safeFlushLength = Math.max(0, this.buffer.length - 12);
        restored += this.buffer.substring(0, safeFlushLength);
        this.buffer = this.buffer.substring(safeFlushLength);
        break;
      }

      const endIndex = this.buffer.indexOf("__", startIndex + 10);
      if (endIndex === -1) {
        // A placeholder pattern started but is not closed.
        // Flush everything before the placeholder start, and keep the placeholder fragment in the buffer.
        restored += this.buffer.substring(0, startIndex);
        this.buffer = this.buffer.substring(startIndex);
        break;
      }

      // Found a complete placeholder!
      const placeholder = this.buffer.substring(startIndex, endIndex + 2);
      const originalUrl = this.urlMap.get(placeholder);

      restored += this.buffer.substring(0, startIndex);
      if (originalUrl) {
        restored += originalUrl;
      } else {
        restored += placeholder; // fallback if map lookup fails
      }

      this.buffer = this.buffer.substring(endIndex + 2);
      searchIndex = 0; // reset index since buffer was modified
    }

    return restored;
  }

  flush(): string {
    const remaining = this.restore(this.buffer);
    this.buffer = "";
    return remaining;
  }
}
