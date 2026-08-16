import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '../../context/StorageContext';
import { formatTimestamp } from '../../utils/dateFormat';
import { extractText } from '../../utils/text';
import type { Timeline, Entry } from '../../types';
import styles from './SearchBox.module.css';

interface SearchResult {
  entry: Entry;
  timeline: Timeline;
  snippet: string;
  score: number;
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = 'search-results-listbox';

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
    // Reset the keyboard highlight whenever the result set changes.
    setActiveIndex(-1);
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
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeIndex >= 0 ? results[activeIndex] : results[0];
      if (target) handleSelect(target);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
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
        onKeyDown={handleKeyDown}
        aria-label="Search entries"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && results[activeIndex]
            ? `search-result-${results[activeIndex].entry.id}`
            : undefined
        }
      />
      {open && results.length > 0 && (
        <div className={styles.dropdown} role="listbox" id={listboxId} aria-label="Search results">
          {results.map((r, i) => (
            <button
              key={r.entry.id}
              id={`search-result-${r.entry.id}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`${styles.result} ${i === activeIndex ? styles.active : ''}`}
              onMouseDown={() => handleSelect(r)}
              onMouseEnter={() => setActiveIndex(i)}
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
