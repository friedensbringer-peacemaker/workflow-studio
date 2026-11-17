import type { CSSProperties } from 'react';
import gear from './assets/icons/phosphor/gear.svg';
import plus from './assets/icons/phosphor/plus.svg';
import refresh from './assets/icons/phosphor/arrows-clockwise.svg';
import up from './assets/icons/phosphor/arrow-up.svg';
import down from './assets/icons/phosphor/arrow-down.svg';
import undo from './assets/icons/phosphor/arrow-u-up-left.svg';
import close from './assets/icons/phosphor/x.svg';
import record from './assets/icons/phosphor/record.svg';
import check from './assets/icons/phosphor/check-circle.svg';
import next from './assets/icons/phosphor/caret-right.svg';
import download from './assets/icons/phosphor/download-simple.svg';
import monitor from './assets/icons/phosphor/monitor.svg';
import shield from './assets/icons/phosphor/shield-check.svg';
import flow from './assets/icons/phosphor/flow-arrow.svg';
import sparkle from './assets/icons/phosphor/sparkle.svg';
import edit from './assets/icons/phosphor/note-pencil.svg';
import save from './assets/icons/phosphor/floppy-disk.svg';

const icons = { gear, plus, refresh, up, down, undo, close, record, check, next, download, monitor, shield, flow, sparkle, edit, save };

/** Approved local Phosphor Light assets. Labels belong to the parent control. */
export function StudioIcon({ name }: { name: keyof typeof icons }) {
  return <span className="studio-icon" aria-hidden="true" style={{ '--studio-icon': `url("${icons[name]}")` } as CSSProperties}/>;
}
