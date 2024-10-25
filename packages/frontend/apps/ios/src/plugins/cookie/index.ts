import { registerPlugin } from '@capacitor/core';

import type { CookiePlugin } from './definitions';

const Cookie = registerPlugin<CookiePlugin>('Cookie');

export * from './definitions';
export { Cookie };
