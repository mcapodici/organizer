export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Extract plain text from a TipTap JSON document string. Returns the raw
 * input unchanged if it can't be parsed as JSON.
 */
export function extractText(content: string): string {
  try {
    const doc = JSON.parse(content);
    const parts: string[] = [];
    function walk(node: { type?: string; text?: string; content?: typeof node[] }) {
      if (node.type === 'text' && node.text) parts.push(node.text);
      if (node.content) node.content.forEach(walk);
    }
    walk(doc);
    return parts.join(' ');
  } catch {
    return content;
  }
}
