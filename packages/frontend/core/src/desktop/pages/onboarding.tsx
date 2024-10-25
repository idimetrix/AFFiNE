import { DesktopApiService } from '@affine/core/modules/desktop-api/service';
import { useServiceOptional } from '@toeverything/infra';
import { useCallback } from 'react';
import { redirect } from 'react-router-dom';

import { Onboarding } from '../../components/affine/onboarding/onboarding';
import {
  appConfigStorage,
  useAppConfigStorage,
} from '../../components/hooks/use-app-config-storage';
import {
  RouteLogic,
  useNavigateHelper,
} from '../../components/hooks/use-navigate-helper';

export const loader = () => {
  if (!BUILD_CONFIG.isElectron && !appConfigStorage.get('onBoarding')) {
    // onboarding is off, redirect to index
    return redirect('/');
  }

  return null;
};

export const Component = () => {
  const { jumpToIndex } = useNavigateHelper();
  const [, setOnboarding] = useAppConfigStorage('onBoarding');
  const desktopApi = useServiceOptional(DesktopApiService);

  const openApp = useCallback(() => {
    if (BUILD_CONFIG.isElectron) {
      desktopApi?.handler.ui.handleOpenMainApp().catch(err => {
        console.log('failed to open main app', err);
      });
    } else {
      jumpToIndex(RouteLogic.REPLACE);
      setOnboarding(false);
    }
  }, [jumpToIndex, setOnboarding, desktopApi]);

  return <Onboarding onOpenApp={openApp} />;
};
