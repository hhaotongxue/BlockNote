import {
  TableCellButton,
  TableHandlesController,
  type TableCellButtonProps,
} from "@blocknote/react";
import { EllipsisVertical } from "lucide-react";

function CellMenuButton(props: TableCellButtonProps) {
  return (
    <TableCellButton {...props}>
      <EllipsisVertical
        className="bn-preset-cell-menu-icon"
        size={14}
        aria-label="单元格设置"
      />
    </TableCellButton>
  );
}

/** Native table actions with a compact menu trigger on the cell border. */
export function BlockNoteTableHandles() {
  return (
    <TableHandlesController
      tableCellHandle={CellMenuButton}
      tableCellHandlePosition="right"
    />
  );
}
