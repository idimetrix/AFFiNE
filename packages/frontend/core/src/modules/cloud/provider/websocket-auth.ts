import { createIdentifier } from '@toeverything/infra';

export interface WebSocketAuthProvider {
  /**
   * Returns the token and userId for WebSocket authentication
   *
   * Useful when cookies are not available for WebSocket connections
   *
   * @param url - The URL of the WebSocket endpoint
   */
  getAuthToken: (url: string) => Promise<
    | {
        token?: string;
        userId?: string;
      }
    | undefined
  >;
}

export const WebSocketAuthProvider = createIdentifier<WebSocketAuthProvider>(
  'WebSocketAuthProvider'
);
