import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowLeft, Link as LinkIcon, MoreHorizontal, Pencil, Plus, Save, Tag, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { SubmitButton, TextField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { eventClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { categoriesQueryOptions, eventsKey, SLUG_REGEX, type Category } from "@/lib/events";
import { hasRole } from "@/lib/session";

export const Route = createFileRoute("/_authed/dashboard/categories")({
  beforeLoad: ({ context }) => {
    if (!hasRole(context.session.user, ["admin"])) throw redirect({ to: "/dashboard" });
  },
  component: CategoriesPage,
});

const columnHelper = createColumnHelper<DataTableFeatures, Category>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "ชื่อหมวดหมู่", cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> }),
  columnHelper.accessor("slug", { header: "ลิงก์", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span> }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">จัดการ</span>,
    cell: ({ row }) => <CategoryActions category={row.original} />,
  }),
]);

function CategoriesPage() {
  const { data, isPending } = useQuery(categoriesQueryOptions);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        icon={Tags}
        title="หมวดหมู่อีเวนต์"
        description="เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มหรือแก้ไขหมวดหมู่ได้ ผู้จัดงานเลือกหมวดหมู่ให้อีเวนต์ของตน"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            เพิ่มหมวดหมู่
          </Button>
        }
      />
      <DataTable columns={columns} data={data ?? []} isLoading={isPending} empty={{ icon: Tags, title: "ยังไม่มีหมวดหมู่" }} />
      <CategoryDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(60, "ยาวเกินไป"),
  slug: z
    .string()
    .trim()
    .refine((v) => v.length >= 2 && v.length <= 60 && SLUG_REGEX.test(v), "ใช้ a-z, 0-9 และ - (2–60 ตัวอักษร)"),
});

function CategoryDialog({
  category,
  open,
  onOpenChange,
}: {
  category?: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: { name: category?.name ?? "", slug: category?.slug ?? "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const body = { name: value.name.trim(), slug: value.slug.trim() };
      const { error } = category
        ? await eventClient.api.events.categories({ id: category.id }).patch(body)
        : await eventClient.api.events.categories.post(body);
      if (error) return void toast.add({ type: "error", title: problemMessage(error) });
      toast.add({ type: "success", title: category ? "บันทึกหมวดหมู่แล้ว" : "เพิ่มหมวดหมู่แล้ว" });
      if (!category) form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-5" />
              {category ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
            </DialogTitle>
            <DialogDescription>ชื่อแสดงในตัวกรองและหน้าอีเวนต์ ลิงก์ใช้ a-z, 0-9 และ - เท่านั้น</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field name="name">{(field) => <TextField field={field} label="ชื่อหมวดหมู่" icon={Tag} autoFocus />}</form.Field>
            <form.Field name="slug">
              {(field) => <TextField field={field} label="ลิงก์ (slug)" icon={LinkIcon} placeholder="music" autoComplete="off" />}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <SubmitButton pending={isSubmitting} icon={category ? Save : Plus}>
                  {category ? "บันทึก" : "เพิ่ม"}
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryActions({ category }: { category: Category }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await eventClient.api.events.categories({ id: category.id }).delete();
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.add({ type: "success", title: `ลบหมวดหมู่ “${category.name}” แล้ว` });
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: eventsKey });
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.add({ type: "error", title: problemMessage(error) });
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />} aria-label={`จัดการ ${category.name}`}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil />
              แก้ไข
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 />
              ลบ
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <CategoryDialog category={category} open={editOpen} onOpenChange={setEditOpen} />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>ลบหมวดหมู่ “{category.name}”?</AlertDialogTitle>
            <AlertDialogDescription>ลบได้เฉพาะหมวดหมู่ที่ไม่มีอีเวนต์ใช้งานอยู่</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              <ArrowLeft data-icon="inline-start" />
              กลับ
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
