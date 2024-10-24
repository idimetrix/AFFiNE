import { DebugLogger } from '@affine/debug';

import { channelToScheme } from './constant';

const logger = new DebugLogger('open-in-app');

// return an AFFiNE app's url to be opened in desktop app
export const getOpenUrlInDesktopAppLink = (
  url: string,
  newTab = false,
  scheme = channelToScheme[BUILD_CONFIG.appBuildType]
) => {
  if (!scheme) {
    return null;
  }

  const urlObject = new URL(url);
  const params = urlObject.searchParams;

  if (newTab) {
    params.set('new-tab', '1');
  }

  try {
    return new URL(
      `${scheme}://${urlObject.host}${urlObject.pathname}?${params.toString()}#${urlObject.hash}`
    ).toString();
  } catch (e) {
    logger.error('Failed to get open url in desktop app link', e);
    return null;
  }
};
