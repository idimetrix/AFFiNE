import type { DesktopApiService } from '@affine/core/modules/desktop-api';
import type { BlobStorage } from '@toeverything/infra';

import { bufferToBlob } from '../../utils/buffer-to-blob';

export class SqliteBlobStorage implements BlobStorage {
  constructor(
    private readonly workspaceId: string,
    private readonly electronApi: DesktopApiService
  ) {}
  name = 'sqlite';
  readonly = false;
  async get(key: string) {
    const buffer = await this.electronApi.handler.db.getBlob(
      'workspace',
      this.workspaceId,
      key
    );
    if (buffer) {
      return bufferToBlob(buffer);
    }
    return null;
  }
  async set(key: string, value: Blob) {
    await this.electronApi.handler.db.addBlob(
      'workspace',
      this.workspaceId,
      key,
      new Uint8Array(await value.arrayBuffer())
    );
    return key;
  }
  delete(key: string) {
    return this.electronApi.handler.db.deleteBlob(
      'workspace',
      this.workspaceId,
      key
    );
  }
  list() {
    return this.electronApi.handler.db.getBlobKeys(
      'workspace',
      this.workspaceId
    );
  }
}
