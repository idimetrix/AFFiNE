import { MenuItem, MenuSeparator, MenuSub, notify } from '@affine/component';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';
import { openFileOrFiles, ZipTransformer } from '@blocksuite/affine/blocks';
import type { Doc } from '@blocksuite/affine/store';
import { ExportIcon, ImportIcon, ToneIcon } from '@blocksuite/icons/rc';
import { useService, WorkspaceService } from '@toeverything/infra';
import { type ReactNode, useCallback } from 'react';

import { useAppSettingHelper } from '../../hooks/affine/use-app-setting-helper';
import { useExportPage } from '../../hooks/affine/use-export-page';
import { useAsyncCallback } from '../../hooks/affine-async-hooks';
import { transitionStyle } from './index.css';

interface SnapshotMenuItemsProps {
  snapshotActionHandler: (action: 'import' | 'export' | 'disable') => void;
  className?: string;
}

interface SnapshotMenuItemProps<T> {
  onSelect: () => void;
  className?: string;
  type: T;
  icon: ReactNode;
  label: string;
}

interface SnapshotProps {
  className?: string;
}

export function SnapshotMenuItem<T>({
  onSelect,
  className,
  type,
  icon,
  label,
}: SnapshotMenuItemProps<T>) {
  return (
    <MenuItem
      className={className}
      data-testid={`snapshot-${type}`}
      onSelect={onSelect}
      block
      prefixIcon={icon}
    >
      {label}
    </MenuItem>
  );
}

export const DisableSnapshotMenuItems = ({
  snapshotActionHandler,
  className = transitionStyle,
}: SnapshotMenuItemsProps) => {
  const t = useI18n();
  return (
    <SnapshotMenuItem
      onSelect={() => snapshotActionHandler('disable')}
      className={className}
      type="disable"
      icon={<ToneIcon />}
      label={t['Disable Snapshot']()}
    />
  );
};

export const SnapshotMenuItems = ({
  snapshotActionHandler,
  className = transitionStyle,
}: SnapshotMenuItemsProps) => {
  const t = useI18n();
  return (
    <>
      <SnapshotMenuItem
        onSelect={() => snapshotActionHandler('import')}
        className={className}
        type="import"
        icon={<ImportIcon />}
        label={t['Import']()}
      />
      <SnapshotMenuItem
        onSelect={() => snapshotActionHandler('export')}
        className={className}
        type="export"
        icon={<ExportIcon />}
        label={t['Export']()}
      />
    </>
  );
};

export const Snapshot = ({ className }: SnapshotProps) => {
  const t = useI18n();
  const workspace = useService(WorkspaceService).workspace;
  const docCollection = workspace.docCollection;
  const workbench = useService(WorkbenchService).workbench;
  const { updateSettings } = useAppSettingHelper();
  const exportHandler = useExportPage();

  const importSnapshot = useCallback(async () => {
    try {
      const file = await openFileOrFiles({ acceptType: 'Zip' });
      if (!file) return null;

      const importedDocs = (
        await ZipTransformer.importDocs(docCollection, file)
      ).filter(doc => doc !== undefined);
      if (importedDocs.length === 0) {
        notify.error({
          title: 'Import Snapshot Failed',
          message: 'No valid documents found in the imported file.',
        });
        return null;
      }

      notify.success({
        title: 'Imported Snapshot Successfully',
        message: `Imported ${importedDocs.length} doc(s)`,
      });
      return importedDocs;
    } catch (error) {
      console.error('Error importing snapshot:', error);
      notify.error({
        title: 'Import Snapshot Failed',
        message: 'Failed to import snapshot. Please try again.',
      });
      return null;
    }
  }, [docCollection]);

  const openImportedDocs = useCallback(
    (importedDocs: Doc[]) => {
      if (importedDocs.length > 1) {
        workbench.openAll();
      } else if (importedDocs[0]?.id) {
        workbench.openDoc(importedDocs[0].id);
      }
    },
    [workbench]
  );

  const handleImportSnapshot = useAsyncCallback(async () => {
    const importedDocs = await importSnapshot();
    if (importedDocs) {
      openImportedDocs(importedDocs);
      track.$.header.docOptions.import();
      track.$.header.actions.createDoc({
        control: 'import',
      });
    }
  }, [importSnapshot, openImportedDocs]);

  const disableSnapshotActionOption = useCallback(() => {
    updateSettings('enableSnapshotImportExport', false);
  }, [updateSettings]);

  const snapshotActionHandler = useCallback(
    (action: 'import' | 'export' | 'disable') => {
      switch (action) {
        case 'import':
          return handleImportSnapshot();
        case 'export':
          return exportHandler('snapshot');
        case 'disable':
          return disableSnapshotActionOption();
      }
    },
    [handleImportSnapshot, exportHandler, disableSnapshotActionOption]
  );

  const items = (
    <>
      <SnapshotMenuItems
        snapshotActionHandler={snapshotActionHandler}
        className={className}
      />
      <MenuSeparator />
      <DisableSnapshotMenuItems
        snapshotActionHandler={snapshotActionHandler}
        className={className}
      />
    </>
  );

  return (
    <MenuSub
      items={items}
      triggerOptions={{
        className: transitionStyle,
        prefixIcon: <ToneIcon />,
        ['data-testid' as string]: 'snapshot-menu',
      }}
      subOptions={{}}
    >
      {t['Snapshot']()}
    </MenuSub>
  );
};
