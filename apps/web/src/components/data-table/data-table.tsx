import {
  functionalUpdate,
  useTable,
  type ColumnDef,
  type PaginationState,
  type RowData,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { features, type DataTableFeatures } from "./data-table-features";

type DataTableProps<TData extends RowData> = {
  columns: ColumnDef<DataTableFeatures, TData, any>[];
  data: TData[];
  isLoading?: boolean;
  empty: { icon: LucideIcon; title: string; description?: string; action?: ReactNode };
  /** Server-side pagination: the query owns the page state and returns the total row count. */
  pagination?: {
    state: PaginationState;
    onChange: (state: PaginationState) => void;
    rowCount: number;
  };
};

export function DataTable<TData extends RowData>({
  columns,
  data,
  isLoading,
  empty: { icon: EmptyIcon, title, description, action },
  pagination,
}: DataTableProps<TData>) {
  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    ...(pagination && {
      manualPagination: true,
      rowCount: pagination.rowCount,
      state: { pagination: pagination.state },
      onPaginationChange: (updater) => pagination.onChange(functionalUpdate(updater, pagination.state)),
    }),
  });

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(table.getPageCount(), 1);
  const { pageIndex } = table.state.pagination;

  return (
    <div data-slot="data-table" className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={columns.length}>
                    <Skeleton className="h-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <EmptyIcon />
                      </EmptyMedia>
                      <EmptyTitle>{title}</EmptyTitle>
                      {description && <EmptyDescription>{description}</EmptyDescription>}
                    </EmptyHeader>
                    {action && <EmptyContent>{action}</EmptyContent>}
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">
          หน้า {pageIndex + 1} จาก {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft data-icon="inline-start" />
          ก่อนหน้า
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          ถัดไป
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
