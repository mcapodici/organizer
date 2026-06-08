// Type declarations for File System Access API features not yet in this TS DOM lib version

interface FileSystemHandle {
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

declare function showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;

declare const __BUILD_INFO__: string;
