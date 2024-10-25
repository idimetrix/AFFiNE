import {
  NoPermissionOrNotFound,
  NotFoundPage,
} from '@affine/component/not-found-page';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { DesktopApiService } from '@affine/core/modules/desktop-api/service';
import {
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { SignOutModal } from '../../components/affine/sign-out-modal';
import {
  RouteLogic,
  useNavigateHelper,
} from '../../components/hooks/use-navigate-helper';
import { AuthService } from '../../modules/cloud';
import { SignIn } from './auth/sign-in';

export const PageNotFound = ({
  noPermission,
}: {
  noPermission?: boolean;
}): ReactElement => {
  const authService = useService(AuthService);
  const desktopApi = useServiceOptional(DesktopApiService);
  const account = useLiveData(authService.session.account$);
  const { jumpToIndex } = useNavigateHelper();
  const [open, setOpen] = useState(false);

  const handleBackButtonClick = useCallback(
    () => jumpToIndex(RouteLogic.REPLACE),
    [jumpToIndex]
  );

  const handleOpenSignOutModal = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  const onConfirmSignOut = useAsyncCallback(async () => {
    setOpen(false);
    await authService.signOut();
  }, [authService]);

  useEffect(() => {
    desktopApi?.handler.ui.pingAppLayoutReady().catch(console.error);
  }, [desktopApi]);

  // not using workbench location or router location deliberately
  // strip the origin
  const currentUrl = window.location.href.replace(window.location.origin, '');

  return (
    <>
      {noPermission ? (
        <NoPermissionOrNotFound
          user={account}
          onBack={handleBackButtonClick}
          onSignOut={handleOpenSignOutModal}
          signInComponent={<SignIn redirectUrl={currentUrl} />}
        />
      ) : (
        <NotFoundPage
          user={account}
          onBack={handleBackButtonClick}
          onSignOut={handleOpenSignOutModal}
        />
      )}

      <SignOutModal
        open={open}
        onOpenChange={setOpen}
        onConfirm={onConfirmSignOut}
      />
    </>
  );
};

export const Component = () => {
  return <PageNotFound />;
};
