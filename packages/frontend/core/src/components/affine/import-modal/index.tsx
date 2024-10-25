import { Button, Modal } from '@affine/component';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { popupWindow } from '@affine/core/utils';
import { useI18n } from '@affine/i18n';
import {
  importNotion,
  MarkdownTransformer,
  openFileOrFiles,
} from '@blocksuite/affine/blocks';
import type { DocCollection } from '@blocksuite/affine/store';
import {
  ExportToMarkdownIcon,
  HelpIcon,
  NotionIcon,
} from '@blocksuite/icons/rc';
import { useService, WorkspaceService } from '@toeverything/infra';
import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { useSetAtom } from 'jotai';
import { useCallback, useState } from 'react';

import { openImportModalAtom } from '../../atoms';
import { useAsyncCallback } from '../../hooks/affine-async-hooks';
import * as style from './style.css';

type ImportType = 'markdown' | 'markdownZip' | 'notion';
type AcceptType = 'Markdown' | 'Zip';
type Status = 'idle' | 'importing' | 'success' | 'error';

type ImportConfig = {
  fileOptions: { acceptType: AcceptType; multiple: boolean };
  importFunction: (
    docCollection: DocCollection,
    file: File | File[]
  ) => Promise<string[]>;
};

const commonButtonProps = {
  variant: 'secondary' as const,
  size: 'large' as const,
  className: style.importButton,
  prefixClassName: style.prefixIcon,
  contentClassName: style.buttonContent,
};

const importOptions = [
  {
    label: 'com.affine.import.markdown-files',
    prefix: <ExportToMarkdownIcon color={cssVarV2('icon/primary')} />,
    testId: 'editor-option-menu-import-markdown-files',
    type: 'markdown' as ImportType,
  },
  {
    label: 'com.affine.import.markdown-with-media-files',
    prefix: <ExportToMarkdownIcon color={cssVarV2('icon/primary')} />,
    testId: 'editor-option-menu-import-markdown-with-media',
    type: 'markdownZip' as ImportType,
  },
  {
    label: 'com.affine.import.notion',
    prefix: <NotionIcon color={cssVar('black')} />,
    suffix: <HelpIcon color={cssVarV2('icon/primary')} />,
    testId: 'editor-option-menu-import-notion',
    type: 'notion' as ImportType,
  },
];

const importConfigs: Record<ImportType, ImportConfig> = {
  markdown: {
    fileOptions: { acceptType: 'Markdown', multiple: true },
    importFunction: async (docCollection, files) => {
      if (!Array.isArray(files)) {
        throw new Error('Expected an array of files for markdown files import');
      }
      const pageIds: string[] = [];
      for (const file of files) {
        const text = await file.text();
        const fileName = file.name.split('.').slice(0, -1).join('.');
        const pageId = await MarkdownTransformer.importMarkdownToDoc({
          collection: docCollection,
          markdown: text,
          fileName,
        });
        if (pageId) pageIds.push(pageId);
      }
      return pageIds;
    },
  },
  markdownZip: {
    fileOptions: { acceptType: 'Zip', multiple: false },
    importFunction: async (docCollection, file) => {
      if (Array.isArray(file)) {
        throw new Error('Expected a single zip file for markdownZip import');
      }
      return MarkdownTransformer.importMarkdownZip({
        collection: docCollection,
        imported: file,
      });
    },
  },
  notion: {
    fileOptions: { acceptType: 'Zip', multiple: false },
    importFunction: async (docCollection, file) => {
      if (Array.isArray(file)) {
        throw new Error('Expected a single zip file for notion import');
      }
      const { pageIds } = await importNotion(docCollection, file);
      return pageIds;
    },
  },
};

const ImportOptions = ({
  onImport,
}: {
  onImport: (type: ImportType) => void;
}) => {
  const t = useI18n();
  return (
    <>
      <div className={style.importModalTitle}>{t['Import']()}</div>
      <div className={style.importModalContent}>
        {importOptions.map(({ label, prefix, suffix, testId, type }) => (
          <Button
            key={testId}
            {...commonButtonProps}
            prefix={prefix}
            suffix={suffix}
            data-testid={testId}
            onClick={() => onImport(type)}
          >
            {t[label]()}
          </Button>
        ))}
      </div>
      <div className={style.importModalTip}>
        {t['com.affine.import.modal.tip']()}{' '}
        <a
          className={style.link}
          href="https://discord.gg/whd5mjYqVw"
          target="_blank"
          rel="noreferrer"
        >
          Discord
        </a>{' '}
        .
      </div>
    </>
  );
};

const ImportingStatus = () => {
  const t = useI18n();
  return (
    <>
      <div className={style.importModalTitle}>
        {t['com.affine.import.status.importing.title']()}
      </div>
      <p className={style.importStatusContent}>
        {t['com.affine.import.status.importing.message']()}
      </p>
    </>
  );
};

const SuccessStatus = ({ onComplete }: { onComplete: () => void }) => {
  const t = useI18n();
  return (
    <>
      <div className={style.importModalTitle}>
        {t['com.affine.import.status.success.title']()}
      </div>
      <p className={style.importStatusContent}>
        {t['com.affine.import.status.success.message']()}{' '}
        <a
          className={style.link}
          href="https://discord.gg/whd5mjYqVw"
          target="_blank"
          rel="noreferrer"
        >
          Discord
        </a>
        .
      </p>
      <div className={style.importModalButtonContainer}>
        <Button onClick={onComplete} variant="primary">
          {t['Complete']()}
        </Button>
      </div>
    </>
  );
};

const ErrorStatus = ({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) => {
  const t = useI18n();
  return (
    <>
      <div className={style.importModalTitle}>
        {t['com.affine.import.status.failed.title']()}
      </div>
      <p className={style.importStatusContent}>
        {error || 'Unknown error occurred'}
      </p>
      <div className={style.importModalButtonContainer}>
        <Button
          onClick={() => {
            popupWindow('https://discord.gg/whd5mjYqVw');
          }}
          variant="secondary"
        >
          {t['Feedback']()}
        </Button>
        <Button onClick={onRetry} variant="primary">
          {t['Retry']()}
        </Button>
      </div>
    </>
  );
};

export const ImportModal = ({ ...modalProps }) => {
  const t = useI18n();
  const [status, setStatus] = useState<Status>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [pageIds, setPageIds] = useState<string[]>([]);
  const setOpenImportModalAtom = useSetAtom(openImportModalAtom);
  const workspace = useService(WorkspaceService).workspace;
  const workbench = useService(WorkbenchService).workbench;
  const docCollection = workspace.docCollection;

  const handleImport = useAsyncCallback(
    async (type: ImportType) => {
      setImportError(null);
      try {
        const importConfig = importConfigs[type];
        const file = await openFileOrFiles(importConfig.fileOptions);

        if (!file || (Array.isArray(file) && file.length === 0)) {
          throw new Error(
            t['com.affine.import.status.failed.message.no-file-selected']()
          );
        }

        setStatus('importing');

        const pageIds = await importConfig.importFunction(docCollection, file);

        setPageIds(pageIds);
        setStatus('success');
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
        setStatus('error');
      }
    },
    [docCollection, t]
  );

  const handleComplete = useCallback(() => {
    if (pageIds.length > 1) {
      workbench.openAll();
    } else if (pageIds.length === 1) {
      workbench.openDoc(pageIds[0]);
    }
    setOpenImportModalAtom(false);
  }, [pageIds, workbench, setOpenImportModalAtom]);

  const handleRetry = () => {
    setStatus('idle');
  };

  const statusComponents = {
    idle: <ImportOptions onImport={handleImport} />,
    importing: <ImportingStatus />,
    success: <SuccessStatus onComplete={handleComplete} />,
    error: <ErrorStatus error={importError} onRetry={handleRetry} />,
  };

  return (
    <Modal
      width={480}
      contentOptions={{
        ['data-testid' as string]: 'import-modal',
        style: {
          maxHeight: '85vh',
          maxWidth: '70vw',
          minHeight: '126px',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          background: cssVarV2('layer/background/primary'),
        },
      }}
      closeButtonOptions={{
        className: style.closeButton,
      }}
      withoutCloseButton={status === 'importing'}
      persistent={status === 'importing'}
      {...modalProps}
    >
      <div className={style.importModalContainer}>
        {statusComponents[status]}
      </div>
    </Modal>
  );
};
