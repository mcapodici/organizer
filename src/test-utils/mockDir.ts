/**
 * Minimal in-memory stand-in for the File System Access API directory/file
 * handles, enough to drive FileAdapter and listWorkspaces in tests. Only the
 * methods those code paths use are implemented.
 */

interface StoredFile { data: string | ArrayBuffer; mtime: number }

// Strictly-increasing stand-in for File.lastModified so each write is detectably
// newer than the last, without relying on a real (coarse, possibly-equal) clock.
let mtimeCounter = 0;
function nextMtime(): number { return ++mtimeCounter; }

class MockFileHandle {
  readonly kind = 'file';
  readonly name: string;
  private readonly store: Map<string, StoredFile>;
  private readonly moveMode: 'absent' | 'works' | 'throws';

  constructor(name: string, store: Map<string, StoredFile>, moveMode: 'absent' | 'works' | 'throws' = 'absent') {
    this.name = name;
    this.store = store;
    this.moveMode = moveMode;
    // Only expose move() when the directory opts into emulating it, so tests can
    // cover both the native-move and the copy+remove fallback paths.
    if (moveMode === 'works' || moveMode === 'throws') {
      (this as unknown as { move: (newName: string) => Promise<void> }).move = async (newName: string) => {
        if (this.moveMode === 'throws') throw new DOMException('move not allowed', 'NotAllowedError');
        const entry = this.store.get(this.name);
        this.store.set(newName, entry ?? { data: '', mtime: nextMtime() });
        this.store.delete(this.name);
      };
    }
  }

  async getFile() {
    const entry = this.store.get(this.name);
    const data = entry ? entry.data : '';
    return {
      lastModified: entry ? entry.mtime : 0,
      async text() {
        return typeof data === 'string' ? data : new TextDecoder().decode(new Uint8Array(data));
      },
      async arrayBuffer() {
        return typeof data === 'string'
          ? new TextEncoder().encode(data).buffer
          : data;
      },
    };
  }

  async createWritable() {
    const store = this.store;
    const name = this.name;
    return {
      async write(data: string | ArrayBuffer | ArrayBufferView) {
        const normalized = ArrayBuffer.isView(data)
          ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
          : data;
        store.set(name, { data: normalized as string | ArrayBuffer, mtime: nextMtime() });
      },
      async close() { /* no-op */ },
    };
  }
}

export class MockDir {
  readonly kind = 'directory';
  files = new Map<string, StoredFile>();
  dirs = new Map<string, MockDir>();
  readonly name: string;
  // How file handles from this directory emulate the FSA move() method:
  // 'absent' (no move, default), 'works', or 'throws' (move present but rejects).
  moveMode: 'absent' | 'works' | 'throws' = 'absent';

  constructor(name: string = 'root') {
    this.name = name;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    if (!this.files.has(name)) {
      if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
      this.files.set(name, { data: '', mtime: nextMtime() });
    }
    return new MockFileHandle(name, this.files, this.moveMode);
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDir> {
    if (!this.dirs.has(name)) {
      if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
      const child = new MockDir(name);
      // A picked directory's move() policy applies throughout its subtree.
      child.moveMode = this.moveMode;
      this.dirs.set(name, child);
    }
    return this.dirs.get(name)!;
  }

  // Test helper: write a file at a slash-separated path, creating any missing
  // intermediate directories, with a fresh mtime.
  seed(path: string, data: string | ArrayBuffer): void {
    const parts = path.split('/');
    const fname = parts.pop()!;
    const target = parts.reduce<MockDir>((d, p) => {
      if (!d.dirs.has(p)) {
        const child = new MockDir(p);
        child.moveMode = d.moveMode;
        d.dirs.set(p, child);
      }
      return d.dirs.get(p)!;
    }, this);
    target.files.set(fname, { data, mtime: nextMtime() });
  }

  // Accepts the FSA `{ recursive }` option as an extra arg at the call site;
  // deleting a directory from the map already drops its whole subtree.
  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.dirs.delete(name)) {
      throw new DOMException(`${name} not found`, 'NotFoundError');
    }
  }

  async *entries(): AsyncGenerator<[string, MockFileHandle | MockDir]> {
    for (const name of this.files.keys()) {
      yield [name, new MockFileHandle(name, this.files, this.moveMode)];
    }
    for (const [name, dir] of this.dirs) {
      yield [name, dir];
    }
  }
}
