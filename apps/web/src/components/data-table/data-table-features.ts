import { createPaginatedRowModel, rowPaginationFeature, tableFeatures } from "@tanstack/react-table";

// Shared by every DataTable. Anything not registered here is tree-shaken out.
// Server-paginated tables set `manualPagination`, which skips the paginated row model.
export const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

export type DataTableFeatures = typeof features;
