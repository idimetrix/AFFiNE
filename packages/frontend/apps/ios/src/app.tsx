import { AffineContext } from '@affine/component/context';
import { AppFallback } from '@affine/core/components/affine/app-container';
import { Telemetry } from '@affine/core/components/telemetry';
import { configureMobileModules } from '@affine/core/mobile/modules';
import { router } from '@affine/core/mobile/router';
import { configureCommonModules } from '@affine/core/modules';
import { AuthService, WebSocketAuthProvider } from '@affine/core/modules/cloud';
import { I18nProvider } from '@affine/core/modules/i18n';
import { configureLocalStorageStateStorageImpls } from '@affine/core/modules/storage';
import {
  ClientSchemaProvider,
  PopupWindowProvider,
} from '@affine/core/modules/url';
import { configureIndexedDBUserspaceStorageProvider } from '@affine/core/modules/userspace';
import { configureBrowserWorkbenchModule } from '@affine/core/modules/workbench';
import {
  configureBrowserWorkspaceFlavours,
  configureIndexedDBWorkspaceEngineStorageProvider,
} from '@affine/core/modules/workspace-engine';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import {
  Framework,
  FrameworkRoot,
  getCurrentStore,
  LifecycleService,
} from '@toeverything/infra';
import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';

import { configureFetchProvider } from './fetch';
import { Cookie } from './plugins/cookie';

const future = {
  v7_startTransition: true,
} as const;

const framework = new Framework();
configureCommonModules(framework);
configureBrowserWorkbenchModule(framework);
configureLocalStorageStateStorageImpls(framework);
configureBrowserWorkspaceFlavours(framework);
configureIndexedDBWorkspaceEngineStorageProvider(framework);
configureIndexedDBUserspaceStorageProvider(framework);
configureMobileModules(framework);
framework.impl(PopupWindowProvider, {
  open: (url: string) => {
    Browser.open({
      url,
      presentationStyle: 'popover',
    }).catch(console.error);
  },
});
framework.impl(ClientSchemaProvider, {
  getClientSchema() {
    return 'affine';
  },
});
configureFetchProvider(framework);
framework.impl(WebSocketAuthProvider, {
  getAuthToken: async url => {
    const cookies = await Cookie.getCookies({
      url,
    });
    return {
      userId: cookies['affine_user_id'],
      token: cookies['affine_session'],
    };
  },
});
const frameworkProvider = framework.provider();

// setup application lifecycle events, and emit application start event
window.addEventListener('focus', () => {
  frameworkProvider.get(LifecycleService).applicationFocus();
});
frameworkProvider.get(LifecycleService).applicationStart();

CapacitorApp.addListener('appUrlOpen', ({ url }) => {
  // try to close browser if it's open
  Browser.close().catch(e => console.error('Failed to close browser', e));

  const urlObj = new URL(url);

  if (urlObj.hostname === 'authentication') {
    const method = urlObj.searchParams.get('method');
    const payload = JSON.parse(urlObj.searchParams.get('payload') ?? 'false');

    if (
      !method ||
      (method !== 'magic-link' && method !== 'oauth') ||
      !payload
    ) {
      console.error('Invalid authentication url', url);
      return;
    }

    const authService = frameworkProvider.get(AuthService);
    if (method === 'oauth') {
      authService
        .signInOauth(payload.code, payload.state, payload.provider)
        .catch(console.error);
    } else if (method === 'magic-link') {
      authService
        .signInMagicLink(payload.email, payload.token)
        .catch(console.error);
    }
  }
});

export function App() {
  return (
    <Suspense>
      <FrameworkRoot framework={frameworkProvider}>
        <I18nProvider>
          <AffineContext store={getCurrentStore()}>
            <Telemetry />
            <RouterProvider
              fallbackElement={<AppFallback />}
              router={router}
              future={future}
            />
          </AffineContext>
        </I18nProvider>
      </FrameworkRoot>
    </Suspense>
  );
}
