import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '../../context/StorageContext';
import { formatTimestamp } from '../../utils/dateFormat';
import type { Timeline, Entry } from '../../types';
import styles from './SearchBox.module.css';

interface SearchResult {
  entry: Entry;
  timeline: Timeline;
  snippet: string;
  score: number;
}

function extractText(content: string): string {
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

function scoreEntry(plainText: string, attachmentNames: string[], timelineName: string, queryWords: string[]): number {
  if (!queryWords.length) return 0;
  const combined = (plainText + ' ' + attachmentNames.join(' ') + ' ' + timelineName).toLowerCase();
  let matched = 0;
  for (const word of queryWords) {
    if (combined.includes(word)) matched++;
  }
  return matched / queryWords.length;
}

function getSnippet(text: string, queryWords: string[], maxLen = 140): string {
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const word of queryWords) {
    const idx = lower.indexOf(word);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx === -1) {
    return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
  }
  const start = Math.max(0, bestIdx - 30);
  const end = Math.min(text.length, start + maxLen);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function highlightSnippet(snippet: string, queryWords: string[]) {
  if (!queryWords.length) return snippet;
  const escaped = queryWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = snippet.split(pattern);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} className={styles.highlight}>{part}</mark>
      : <span key={i}>{part}</span>
  );
}

export function SearchBox({ timelines, fluid = false }: { timelines: Timeline[]; fluid?: boolean }) {
  const { adapter } = useStorage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function loadEntries() {
    const all = await adapter.getAllEntries();
    setEntries(all);
  }

  useEffect(() => {
    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!queryWords.length) {
      // Derived search results — clearing these properly means becoming a useMemo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setOpen(false);
      return;
    }
    const timelineMap = new Map(timelines.map(t => [t.id, t]));
    const scored: SearchResult[] = [];
    for (const entry of entries) {
      const timeline = timelineMap.get(entry.timelineId);
      if (!timeline) continue;
      const plainText = extractText(entry.content);
      const attachmentNames = entry.attachments.map(a => a.name);
      const score = scoreEntry(plainText, attachmentNames, timeline.name, queryWords);
      if (score > 0) {
        scored.push({ entry, timeline, snippet: getSnippet(plainText, queryWords), score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    setResults(scored.slice(0, 8));
    setOpen(scored.length > 0);
  }, [query, entries, timelines]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleFocus() {
    loadEntries();
    if (results.length > 0) setOpen(true);
  }

  function handleSelect(result: SearchResult) {
    navigate(`/timelines/${result.timeline.id}`);
    setQuery('');
    setOpen(false);
  }

  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  return (
    <div className={`${styles.wrapper} ${fluid ? styles.fluid : ''}`} ref={wrapperRef}>
      <input
        type="search"
        className={styles.input}
        placeholder="Search…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={handleFocus}
        aria-label="Search entries"
      />
      {open && results.length > 0 && (
        <div className={styles.dropdown}>
          {results.map(r => (
            <button
              key={r.entry.id}
              className={styles.result}
              onMouseDown={() => handleSelect(r)}
              onClick={() => handleSelect(r)}
            >
              <div className={styles.resultMeta}>
                <span className={styles.timelineName}>{r.timeline.name}</span>
                <span className={styles.resultDate}>{formatTimestamp(r.entry.timestamp)}</span>
              </div>
              <div className={styles.snippet}>
                {highlightSnippet(r.snippet || '(no text)', queryWords)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
