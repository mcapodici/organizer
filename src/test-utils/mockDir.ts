/**
 * Minimal in-memory stand-in for the File System Access API directory/file
 * handles, enough to drive FileAdapter and listWorkspaces in tests. Only the
 * methods those code paths use are implemented.
 */

interface StoredFile { data: string | ArrayBuffer }

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
        this.store.set(newName, entry ?? { data: '' });
        this.store.delete(this.name);
      };
    }
  }

  async getFile() {
    const entry = this.store.get(this.name);
    const data = entry ? entry.data : '';
    return {
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
        store.set(name, { data: normalized as string | ArrayBuffer });
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
      this.files.set(name, { data: '' });
    }
    return new MockFileHandle(name, this.files, this.moveMode);
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDir> {
    if (!this.dirs.has(name)) {
      if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
      this.dirs.set(name, new MockDir(name));
    }
    return this.dirs.get(name)!;
  }

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
