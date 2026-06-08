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

  constructor(name: string, store: Map<string, StoredFile>) {
    this.name = name;
    this.store = store;
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

  constructor(name: string = 'root') {
    this.name = name;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    if (!this.files.has(name)) {
      if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
      this.files.set(name, { data: '' });
    }
    return new MockFileHandle(name, this.files);
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
      yield [name, new MockFileHandle(name, this.files)];
    }
    for (const [name, dir] of this.dirs) {
      yield [name, dir];
    }
  }
}
