import { useState, useRef, useEffect } from 'react';
import styles from './TagInput.module.css';

interface Props {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, allTags, onChange, placeholder = 'Add tag…' }: Props) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const suggestions = allTags.filter(
    (t) => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t)
  );

  function addTag(tag: string, refocus = true) {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
    setActiveIndex(-1);
    // Keep the cursor in the input so the next tag can be typed right away.
    // Skipped when committing on blur so we don't steal focus back (e.g. from Save).
    if (refocus) inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setShowSuggestions(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setShowSuggestions(true);
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' || e.key === ',') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        addTag(suggestions[activeIndex]);
      } else if (input.trim()) {
        e.preventDefault();
        addTag(input);
      }
    } else if (e.key === 'Escape' && showSuggestions) {
      setShowSuggestions(false);
      setActiveIndex(-1);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.field} onClick={() => inputRef.current?.focus()}>
        {tags.map((tag) => (
          <span key={tag} className={styles.chip}>
            {tag}
            <button
              className={styles.chipRemove}
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          placeholder={tags.length === 0 ? placeholder : ''}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Commit whatever was typed but not confirmed, so it isn't lost on save.
            if (input.trim()) addTag(input, false);
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          className={styles.input}
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {suggestions.map((s, i) => (
            <li
              key={s}
              className={`${styles.suggestion} ${i === activeIndex ? styles.suggestionActive : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={() => addTag(s)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
