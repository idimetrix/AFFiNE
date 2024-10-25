import { notify } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { Button } from '@affine/component/ui/button';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { useSystemOnline } from '@affine/core/components/hooks/use-system-online';
import { DesktopApiService } from '@affine/core/modules/desktop-api/service';
import { useI18n } from '@affine/i18n';
import {
  useService,
  type Workspace,
  type WorkspaceMetadata,
} from '@toeverything/infra';
import { useState } from 'react';

interface ExportPanelProps {
  workspaceMetadata: WorkspaceMetadata;
  workspace: Workspace | null;
}

export const DesktopExportPanel = ({
  workspaceMetadata,
  workspace,
}: ExportPanelProps) => {
  const workspaceId = workspaceMetadata.id;
  const t = useI18n();
  const [saving, setSaving] = useState(false);
  const isOnline = useSystemOnline();
  const desktopApi = useService(DesktopApiService);

  const onExport = useAsyncCallback(async () => {
    if (saving || !workspace) {
      return;
    }
    setSaving(true);
    try {
      if (isOnline) {
        await workspace.engine.waitForDocSynced();
        await workspace.engine.blob.sync();
      }

      const result = await desktopApi.handler.dialog.saveDBFileAs(workspaceId);
      if (result?.error) {
        throw new Error(result.error);
      } else if (!result?.canceled) {
        notify.success({ title: t['Export success']() });
      }
    } catch (e: any) {
      notify.error({ title: t['Export failed'](), message: e.message });
    } finally {
      setSaving(false);
    }
  }, [isOnline, saving, t, workspace, workspaceId, desktopApi]);

  return (
    <SettingRow name={t['Export']()} desc={t['Export Description']()}>
      <Button
        data-testid="export-affine-backup"
        onClick={onExport}
        disabled={saving}
      >
        {t['Export']()}
      </Button>
    </SettingRow>
  );
};
