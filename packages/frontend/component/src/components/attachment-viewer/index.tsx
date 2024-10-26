import type { AttachmentBlockModel } from '@blocksuite/blocks';
import { filesize } from 'filesize';
import { useMemo } from 'react';

import { Error } from './error';
import * as styles from './styles.css';
import { Titlebar } from './titlebar';
import { Viewer } from './viewer';

export type AttachmentViewerProps = {
  model: AttachmentBlockModel;
};

export const AttachmentViewer = ({ model }: AttachmentViewerProps) => {
  const props = useMemo(() => {
    const pieces = model.name.split('.');
    const ext = pieces.pop() || '';
    const name = pieces.join('.');
    const isPDF = ext === 'pdf';
    const size = filesize(model.size);
    return { model, name, ext, size, isPDF };
  }, [model]);

  return (
    <div className={styles.viewerContainer}>
      <Titlebar {...props} />
      {props.isPDF ? <Viewer {...props} /> : <Error {...props} />}
    </div>
  );
};
