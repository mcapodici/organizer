import type { ReactNode } from 'react';
import styles from './AppBanner.module.css';

interface Props {
  onLogoClick: () => void;
  rightSlot?: ReactNode;
}

export function AppBanner({ onLogoClick, rightSlot }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <button type="button" className={styles.brand} onClick={onLogoClick} aria-label="Home">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className={styles.logo} />
          <span className={styles.brandName}>Organizer</span>
        </button>
        {rightSlot && <div className={styles.right}>{rightSlot}</div>}
      </div>
    </header>
  );
}
