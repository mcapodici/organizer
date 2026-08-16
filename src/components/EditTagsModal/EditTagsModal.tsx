import { useState } from 'react';
import type { Timeline } from '../../types';
import { Modal } from '../Modal/Modal';
import { TagInput } from '../TagInput/TagInput';
import styles from './EditTagsModal.module.css';

export function EditTagsModal({ timeline, allTags, onSave, onClose }: {
  timeline: Timeline;
  allTags: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}) {
  const [tags, setTags] = useState(timeline.tags);
  return (
    <Modal title="Edit Tags" onClose={onClose}>
      <TagInput tags={tags} allTags={allTags} onChange={setTags} />
      <div className={styles.modalActions}>
        <button className={styles.btn} onClick={() => onSave(tags)}>Save</button>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
