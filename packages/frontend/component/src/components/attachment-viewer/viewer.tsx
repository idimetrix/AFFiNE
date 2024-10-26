import type { AttachmentBlockModel } from '@blocksuite/affine/blocks';
import { CollapseIcon, ExpandIcon } from '@blocksuite/icons/rc';
import clsx from 'clsx';
import { debounce } from 'lodash-es';
import type { HTMLAttributes, PropsWithChildren, ReactElement } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';

import { IconButton } from '../../ui/button';
import { Scrollable } from '../../ui/scrollbar';
import * as styles from './styles.css';
// import { observeResize } from '../../utils';
import type { MessageData, MessageDataType } from './worker/types';
import { MessageOp, State } from './worker/types';

const Page = React.memo(
  ({
    width,
    height,
    className,
  }: {
    index: number;
    width: number;
    height: number;
    className: string;
  }) => {
    return (
      <div
        className={className}
        style={{
          width: `${width}px`,
          // height: `${height}px`,
        }}
      >
        <canvas
          style={{ width: '100%', height: '100%' }}
          width={width * 2}
          height={height * 2}
        />
      </div>
    );
  }
);

Page.displayName = 'viewer-page';

const THUMBNAIL_WIDTH = 94;

const Thumbnail = React.memo(
  ({
    index,
    width,
    height,
    className,
    onSelect,
  }: {
    index: number;
    width: number;
    height: number;
    className: string;
    onSelect: (index: number) => void;
  }) => {
    return (
      <div className={className} onClick={() => onSelect(index)}>
        <canvas
          style={{ width: '100%', height: '100%' }}
          width={width * 2}
          height={height * 2}
        />
      </div>
    );
  }
);

Thumbnail.displayName = 'viewer-thumbnail';

const Scroller = React.forwardRef<
  HTMLDivElement,
  PropsWithChildren<HTMLAttributes<HTMLDivElement>>
>(({ style, ...props }, ref) => {
  return (
    <Scrollable.Root>
      <Scrollable.Viewport style={{ ...style }} ref={ref} {...props} />
      <Scrollable.Scrollbar />
    </Scrollable.Root>
  );
});

Scroller.displayName = 'viewer-scroller';

interface ViewerProps {
  model: AttachmentBlockModel;
}

export const Viewer = ({ model }: ViewerProps): ReactElement => {
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [docInfo, setDocInfo] = useState({
    cursor: 0,
    total: 0,
    width: 1,
    height: 1,
  });
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const scrollerHandleRef = useRef<VirtuosoHandle | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const [mainVisibleRange, setMainVisibleRange] = useState({
    startIndex: 0,
    endIndex: 0,
  });

  const [collapsed, setCollapsed] = useState(true);
  const thumbnailsScrollerHandleRef = useRef<VirtuosoHandle | null>(null);
  const thumbnailsScrollerRef = useRef<HTMLElement | null>(null);
  const [thumbnailsVisibleRange, setThumbnailsVisibleRange] = useState({
    startIndex: 0,
    endIndex: 0,
  });

  const post = useCallback(
    <T extends MessageOp>(
      type: T,
      data?: MessageDataType[T],
      transfer = []
    ) => {
      workerRef.current?.postMessage(
        {
          state: State.Pull,
          type,
          [type]: data,
        },
        transfer
      );
    },
    [workerRef]
  );

  const render = useCallback(
    (id: number, imageData: ImageData) => {
      const el = scrollerRef.current;
      if (!el) return;

      const canvas: HTMLCanvasElement | null = el.querySelector(
        `[data-index="${id}"] canvas`
      );
      if (!canvas) return;
      if (canvas.dataset.rendered) return;

      // TODO(@fundon): improve
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        canvas.dataset.rendered = 'true';
      }
    },
    [scrollerRef]
  );

  const renderThumbnail = useCallback(
    (id: number, imageData: ImageData) => {
      const el = thumbnailsScrollerRef.current;
      if (!el) return;

      const canvas: HTMLCanvasElement | null = el.querySelector(
        `[data-index="${id}"] canvas`
      );
      if (!canvas) return;
      if (canvas.dataset.rendered) return;

      // TODO(@fundon): improve
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        canvas.dataset.rendered = 'true';
      }
    },
    [thumbnailsScrollerRef]
  );

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight } = el;

    setDocInfo(info => {
      const cursor = Math.ceil(scrollTop / (scrollHeight / info.total));
      // thumbnailsScrollerHandleRef.current?.scrollToIndex(cursor)
      return {
        ...info,
        cursor,
      };
    });
    // }, [scrollerRef, thumbnailsScrollerHandleRef]);
  }, [scrollerRef]);

  const onSelect = useCallback(
    (index: number) => {
      scrollerHandleRef.current?.scrollToIndex(index);
      setDocInfo(info => ({ ...info, cursor: index }));
    },
    [scrollerHandleRef]
  );

  const updateMainVisibleRange = useMemo(
    () => debounce(setMainVisibleRange, 233, { leading: true, trailing: true }),
    [setMainVisibleRange]
  );

  const updateThumbnailsVisibleRange = useMemo(
    () =>
      debounce(setThumbnailsVisibleRange, 233, {
        leading: true,
        trailing: true,
      }),
    [setThumbnailsVisibleRange]
  );

  // useEffect(() => {
  //   const el = viewerRef.current;
  //   if (!el) return;

  //   return observeResize(el, entry => {
  //     console.log(entry);
  //   });
  // }, []);

  useEffect(() => {
    const { startIndex, endIndex } = mainVisibleRange;
    let index = startIndex;
    for (; index < endIndex + 1; index++) {
      post(MessageOp.Render, { index, kind: 'page' });
    }
  }, [mainVisibleRange, post]);

  useEffect(() => {
    const { startIndex, endIndex } = thumbnailsVisibleRange;
    let index = startIndex;
    for (; index < endIndex + 1; index++) {
      post(MessageOp.Render, { index, kind: 'thumbnail' });
    }
  }, [thumbnailsVisibleRange, post]);

  useEffect(() => {
    workerRef.current = new Worker(
      /* webpackChunkName: "pdf.worker" */ new URL(
        './worker/worker.ts',
        import.meta.url
      )
    );

    async function process({ data }: MessageEvent<MessageData>) {
      const { type, state } = data;

      if (type === MessageOp.Init) {
        setConnected(state === State.Ready);
        return;
      }
      if (type === MessageOp.Open) {
        setLoaded(state === State.Ready);
        return;
      }

      if (state === State.Pull) return;

      switch (type) {
        case MessageOp.ReadInfo: {
          const action = data[type];
          setDocInfo(info => ({ ...info, ...action }));
          break;
        }
        case MessageOp.Rendered: {
          const { index, imageData, kind } = data[type];
          if (kind === 'page') {
            render(index, imageData);
          } else {
            renderThumbnail(index, imageData);
          }
          break;
        }
      }
    }

    workerRef.current.addEventListener('message', event => {
      process(event).catch(console.error);
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, [model, post, render, renderThumbnail]);

  useEffect(() => {
    if (!connected) return;
    if (!model.sourceId) return;

    model.doc.blobSync
      .get(model.sourceId)
      .then(blob => {
        if (!blob) return;
        post(MessageOp.Open, { blob, dpi: window.devicePixelRatio });
      })
      .catch(console.error);
  }, [connected, model, post]);

  useEffect(() => {
    if (!loaded) return;
    post(MessageOp.ReadInfo);
  }, [loaded, post]);

  const pageContent = (index: number) => {
    return (
      <Page
        key={index}
        index={index}
        className={styles.viewerPage}
        width={docInfo.width}
        height={docInfo.height}
      />
    );
  };

  const thumbnailContent = (index: number) => {
    return (
      <Thumbnail
        key={index}
        index={index}
        className={clsx([
          styles.thumbnailsPage,
          { selected: index === docInfo.cursor },
        ])}
        width={THUMBNAIL_WIDTH}
        height={(docInfo.height / docInfo.width) * THUMBNAIL_WIDTH}
        onSelect={onSelect}
      />
    );
  };

  const components = useMemo(() => {
    return {
      Scroller,
    };
  }, []);

  return (
    <div
      className={clsx([
        styles.body,
        {
          gridding: true,
          scrollable: true,
        },
      ])}
      ref={viewerRef}
    >
      <Virtuoso
        onScroll={onScroll}
        ref={scrollerHandleRef}
        scrollerRef={scroller => {
          if (scrollerRef.current) return;
          scrollerRef.current = scroller as HTMLElement;
        }}
        className={styles.virtuoso}
        rangeChanged={updateMainVisibleRange}
        increaseViewportBy={{
          top: docInfo.height * Math.min(5, docInfo.total),
          bottom: docInfo.height * Math.min(5, docInfo.total),
        }}
        totalCount={docInfo.total}
        itemContent={pageContent}
        components={components}
      />
      <div className={styles.thumbnails}>
        {collapsed ? null : (
          <div className={clsx([styles.thumbnailsPages, { collapsed }])}>
            <Virtuoso
              style={{
                height:
                  Math.min(3, docInfo.total) *
                  (docInfo.height / docInfo.width) *
                  THUMBNAIL_WIDTH,
              }}
              ref={thumbnailsScrollerHandleRef}
              scrollerRef={scroller => {
                if (thumbnailsScrollerRef.current) return;
                thumbnailsScrollerRef.current = scroller as HTMLElement;
              }}
              rangeChanged={updateThumbnailsVisibleRange}
              className={styles.virtuoso}
              totalCount={docInfo.total}
              itemContent={thumbnailContent}
              components={components}
            />
          </div>
        )}
        <div className={styles.thumbnailsIndicator}>
          <div>
            <span>{docInfo.cursor + 1}</span>/<span>{docInfo.total}</span>
          </div>
          <IconButton
            icon={collapsed ? <CollapseIcon /> : <ExpandIcon />}
            onClick={() => setCollapsed(state => !state)}
          />
        </div>
      </div>
    </div>
  );
};
