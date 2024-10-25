import { popupWindow } from '@affine/core/utils';
import { createIdentifier, Service } from '@toeverything/infra';
import { parsePath, type To } from 'history';

import type { DesktopApiService } from '../../desktop-api';

export type WorkbenchNewTabHandler = {
  handle: (option: { basename: string; to: To; show: boolean }) => void;
};

export const WorkbenchNewTabHandler = createIdentifier<WorkbenchNewTabHandler>(
  'WorkbenchNewTabHandler'
);

export const BrowserWorkbenchNewTabHandler: WorkbenchNewTabHandler = {
  handle: ({ basename, to }) => {
    const link =
      basename +
      (typeof to === 'string' ? to : `${to.pathname}${to.search}${to.hash}`);
    popupWindow(link);
  },
};

export class DesktopWorkbenchNewTabHandler
  extends Service
  implements WorkbenchNewTabHandler
{
  constructor(private readonly electronApi: DesktopApiService) {
    super();
  }
  handle({ basename, to }: { basename: string; to: To }) {
    const path = typeof to === 'string' ? parsePath(to) : to;
    this.electronApi.api.handler.ui
      .addTab({
        basename,
        view: { path },
        show: false,
      })
      .catch(console.error);
  }
}
