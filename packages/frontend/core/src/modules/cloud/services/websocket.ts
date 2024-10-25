import { ApplicationStarted, OnEvent, Service } from '@toeverything/infra';
import { Manager } from 'socket.io-client';

import type { WebSocketAuthProvider } from '../provider/websocket-auth';
import { getAffineCloudBaseUrl } from '../services/fetch';
import type { AuthService } from './auth';
import { AccountChanged } from './auth';

@OnEvent(AccountChanged, e => e.update)
@OnEvent(ApplicationStarted, e => e.update)
export class WebSocketService extends Service {
  ioManager: Manager = new Manager(`${getAffineCloudBaseUrl()}/`, {
    autoConnect: false,
    transports: ['websocket'],
    secure: location.protocol === 'https:',
  });
  socket = this.ioManager.socket('/', {
    auth: this.webSocketAuthProvider
      ? cb => {
          this.webSocketAuthProvider
            ?.getAuthToken(`${getAffineCloudBaseUrl()}/`)
            .then(v => {
              cb(v ?? {});
            })
            .catch(e => {
              console.error('Failed to get auth token for websocket', e);
            });
        }
      : undefined,
  });
  refCount = 0;

  webSocketAuthProvider?: WebSocketAuthProvider;

  constructor(
    private readonly authService: AuthService,
    webSocketAuthProvider: WebSocketAuthProvider[]
  ) {
    super();
    this.webSocketAuthProvider = webSocketAuthProvider.at(0);
  }

  /**
   * Connect socket, with automatic connect and reconnect logic.
   * External code should not call `socket.connect()` or `socket.disconnect()` manually.
   * When socket is no longer needed, call `dispose()` to clean up resources.
   */
  connect() {
    this.refCount++;
    this.update();
    return {
      socket: this.socket,
      dispose: () => {
        this.refCount--;
        this.update();
      },
    };
  }

  update(): void {
    if (this.authService.session.account$.value && this.refCount > 0) {
      this.socket.connect();
    } else {
      this.socket.disconnect();
    }
  }
}
