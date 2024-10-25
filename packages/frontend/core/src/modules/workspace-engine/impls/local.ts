import { DebugLogger } from '@affine/debug';
import { WorkspaceFlavour } from '@affine/env/workspace';
import { DocCollection } from '@blocksuite/affine/store';
import type {
  BlobStorage,
  DocStorage,
  WorkspaceEngineProvider,
  WorkspaceFlavourProvider,
  WorkspaceMetadata,
  WorkspaceProfileInfo,
} from '@toeverything/infra';
import {
  getAFFiNEWorkspaceSchema,
  LiveData,
  Service,
} from '@toeverything/infra';
import { isEqual } from 'lodash-es';
import { nanoid } from 'nanoid';
import { Observable } from 'rxjs';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';

import { DesktopApiService } from '../../desktop-api';
import type { WorkspaceEngineStorageProvider } from '../providers/engine';
import { BroadcastChannelAwarenessConnection } from './engine/awareness-broadcast-channel';
import { StaticBlobStorage } from './engine/blob-static';

export const LOCAL_WORKSPACE_LOCAL_STORAGE_KEY = 'affine-local-workspace';
const LOCAL_WORKSPACE_CHANGED_BROADCAST_CHANNEL_KEY =
  'affine-local-workspace-changed';

const logger = new DebugLogger('local-workspace');

export function getLocalWorkspaceIds(): string[] {
  try {
    return JSON.parse(
      localStorage.getItem(LOCAL_WORKSPACE_LOCAL_STORAGE_KEY) ?? '[]'
    );
  } catch (e) {
    logger.error('Failed to get local workspace ids', e);
    return [];
  }
}

export function setLocalWorkspaceIds(
  idsOrUpdater: string[] | ((ids: string[]) => string[])
) {
  localStorage.setItem(
    LOCAL_WORKSPACE_LOCAL_STORAGE_KEY,
    JSON.stringify(
      typeof idsOrUpdater === 'function'
        ? idsOrUpdater(getLocalWorkspaceIds())
        : idsOrUpdater
    )
  );
}

export class LocalWorkspaceFlavourProvider
  extends Service
  implements WorkspaceFlavourProvider
{
  constructor(
    private readonly storageProvider: WorkspaceEngineStorageProvider
  ) {
    super();
  }

  flavour: WorkspaceFlavour = WorkspaceFlavour.LOCAL;
  notifyChannel = new BroadcastChannel(
    LOCAL_WORKSPACE_CHANGED_BROADCAST_CHANNEL_KEY
  );

  async deleteWorkspace(id: string): Promise<void> {
    setLocalWorkspaceIds(ids => ids.filter(x => x !== id));

    const electronApi = this.framework.getOptional(DesktopApiService);

    if (BUILD_CONFIG.isElectron && electronApi) {
      await electronApi.handler.workspace.delete(id);
    }

    // notify all browser tabs, so they can update their workspace list
    this.notifyChannel.postMessage(id);
  }
  async createWorkspace(
    initial: (
      docCollection: DocCollection,
      blobStorage: BlobStorage,
      docStorage: DocStorage
    ) => Promise<void>
  ): Promise<WorkspaceMetadata> {
    const id = nanoid();

    // save the initial state to local storage, then sync to cloud
    const blobStorage = this.storageProvider.getBlobStorage(id);
    const docStorage = this.storageProvider.getDocStorage(id);

    const docCollection = new DocCollection({
      id: id,
      idGenerator: () => nanoid(),
      schema: getAFFiNEWorkspaceSchema(),
      blobSources: { main: blobStorage },
    });

    // apply initial state
    await initial(docCollection, blobStorage, docStorage);

    // save workspace to local storage, should be vary fast
    await docStorage.doc.set(id, encodeStateAsUpdate(docCollection.doc));
    for (const subdocs of docCollection.doc.getSubdocs()) {
      await docStorage.doc.set(subdocs.guid, encodeStateAsUpdate(subdocs));
    }

    // save workspace id to local storage
    setLocalWorkspaceIds(ids => [...ids, id]);

    // notify all browser tabs, so they can update their workspace list
    this.notifyChannel.postMessage(id);

    return { id, flavour: WorkspaceFlavour.LOCAL };
  }
  workspaces$ = LiveData.from(
    new Observable<WorkspaceMetadata[]>(subscriber => {
      let last: WorkspaceMetadata[] | null = null;
      const emit = () => {
        const value = getLocalWorkspaceIds().map(id => ({
          id,
          flavour: WorkspaceFlavour.LOCAL,
        }));
        if (isEqual(last, value)) return;
        subscriber.next(value);
        last = value;
      };

      emit();
      const channel = new BroadcastChannel(
        LOCAL_WORKSPACE_CHANGED_BROADCAST_CHANNEL_KEY
      );
      channel.addEventListener('message', emit);

      return () => {
        channel.removeEventListener('message', emit);
        channel.close();
      };
    }),
    []
  );
  isRevalidating$ = new LiveData(false);
  revalidate(): void {
    // notify livedata to re-scan workspaces
    this.notifyChannel.postMessage(null);
  }

  async getWorkspaceProfile(
    id: string
  ): Promise<WorkspaceProfileInfo | undefined> {
    const docStorage = this.storageProvider.getDocStorage(id);
    const localData = await docStorage.doc.get(id);

    if (!localData) {
      return {
        isOwner: true,
      };
    }

    const bs = new DocCollection({
      id,
      schema: getAFFiNEWorkspaceSchema(),
    });

    if (localData) applyUpdate(bs.doc, localData);

    return {
      name: bs.meta.name,
      avatar: bs.meta.avatar,
      isOwner: true,
    };
  }
  getWorkspaceBlob(id: string, blob: string): Promise<Blob | null> {
    return this.storageProvider.getBlobStorage(id).get(blob);
  }

  getEngineProvider(workspaceId: string): WorkspaceEngineProvider {
    return {
      getAwarenessConnections() {
        return [new BroadcastChannelAwarenessConnection(workspaceId)];
      },
      getDocServer() {
        return null;
      },
      getDocStorage: () => {
        return this.storageProvider.getDocStorage(workspaceId);
      },
      getLocalBlobStorage: () => {
        return this.storageProvider.getBlobStorage(workspaceId);
      },
      getRemoteBlobStorages() {
        return [new StaticBlobStorage()];
      },
    };
  }
}
