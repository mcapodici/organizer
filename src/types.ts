export interface Timeline {
  id: string;
  name: string;
  createdAt: string;
  /** Last time the timeline or one of its entries changed. Optional for data
   *  created before this field existed — fall back to createdAt when absent. */
  updatedAt?: string;
  tags: string[];
}

export interface Entry {
  id: string;
  timelineId: string;
  content: string;
  timestamp: string;
  attachments: Attachment[];
  isStart: boolean;
  dueDate?: string;
  isDone?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blobKey: string;
}

export interface ExportData {
  version: number;
  timelines: Timeline[];
  entries: Entry[];
  blobs: Record<string, string>;
}
