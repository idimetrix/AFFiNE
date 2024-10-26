import { AttachmentViewer } from '@affine/component/attachment-viewer';
import {
  type AttachmentBlockModel,
  matchFlavours,
} from '@blocksuite/affine/blocks';
import {
  type Doc,
  DocsService,
  FrameworkScope,
  useService,
} from '@toeverything/infra';
import { type ReactElement, useEffect, useLayoutEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '../../../../modules/workbench';
import { PageNotFound } from '../../404';

const useLoadAttachment = (pageId?: string, attachmentId?: string) => {
  const docsService = useService(DocsService);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [model, setModel] = useState<AttachmentBlockModel | null>(null);

  useLayoutEffect(() => {
    if (!pageId) return;

    const { doc, release } = docsService.open(pageId);

    if (!doc.blockSuiteDoc.ready) {
      doc.blockSuiteDoc.load();
    }

    setDoc(doc);

    return () => {
      release();
    };
  }, [docsService, pageId]);

  useEffect(() => {
    if (!doc) return;
    if (!attachmentId) return;

    const disposable = doc.blockSuiteDoc.slots.blockUpdated
      .filter(({ type, id }) => type === 'add' && id === attachmentId)
      // @ts-expect-error allow
      .filter(({ model }) => matchFlavours(model, ['affine:attachment']))
      // @ts-expect-error allow
      .once(({ model }) => setModel(model as AttachmentBlockModel));

    return () => {
      disposable.dispose();
    };
  }, [doc, attachmentId]);

  return { doc, model };
};

export const AttachmentPage = (): ReactElement => {
  const params = useParams();
  const { doc, model } = useLoadAttachment(params.pageId, params.attachmentId);

  if (!doc || !model) {
    return <PageNotFound noPermission />;
  }

  return (
    <>
      <ViewTitle title={model.name} />
      <ViewIcon icon={model.type.endsWith('pdf') ? 'pdf' : 'attachment'} />
      <ViewHeader></ViewHeader>
      <ViewBody>
        <FrameworkScope scope={doc.scope}>
          <AttachmentViewer model={model} />
        </FrameworkScope>
      </ViewBody>
    </>
  );
};

export const Component = () => {
  return <AttachmentPage />;
};
