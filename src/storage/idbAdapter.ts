import { v4 as uuid } from 'uuid';
import type { Timeline, Entry } from '../types';
import { ConflictError, type StorageAdapter } from './interface';
import { markMergedCopy } from './merge';
import * as db from '../db';
import { getDB } from '../db';

const SAVE_ID_KEY = 'saveId';

async function readSaveId(): Promise<string | undefined> {
  return (await getDB()).get('meta', SAVE_ID_KEY);
}

async function writeSaveId(id: string): Promise<void> {
  await (await getDB()).put('meta', id, SAVE_ID_KEY);
}

export class IdbAdapter implements StorageAdapter {
  private lastKnownSaveId: string | undefined;
  private initialized = false;
  private frozen = false;

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.lastKnownSaveId = await readSaveId();
    this.initialized = true;
  }

  async hasConflict(): Promise<boolean> {
    if (this.frozen) return true;
    await this.init();
    if (this.lastKnownSaveId === undefined) return false;
    const onDisk = await readSaveId();
    if (onDisk !== undefined && onDisk !== this.lastKnownSaveId) {
      this.frozen = true;
      return true;
    }
    return false;
  }

  // Recover from a detected conflict. IndexedDB is shared between tabs, so the DB
  // already holds the other tab's writes — adopt its saveId and unfreeze. If a note
  // open in the editor (activeBase) was changed by the other tab, preserve that
  // version as a marked duplicate and restore the editor's note under its own id.
  async mergeFromDisk(activeBase: Entry | null): Promise<{ mergedCopies: number }> {
    await this.init();
    this.frozen = false;
    if (activeBase) {
      const diskActive = (await db.getAllEntries()).find((e) => e.id === activeBase.id);
      if (diskActive && diskActive.content !== activeBase.content) {
        const dup: Entry = { ...diskActive, id: uuid(), content: markMergedCopy(diskActive.content) };
        await db.putEntry(activeBase);
        await db.putEntry(dup);
        const next = uuid();
        await writeSaveId(next);
        this.lastKnownSaveId = next;
        return { mergedCopies: 1 };
      }
    }
    this.lastKnownSaveId = await readSaveId();
    return { mergedCopies: 0 };
  }

  // Bump the saveId BEFORE the data write so the change marker can never lag
  // behind committed data. If writeSaveId fails, nothing is written and
  // lastKnownSaveId is untouched (consistent). If op fails after the marker
  // moved, the marker is merely ahead of the data — a harmless merge that finds
  // no new data — never behind, which would hide the change from other tabs.
  private async guardedWrite(op: () => Promise<void>): Promise<void> {
    if (await this.hasConflict()) throw new ConflictError();
    const next = uuid();
    await writeSaveId(next);
    this.lastKnownSaveId = next;
    await op();
  }

  getAllTimelines(): Promise<Timeline[]> { return db.getAllTimelines(); }
  getAllEntries(): Promise<Entry[]> { return db.getAllEntries(); }
  getEntriesForTimeline(id: string): Promise<Entry[]> { return db.getEntriesForTimeline(id); }
  getBlob(key: string): Promise<ArrayBuffer | undefined> { return db.getBlob(key); }
  getAllBlobKeys(): Promise<string[]> { return db.getAllBlobKeys(); }
  getAllBlobs(): Promise<Record<string, ArrayBuffer>> { return db.getAllBlobs(); }

  putTimeline(t: Timeline): Promise<void> { return this.guardedWrite(() => db.putTimeline(t)); }
  deleteTimeline(id: string): Promise<void> { return this.guardedWrite(() => db.deleteTimeline(id)); }
  putEntry(e: Entry): Promise<void> { return this.guardedWrite(() => db.putEntry(e)); }
  deleteEntry(id: string): Promise<void> { return this.guardedWrite(() => db.deleteEntry(id)); }
  deleteEntriesForTimeline(id: string): Promise<void> { return this.guardedWrite(() => db.deleteEntriesForTimeline(id)); }
  putBlob(key: string, data: ArrayBuffer): Promise<void> { return this.guardedWrite(() => db.putBlob(key, data)); }
  deleteBlob(key: string): Promise<void> { return this.guardedWrite(() => db.deleteBlob(key)); }
  clearAll(): Promise<void> {
    return this.guardedWrite(() => db.clearAll());
  }
}
