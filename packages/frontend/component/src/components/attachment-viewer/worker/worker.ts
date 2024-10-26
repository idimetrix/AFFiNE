import { DebugLogger } from '@affine/debug';
import type { Document } from '@toeverything/pdf-viewer';
import {
  createPDFium,
  PageRenderingflags,
  Runtime,
  Viewer,
} from '@toeverything/pdf-viewer';

import type { MessageData, MessageDataType } from './types';
import { MessageOp, State } from './types';

const logger = new DebugLogger('affine:pdf-worker');

let dpi = 2;
let inited = false;
let viewer: Viewer | null = null;
let doc: Document | undefined = undefined;

const cached = new Map<number, ImageData>();
const docInfo = { cursor: 0, total: 0, width: 1, height: 1 };
const flags = PageRenderingflags.REVERSE_BYTE_ORDER | PageRenderingflags.ANNOT;

function post<T extends MessageOp>(type: T, data?: MessageDataType[T]) {
  self.postMessage({ state: State.Ready, type, [type]: data });
}

async function resizeImageData(
  imageData: ImageData,
  options: {
    resizeWidth: number;
    resizeHeight: number;
  }
) {
  const { resizeWidth: w, resizeHeight: h } = options;
  const bitmap = await createImageBitmap(
    imageData,
    0,
    0,
    imageData.width,
    imageData.height,
    options
  );
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageData;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

async function start() {
  logger.debug('pdf worker pending');
  self.postMessage({ state: State.Pull, type: MessageOp.Init });

  const pdfium = await createPDFium();
  viewer = new Viewer(new Runtime(pdfium));
  inited = true;

  self.postMessage({ state: State.Ready, type: MessageOp.Init });
  logger.debug('pdf worker ready');
}

async function process({ data }: MessageEvent<MessageData>) {
  if (!inited || !viewer) {
    await start();
    return;
  }

  const { type, state } = data;

  if (state !== State.Pull) return;

  if (type === MessageOp.Open) {
    const action = data[type];
    if (!action?.blob) return;

    dpi = action.dpi;
    doc = await viewer.openWithBlob(action.blob);

    if (doc) {
      post(MessageOp.Open);
    }

    return;
  }

  if (!doc) return;

  switch (type) {
    case MessageOp.ReadInfo: {
      const page = doc.page(0);
      if (page) {
        docInfo.cursor = 0;
        docInfo.total = doc.pageCount();
        docInfo.height = page.height();
        docInfo.width = page.width();
        page.close();
        post(MessageOp.ReadInfo, docInfo);
      }
      break;
    }

    case MessageOp.Render: {
      const { index, kind } = data[type];

      let imageData = cached.size > 0 ? cached.get(index) : undefined;
      if (imageData) {
        if (kind === 'thumbnail') {
          const resizeWidth = (94 * dpi) >> 0;
          const resizeHeight =
            ((docInfo.height / docInfo.width) * resizeWidth) >> 0;
          imageData = await resizeImageData(imageData, {
            resizeWidth,
            resizeHeight,
          });
        }

        post(MessageOp.Rendered, { index, imageData, kind });
        return;
      }

      const width = Math.ceil(docInfo.width * dpi);
      const height = Math.ceil(docInfo.height * dpi);
      const page = doc.page(index);

      if (page) {
        const bitmap = viewer.createBitmap(width, height, 0);
        bitmap.fill(0, 0, width, height);
        page.render(bitmap, 0, 0, width, height, 0, flags);

        const data = bitmap.toBytes();

        bitmap.close();
        page.close();

        imageData = new ImageData(new Uint8ClampedArray(data), width, height);

        cached.set(index, imageData);

        if (kind === 'thumbnail') {
          const resizeWidth = (94 * dpi) >> 0;
          const resizeHeight =
            ((docInfo.height / docInfo.width) * resizeWidth) >> 0;
          imageData = await resizeImageData(imageData, {
            resizeWidth,
            resizeHeight,
          });
        }

        post(MessageOp.Rendered, { index, imageData, kind });
      }

      break;
    }
  }
}

self.addEventListener('message', (event: MessageEvent<MessageData>) => {
  process(event).catch(console.error);
});

start().catch(console.error);
