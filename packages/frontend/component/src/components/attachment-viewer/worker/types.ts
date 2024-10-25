export enum State {
  Pull,
  Ready,
}

export enum MessageOp {
  Init,
  Open,
  ReadInfo,
  Render,
  Rendered,
}

export type MessageDataMap = {
  [MessageOp.Init]: undefined;
  [MessageOp.Open]: { blob: Blob; dpi: number };
  [MessageOp.ReadInfo]: { total: number; width: number; height: number };
  [MessageOp.Render]: { index: number; kind: 'page' | 'thumbnail' };
  [MessageOp.Rendered]: {
    index: number;
    imageData: ImageData;
    kind: 'page' | 'thumbnail';
  };
};

export type MessageDataType<T = MessageDataMap> = {
  [P in keyof T]: T[P];
};

export type MessageData<T = MessageOp, P = MessageDataType> = {
  state: State;
  type: T;
} & P;
