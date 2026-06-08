import styles from './TagFilter.module.css';

interface Props {
  allTags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ allTags, selected, onChange }: Props) {
  if (allTags.length === 0) return null;

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Filter by tags</span>
      {allTags.map((tag) => (
        <button
          key={tag}
          className={`${styles.tag} ${selected.includes(tag) ? styles.active : ''}`}
          onClick={() => toggle(tag)}
        >
          {tag}
        </button>
      ))}
      {selected.length > 0 && (
        <button className={styles.clear} onClick={() => onChange([])}>
          Clear
        </button>
      )}
    </div>
  );
}
