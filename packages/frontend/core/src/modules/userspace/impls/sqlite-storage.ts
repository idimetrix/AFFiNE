import type { ClientHandler } from '@affine/electron-api';
import type {
  ByteKV,
  ByteKVBehavior,
  DocEvent,
  DocEventBus,
  DocStorage,
} from '@toeverything/infra';
import { AsyncLock } from '@toeverything/infra';
import type { DesktopApiService } from '../../desktop-api';

class BroadcastChannelDocEventBus implements DocEventBus {
  senderChannel = new BroadcastChannel('user-db:' + this.userId);
  constructor(private readonly userId: string) {}
  emit(event: DocEvent): void {
    this.senderChannel.postMessage(event);
  }

  on(cb: (event: DocEvent) => void): () => void {
    const listener = (event: MessageEvent<DocEvent>) => {
      cb(event.data);
    };
    const channel = new BroadcastChannel('user-db:' + this.userId);
    channel.addEventListener('message', listener);
    return () => {
      channel.removeEventListener('message', listener);
      channel.close();
    };
  }
}

export class SqliteUserspaceDocStorage implements DocStorage {
  constructor(
    private readonly userId: string,
    private readonly electronApi: DesktopApiService
  ) {}
  eventBus = new BroadcastChannelDocEventBus(this.userId);
  readonly doc = new Doc(this.userId, this.electronApi);
  readonly syncMetadata = new SyncMetadataKV(this.userId, this.electronApi);
  readonly serverClock = new ServerClockKV(this.userId, this.electronApi);
}

type DocType = DocStorage['doc'];

class Doc implements DocType {
  lock = new AsyncLock();
  apis = this.electronApi.api.handler;

  constructor(
    private readonly userId: string,
    private readonly electronApi: DesktopApiService
  ) {}

  async transaction<T>(
    cb: (transaction: ByteKVBehavior) => Promise<T>
  ): Promise<T> {
    using _lock = await this.lock.acquire();
    return await cb(this);
  }

  keys(): string[] | Promise<string[]> {
    return [];
  }

  async get(docId: string) {
    const update = await this.apis.db.getDocAsUpdates(
      'userspace',
      this.userId,
      docId
    );

    if (update) {
      if (
        update.byteLength === 0 ||
        (update.byteLength === 2 && update[0] === 0 && update[1] === 0)
      ) {
        return null;
      }

      return update;
    }

    return null;
  }

  async set(docId: string, data: Uint8Array) {
    await this.apis.db.applyDocUpdate('userspace', this.userId, data, docId);
  }

  clear(): void | Promise<void> {
    return;
  }

  async del(docId: string) {
    await this.apis.db.deleteDoc('userspace', this.userId, docId);
  }
}

class SyncMetadataKV implements ByteKV {
  apis = this.electronApi.api.handler;
  constructor(
    private readonly userId: string,
    private readonly electronApi: DesktopApiService
  ) {}
  transaction<T>(cb: (behavior: ByteKVBehavior) => Promise<T>): Promise<T> {
    return cb(this);
  }

  get(key: string): Uint8Array | null | Promise<Uint8Array | null> {
    return this.apis.db.getSyncMetadata('userspace', this.userId, key);
  }

  set(key: string, data: Uint8Array): void | Promise<void> {
    return this.apis.db.setSyncMetadata('userspace', this.userId, key, data);
  }

  keys(): string[] | Promise<string[]> {
    return this.apis.db.getSyncMetadataKeys('userspace', this.userId);
  }

  del(key: string): void | Promise<void> {
    return this.apis.db.delSyncMetadata('userspace', this.userId, key);
  }

  clear(): void | Promise<void> {
    return this.apis.db.clearSyncMetadata('userspace', this.userId);
  }
}

class ServerClockKV implements ByteKV {
  apis = this.electronApi.api.handler;
  constructor(
    private readonly userId: string,
    private readonly electronApi: DesktopApiService
  ) {}
  transaction<T>(cb: (behavior: ByteKVBehavior) => Promise<T>): Promise<T> {
    return cb(this);
  }

  get(key: string): Uint8Array | null | Promise<Uint8Array | null> {
    return this.apis.db.getServerClock('userspace', this.userId, key);
  }

  set(key: string, data: Uint8Array): void | Promise<void> {
    return this.apis.db.setServerClock('userspace', this.userId, key, data);
  }

  keys(): string[] | Promise<string[]> {
    return this.apis.db.getServerClockKeys('userspace', this.userId);
  }

  del(key: string): void | Promise<void> {
    return this.apis.db.delServerClock('userspace', this.userId, key);
  }

  clear(): void | Promise<void> {
    return this.apis.db.clearServerClock('userspace', this.userId);
  }
}
