import type { DesktopApiService } from '@affine/core/modules/desktop-api';
import type { ByteKV, ByteKVBehavior, DocStorage } from '@toeverything/infra';
import { AsyncLock } from '@toeverything/infra';

import { BroadcastChannelDocEventBus } from './doc-broadcast-channel';

export class SqliteDocStorage implements DocStorage {
  constructor(
    private readonly workspaceId: string,
    private readonly electronApi: DesktopApiService
  ) {}
  eventBus = new BroadcastChannelDocEventBus(this.workspaceId);
  readonly doc = new Doc(this.workspaceId, this.electronApi);
  readonly syncMetadata = new SyncMetadataKV(
    this.workspaceId,
    this.electronApi
  );
  readonly serverClock = new ServerClockKV(this.workspaceId, this.electronApi);
}

type DocType = DocStorage['doc'];

class Doc implements DocType {
  lock = new AsyncLock();
  apis = this.electronApi.handler;
  constructor(
    private readonly workspaceId: string,
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
      'workspace',
      this.workspaceId,
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
    await this.apis.db.applyDocUpdate(
      'workspace',
      this.workspaceId,
      data,
      docId
    );
  }

  clear(): void | Promise<void> {
    return;
  }

  async del(docId: string) {
    await this.apis.db.deleteDoc('workspace', this.workspaceId, docId);
  }
}

class SyncMetadataKV implements ByteKV {
  apis = this.electronApi.handler;
  constructor(
    private readonly workspaceId: string,
    private readonly electronApi: DesktopApiService
  ) {}
  transaction<T>(cb: (behavior: ByteKVBehavior) => Promise<T>): Promise<T> {
    return cb(this);
  }

  get(key: string): Uint8Array | null | Promise<Uint8Array | null> {
    return this.apis.db.getSyncMetadata('workspace', this.workspaceId, key);
  }

  set(key: string, data: Uint8Array): void | Promise<void> {
    return this.apis.db.setSyncMetadata(
      'workspace',
      this.workspaceId,
      key,
      data
    );
  }

  keys(): string[] | Promise<string[]> {
    return this.apis.db.getSyncMetadataKeys('workspace', this.workspaceId);
  }

  del(key: string): void | Promise<void> {
    return this.apis.db.delSyncMetadata('workspace', this.workspaceId, key);
  }

  clear(): void | Promise<void> {
    return this.apis.db.clearSyncMetadata('workspace', this.workspaceId);
  }
}

class ServerClockKV implements ByteKV {
  apis = this.electronApi.handler;
  constructor(
    private readonly workspaceId: string,
    private readonly electronApi: DesktopApiService
  ) {}
  transaction<T>(cb: (behavior: ByteKVBehavior) => Promise<T>): Promise<T> {
    return cb(this);
  }

  get(key: string): Uint8Array | null | Promise<Uint8Array | null> {
    return this.apis.db.getServerClock('workspace', this.workspaceId, key);
  }

  set(key: string, data: Uint8Array): void | Promise<void> {
    return this.apis.db.setServerClock(
      'workspace',
      this.workspaceId,
      key,
      data
    );
  }

  keys(): string[] | Promise<string[]> {
    return this.apis.db.getServerClockKeys('workspace', this.workspaceId);
  }

  del(key: string): void | Promise<void> {
    return this.apis.db.delServerClock('workspace', this.workspaceId, key);
  }

  clear(): void | Promise<void> {
    return this.apis.db.clearServerClock('workspace', this.workspaceId);
  }
}
