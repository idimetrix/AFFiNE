import {
  DocsService,
  type Framework,
  WorkspaceScope,
} from '@toeverything/infra';

import { EditorSettingService } from '../editor-setting';
import { WorkbenchService } from '../workbench';
import { DesktopApi } from './entities/electron-api';
import { ElectronApiImpl } from './impl';
import { DesktopApiProvider } from './provider';
import { DesktopApiService, WorkspaceDesktopApiService } from './service';

export function configureDesktopApiModule(framework: Framework) {
  framework
    .impl(DesktopApiProvider, ElectronApiImpl)
    .entity(DesktopApi, [DesktopApiProvider])
    .service(DesktopApiService, [DesktopApi])
    .scope(WorkspaceScope)
    .service(WorkspaceDesktopApiService, [
      DesktopApiService,
      DocsService,
      EditorSettingService,
      WorkbenchService,
    ]);
}

export * from './service';
export type { ClientEvents, TabViewsMetaSchema } from '@affine/electron-api';
