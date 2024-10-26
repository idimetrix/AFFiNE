import type { AttachmentBlockModel } from '@blocksuite/affine/blocks';
import {
  EditIcon,
  LocalDataIcon,
  MoreHorizontalIcon,
  ZoomDownIcon,
  ZoomUpIcon,
} from '@blocksuite/icons/rc';
import clsx from 'clsx';
import { useState } from 'react';

import { IconButton } from '../../ui/button';
import { Menu, MenuItem } from '../../ui/menu';
import * as styles from './styles.css';
import { saveBufferToFile } from './utils';

const items = [
  {
    name: 'Rename',
    icon: <EditIcon />,
    action(_model: AttachmentBlockModel) {},
  },
  {
    name: 'Download',
    icon: <LocalDataIcon />,
    action(model: AttachmentBlockModel) {
      const { sourceId, name } = model;
      if (!sourceId) return;
      saveBufferToFile(sourceId, name).catch(console.error);
    },
  },
];

export const MenuItems = ({ model }: { model: AttachmentBlockModel }) =>
  items.map(({ name, icon, action }) => (
    <MenuItem key={name} onClick={() => action(model)} prefixIcon={icon}>
      {name}
    </MenuItem>
  ));

export interface TitlebarProps {
  model: AttachmentBlockModel;
  name: string;
  ext: string;
  size: string;
  isPDF: boolean;
  zoom?: number;
}

export const Titlebar = ({
  model,
  name,
  ext,
  size,
  zoom = 100,
  isPDF = false,
}: TitlebarProps) => {
  const [openMenu, setOpenMenu] = useState(false);

  return (
    <div className={styles.titlebar}>
      <div className={styles.titlebarChild}>
        <div className={styles.titlebarName}>
          <div>{name}</div>
          <span>.{ext}</span>
        </div>
        <div>{size}</div>
        <IconButton icon={<LocalDataIcon />}></IconButton>
        <Menu
          items={<MenuItems model={model} />}
          rootOptions={{
            open: openMenu,
            onOpenChange: setOpenMenu,
          }}
          contentOptions={{
            side: 'bottom',
            align: 'center',
            avoidCollisions: false,
          }}
        >
          <IconButton icon={<MoreHorizontalIcon />}></IconButton>
        </Menu>
      </div>
      <div
        className={clsx([
          styles.titlebarChild,
          'zoom',
          {
            show: isPDF,
          },
        ])}
      >
        <IconButton icon={<ZoomDownIcon />}></IconButton>
        <div>{zoom}%</div>
        <IconButton icon={<ZoomUpIcon />}></IconButton>
      </div>
    </div>
  );
};
