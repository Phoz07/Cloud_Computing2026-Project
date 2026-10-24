import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { Role } from "@app/auth-guard/permissions";
import { auth } from "./auth-client";

export const adminUsersKey = ["admin", "users"] as const;

export const usersQueryOptions = ({
  pageIndex,
  pageSize,
  search,
}: {
  pageIndex: number;
  pageSize: number;
  search: string;
}) =>
  queryOptions({
    queryKey: [...adminUsersKey, "list", { pageIndex, pageSize, search }],
    queryFn: async () => {
      const { data, error } = await auth.admin.listUsers({
        query: {
          limit: pageSize,
          offset: pageIndex * pageSize,
          sortBy: "createdAt",
          sortDirection: "desc",
          ...(search && { searchValue: search, searchField: "email", searchOperator: "contains" }),
        },
      });
      if (error) throw error;
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const userCountQueryOptions = (role?: Role) =>
  queryOptions({
    queryKey: [...adminUsersKey, "count", role ?? "all"],
    queryFn: async () => {
      const { data, error } = await auth.admin.listUsers({
        query: {
          limit: 1,
          ...(role && { filterField: "role", filterValue: role, filterOperator: "eq" }),
        },
      });
      if (error) throw error;
      return data.total;
    },
  });

export type AdminUser = Awaited<ReturnType<NonNullable<ReturnType<typeof usersQueryOptions>["queryFn"]>>>["users"][number];
