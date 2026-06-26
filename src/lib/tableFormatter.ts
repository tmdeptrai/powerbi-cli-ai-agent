export function formatJsonToMarkdownTable(jsonText: string): string {
  try {
    const data = JSON.parse(jsonText.trim());

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "No items found.";
      }

      // Collect all keys across all items to handle heterogeneous objects
      const allKeys = new Set<string>();
      data.forEach((item) => {
        if (item && typeof item === "object") {
          Object.keys(item).forEach((key) => {
            // Exclude huge empty array fields to keep table clean
            if (Array.isArray(item[key]) && item[key].length === 0) {
              return;
            }
            allKeys.add(key);
          });
        }
      });

      const keys = Array.from(allKeys);
      if (keys.length === 0) {
        return "No tabular data available.";
      }

      // Construct Markdown Table Header
      let markdown = "| " + keys.map((k) => formatHeaderLabel(k)).join(" | ") + " |\n";
      markdown += "| " + keys.map(() => "---").join(" | ") + " |\n";

      // Construct Rows
      data.forEach((item) => {
        const row = keys.map((key) => {
          const val = item[key];
          return formatValue(key, val);
        });
        markdown += "| " + row.join(" | ") + " |\n";
      });

      return markdown;
    } else if (data && typeof data === "object") {
      // Single object: format as key-value list / table
      let markdown = "| Property | Value |\n";
      markdown += "| --- | --- |\n";

      Object.entries(data).forEach(([key, val]) => {
        if (Array.isArray(val) && val.length === 0) return; // skip empty arrays
        markdown += `| **${formatHeaderLabel(key)}** | ${formatValue(key, val)} |\n`;
      });

      return markdown;
    }
  } catch {
    // Return original text if not JSON
  }
  return jsonText;
}

function formatHeaderLabel(key: string): string {
  // Convert camelCase or snake_case to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_\-]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatValue(key: string, val: any): string {
  if (val === null || val === undefined) {
    return "-";
  }
  if (typeof val === "boolean") {
    return val ? "Yes" : "No";
  }
  if (typeof val === "object") {
    return JSON.stringify(val);
  }

  const strVal = String(val);

  // If it's a URL, return a clean markdown link
  if (strVal.startsWith("http://") || strVal.startsWith("https://")) {
    if (key.toLowerCase().includes("embed")) {
      return `[Embed](${strVal})`;
    }
    if (key.toLowerCase().includes("web") || key.toLowerCase().includes("url")) {
      return `[Open Link](${strVal})`;
    }
    return `[Link](${strVal})`;
  }

  return strVal;
}
