import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';

// Resizable sidebar controller (desktop only). The mobile drawer is full-width
// and ignores the width — App only applies an explicit width when `isDesktop`.
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 600;

function clampWidth(w: number) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));
}

export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('sidebarWidth'));
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : 280;
  });
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 769px)').matches);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  function startResize(e: ReactMouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const left = bodyRef.current?.getBoundingClientRect().left ?? 0;
      setSidebarWidth(clampWidth(ev.clientX - left));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Keyboard nudge for the resizer separator (arrow keys).
  function nudgeWidth(delta: number) {
    setSidebarWidth((w) => clampWidth(w + delta));
  }

  return { sidebarWidth, isDesktop, bodyRef, startResize, nudgeWidth };
}
