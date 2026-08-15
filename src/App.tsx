import { useState, useEffect, useRef } from 'react';
import { CheckSquare, Settings as SettingsIcon, Menu, Plus, Filter, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { useTimelines } from './hooks/useTimelines';
import { useEntries } from './hooks/useEntries';
import { useTags } from './hooks/useTags';
import { useTodoCounts } from './hooks/useTodoCounts';
import { useStorage } from './context/StorageContext';
import { useUndo } from './context/UndoContext';
import { TimelineList } from './components/TimelineList/TimelineList';
import { TimelineView } from './components/TimelineView/TimelineView';
import { TodoPage } from './components/TodoPage/TodoPage';
import { Settings } from './components/Settings/Settings';
import { SearchBox } from './components/SearchBox/SearchBox';
import { exportData } from './utils/exportImport';
import { describeTodoChange, revertTodoFields } from './utils/todoUndo';
import { WELCOME_KEY, WELCOME_CONTENT } from './utils/welcome';
import type { Entry } from './types';
import styles from './App.module.css';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
    const { adapter, markSaved } = useStorage();
  const { registerUndo } = useUndo();
  const { timelines, loading, createTimeline, updateTimeline, removeTimeline, reload: reloadTimelines } = useTimelines();

  const isTodoPage = location.pathname === '/todos';
  const isSettingsPage = location.pathname === '/settings';
  const timelineMatch = location.pathname.match(/^\/timelines\/([^/]+)$/);
  const urlId = timelineMatch ? timelineMatch[1] : null;
  const activeTimeline = timelines.find((t) => t.id === urlId) ?? null;

  const { entries, addEntry, updateEntry, removeEntry, reload: reloadEntries } = useEntries(activeTimeline?.id ?? null);
  const allTags = useTags(timelines);
  const { todoCounts, reloadTodoCounts } = useTodoCounts();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [triggerCreate, setTriggerCreate] = useState(false);
  // Filter-panel visibility lives here (not inside TimelineList) so the mobile
  // nav's Filter button can toggle the same panel the sidebar renders.
  const [showFilter, setShowFilter] = useState(false);

  // Resizable sidebar (desktop only). The mobile drawer is full-width and ignores
  // this — we only apply an explicit width when the desktop layout is active.
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 600;
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

  function clampWidth(w: number) {
    return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));
  }

  function startResize(e: React.MouseEvent) {
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

  // Bump the active timeline's "recently changed" stamp after an entry edit so
  // it floats to the top of the sidebar. Fire-and-forget — the entry write is
  // what matters; this is just ordering metadata.
  function touchActiveTimeline() {
    if (activeTimeline) void updateTimeline(activeTimeline);
  }

  // Every timeline-side entry write funnels through here — the EntryCard todo
  // lozenge, its due-date popover and the composer alike — so this is also the
  // single place the timeline registers a todo undo. Content-only saves return
  // null from describeTodoChange and register nothing.
  async function handleUpdateEntry(entry: Entry) {
    const prev = entries.find((e) => e.id === entry.id);
    await updateEntry(entry);
    reloadTodoCounts();
    touchActiveTimeline();
    const label = prev && describeTodoChange(prev, entry);
    if (prev && label) {
      registerUndo(label, async () => {
        await revertTodoFields(adapter, prev);
        await reloadEntries();
        reloadTodoCounts();
        touchActiveTimeline();
      });
    }
  }

  async function reloadAfterImport() {
    await reloadTimelines();
    await reloadEntries();
    reloadTodoCounts();
  }

  const showNudge = false;

  useEffect(() => {
    if (!loading && urlId && !timelines.find((t) => t.id === urlId)) {
      navigate('/', { replace: true });
    }
  }, [loading, urlId, timelines, navigate]);

  useEffect(() => {
    // Closing the drawer on navigation at mobile width is a deliberate
    // render-time state sync, not something to derive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.innerWidth < 768) setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (loading || timelines.length > 0) return;
    if (localStorage.getItem(WELCOME_KEY)) return;
    seedWelcomeTimeline();
  // seedWelcomeTimeline is a hoisted declaration that runs once, guarded by WELCOME_KEY.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, timelines.length]);

  async function seedWelcomeTimeline() {
    localStorage.setItem(WELCOME_KEY, '1');
    const timeline = await createTimeline('Getting Started');
    await adapter.putEntry({
      id: uuid(),
      timelineId: timeline.id,
      content: JSON.stringify(WELCOME_CONTENT),
      timestamp: timeline.createdAt,
      attachments: [],
      isStart: true,
    });
    navigate(`/timelines/${timeline.id}`, { replace: true });
  }

  async function handleCreate(name: string) {
    const timeline = await createTimeline(name);
    const startEntry: Entry = {
      id: uuid(),
      timelineId: timeline.id,
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Timeline Start' }] }] }),
      timestamp: timeline.createdAt,
      attachments: [],
      isStart: true,
    };
    await adapter.putEntry(startEntry);
    navigate(`/timelines/${timeline.id}`);
    if (window.innerWidth < 768) setDrawerOpen(false);
  }

  function handleSelectTimeline(id: string) {
    navigate(`/timelines/${id}`);
    if (window.innerWidth < 768) setDrawerOpen(false);
  }

  function handleNewFromHome() {
    if (window.innerWidth < 768) setDrawerOpen(true);
    setTriggerCreate(true);
  }

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <button className={styles.logoBtn} onClick={() => navigate('/')} aria-label="Go home">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className={styles.appLogo} />
          <span className={styles.appWordmark}>Organizer</span>
        </button>
        <div className={styles.headerSearch}>
          <SearchBox timelines={timelines} />
        </div>
        {showNudge && (
          <span className={styles.nudge}>
            No backup ·{' '}
            <button
              className={styles.nudgeBtn}
              onClick={() => { exportData(adapter); markSaved(); }}
            >
              Export now
            </button>
          </span>
        )}
        <div className={`${styles.headerActions} ${styles.headerOnly}`}>
          <button
            className={`${styles.todosBtn} ${isTodoPage ? styles.todosBtnActive : ''}`}
            onClick={() => navigate('/todos')}
          >
            <CheckSquare size={14} />Todos
          </button>
          <button
            className={`${styles.headerBtn} ${isSettingsPage ? styles.headerBtnActive : ''}`}
            onClick={() => navigate('/settings')}
          >
            <SettingsIcon size={14} />Settings
          </button>
          <a
            className={styles.headerBtn}
            href="https://www.useorganizer.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen size={14} />Docs
          </a>
        </div>
      </header>

      <button className={styles.mobileBurger} onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Toggle menu">
        <Menu size={20} />
      </button>

      <div className={styles.body} ref={bodyRef}>
        {drawerOpen && <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />}
        <div
          className={`${styles.sidebar} ${drawerOpen ? styles.drawerOpen : ''}`}
          style={isDesktop ? { width: sidebarWidth } : undefined}
        >
          <div className={styles.mobileNav}>
            <button
              className={styles.mobileBrand}
              onClick={() => { navigate('/'); setDrawerOpen(false); }}
              aria-label="Go home"
              title={`Organizer · ${__BUILD_INFO__}`}
            >
              <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Organizer" className={styles.appLogo} />
            </button>
            <div className={styles.mobileSearch}>
              <SearchBox timelines={timelines} fluid />
            </div>
            <div className={styles.mobileActions}>
              <button
                className={`${styles.mobileNavBtn} ${isTodoPage ? styles.mobileNavBtnActive : ''}`}
                onClick={() => navigate('/todos')}
              >
                <CheckSquare size={16} />Todos
              </button>
              <button
                className={`${styles.mobileNavBtn} ${isSettingsPage ? styles.mobileNavBtnActive : ''}`}
                onClick={() => { navigate('/settings'); setDrawerOpen(false); }}
              >
                <SettingsIcon size={16} />Settings
              </button>
              <button
                className={`${styles.mobileNavBtn} ${showFilter ? styles.mobileNavBtnActive : ''}`}
                onClick={() => setShowFilter((v) => !v)}
              >
                <Filter size={16} />Filter
              </button>
              <button
                className={styles.mobileNavBtn}
                onClick={() => setTriggerCreate(true)}
              >
                <Plus size={16} />New Timeline
              </button>
            </div>
          </div>
          <TimelineList
            timelines={timelines}
            allTags={allTags}
            activeId={activeTimeline?.id ?? null}
            todoCounts={todoCounts}
            onSelect={handleSelectTimeline}
            onCreate={handleCreate}
            onUpdate={updateTimeline}
            onDelete={removeTimeline}
            triggerCreate={triggerCreate}
            onTriggerCreateHandled={() => setTriggerCreate(false)}
            showFilter={showFilter}
            onToggleFilter={() => setShowFilter((v) => !v)}
          />
        </div>

        {isDesktop && (
          <div
            className={styles.resizer}
            onMouseDown={startResize}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') { e.preventDefault(); setSidebarWidth((w) => clampWidth(w - 16)); }
              if (e.key === 'ArrowRight') { e.preventDefault(); setSidebarWidth((w) => clampWidth(w + 16)); }
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            tabIndex={0}
          />
        )}

        <main className={styles.main}>
          {isSettingsPage ? (
            <Settings onDataChanged={reloadAfterImport} />
          ) : isTodoPage ? (
            <TodoPage onEntryChanged={reloadTodoCounts} />
          ) : activeTimeline ? (
            <TimelineView
              timeline={activeTimeline}
              entries={entries}
              allTags={allTags}
              onUpdateTimeline={updateTimeline}
              onAddEntry={async (data) => { const created = await addEntry(data); reloadTodoCounts(); touchActiveTimeline(); return created; }}
              onUpdateEntry={handleUpdateEntry}
              onDeleteEntry={async (entry) => { await removeEntry(entry); reloadTodoCounts(); touchActiveTimeline(); }}
            />
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyInner}>
                <div className={styles.emptyIcon}><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className={styles.emptyLogo} /></div>
                <h2 className={styles.emptyHeading}>What to smash next?</h2>
                {timelines.length > 0 && (
                  <div className={styles.recentList}>
                    {timelines.slice(0, 5).map((t) => (
                      <button key={t.id} className={styles.recentItem} onClick={() => handleSelectTimeline(t.id)}>
                        <span className={styles.recentName}>{t.name}</span>
                        {todoCounts[t.id] ? (
                          <span className={`${styles.recentBadge} ${todoCounts[t.id].overdue > 0 ? styles.recentBadgeOverdue : ''}`}>
                            {todoCounts[t.id].count}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.emptyActions}>
                  <button className={styles.emptyBtn} onClick={handleNewFromHome}>
                    <Plus size={16} />New Timeline
                  </button>
                  <button className={styles.emptyTodosBtn} onClick={() => navigate('/todos')}>
                    <CheckSquare size={16} />View Todos
                  </button>
                </div>
                {timelines.length === 0 && localStorage.getItem(WELCOME_KEY) && (
                  <button className={styles.emptyRestoreBtn} onClick={seedWelcomeTimeline}>
                    Restore welcome guide
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
