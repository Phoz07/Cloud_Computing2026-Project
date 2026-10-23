import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowDown, ArrowUp, ChevronDown, CircleDot, Copy, GripVertical, Lock, Mail, MessageCircleQuestion, MoreHorizontal,
  Plus, Trash2, UserRound, X, type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { TextField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MAX_OPTIONS, MAX_QUESTIONS, questionTypeInfo, type QuestionType } from "@/lib/ticket-types";
import { cn } from "@/lib/utils";
import { emptyQuestion, type QuestionValues, type TicketTypeForm } from "./ticket-type-form";

const SYSTEM_QUESTIONS: { label: string; icon: LucideIcon; hint: string }[] = [
  { label: "ชื่อ", icon: UserRound, hint: "ดึงจากบัญชีผู้ซื้อ แก้ไขได้ตอนลงทะเบียน" },
  { label: "นามสกุล", icon: UserRound, hint: "ดึงจากบัญชีผู้ซื้อ แก้ไขได้ตอนลงทะเบียน" },
  { label: "อีเมล", icon: Mail, hint: "ส่งตั๋วไปที่อีเมลนี้ และแสดงในบัญชีที่ใช้อีเมลนี้" },
];

const questionTypes = Object.entries(questionTypeInfo) as [QuestionType, (typeof questionTypeInfo)[QuestionType]][];
const typeItems = questionTypes.map(([value, { label }]) => ({ value, label }));

/** Focuses a control by id once React has rendered it (ids hold brackets, so no CSS selector). */
const focusLater = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

/**
 * The ticket type's registration form: the fixed first name / last name / email every ticket has,
 * then the organizer's own questions, reordered by dragging the handle (or with the arrow keys
 * after picking it up with space), or from each question's menu.
 * While dragging, the other cards collapse to their header: a choice lists its options and gets
 * much taller than a text question, and between cards that differ that much a swap leaves the
 * pointer over the other card, which swaps them straight back. The dragged card stays as it is
 * (dnd-kit has measured it already), so it doesn't jump away from the pointer.
 */
export function QuestionBuilder({ form, disabled }: { form: TicketTypeForm; disabled?: boolean }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2" aria-label="ข้อมูลพื้นฐานที่ทุกตั๋วต้องกรอก">
        {SYSTEM_QUESTIONS.map(({ label, icon: Icon, hint }) => (
          <li key={label} className="flex items-center gap-3 rounded-3xl border border-dashed bg-muted/50 px-4 py-3 text-sm">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </span>
            <Badge variant="outline">
              <Lock data-icon="inline-start" />
              จำเป็น
            </Badge>
          </li>
        ))}
      </ul>

      <form.Field name="questions" mode="array">
        {(field) => {
          const questions = field.state.value;
          const add = (type: QuestionType) => {
            field.pushValue(emptyQuestion(type));
            focusLater(`questions[${questions.length}].label`);
          };
          return (
            <>
              {questions.length > 0 && (
                <DragDropProvider
                  onDragStart={() => setDragging(true)}
                  onDragEnd={(event) => {
                    setDragging(false);
                    if (event.canceled) return;
                    const { source } = event.operation;
                    if (isSortable(source) && source.initialIndex !== source.index) {
                      field.moveValue(source.initialIndex, source.index);
                    }
                  }}
                >
                  <ol className="flex flex-col gap-3" aria-label="คำถามเพิ่มเติม">
                    {questions.map((question, index) => (
                      <QuestionCard
                        key={question.key}
                        form={form}
                        question={question}
                        index={index}
                        total={questions.length}
                        disabled={disabled}
                        collapsed={dragging}
                        onMove={(to) => field.moveValue(index, to)}
                        onDuplicate={() =>
                          field.insertValue(index + 1, {
                            ...question,
                            key: crypto.randomUUID(),
                            id: undefined,
                            options: [...question.options],
                          })
                        }
                        onRemove={() => field.removeValue(index)}
                      />
                    ))}
                  </ol>
                </DragDropProvider>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button type="button" variant="outline" disabled={disabled || questions.length >= MAX_QUESTIONS} />}
                  >
                    <Plus data-icon="inline-start" />
                    เพิ่มคำถาม
                    <ChevronDown data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuGroup>
                      {questionTypes.map(([type, { label, icon: Icon }]) => (
                        <DropdownMenuItem key={type} onClick={() => add(type)}>
                          <Icon />
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-sm text-muted-foreground">
                  {questions.length === 0
                    ? "ถามข้อมูลเพิ่มจากผู้เข้าร่วมแต่ละคนได้ เช่น ไซซ์เสื้อ หรือข้อจำกัดด้านอาหาร"
                    : `${questions.length} จาก ${MAX_QUESTIONS} คำถาม`}
                </span>
              </div>
              {field.state.meta.errors.length > 0 && <FieldError errors={field.state.meta.errors} />}
            </>
          );
        }}
      </form.Field>
    </div>
  );
}

type QuestionCardProps = {
  form: TicketTypeForm;
  question: QuestionValues;
  index: number;
  total: number;
  disabled?: boolean;
  /** a card is being dragged: the others show only their header row, with the question as text */
  collapsed: boolean;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

function QuestionCard({ form, question, index, total, disabled, collapsed, onMove, onDuplicate, onRemove }: QuestionCardProps) {
  const { ref, handleRef, isDragging } = useSortable({ id: question.key, index, disabled });
  const compact = collapsed && !isDragging;
  const name = `questions[${index}]` as const;
  const TypeIcon = questionTypeInfo[question.type].icon;

  return (
    <li
      ref={ref}
      data-slot="question-card"
      data-dragging={isDragging || undefined}
      className={cn("flex gap-1 rounded-3xl border bg-card py-3 pr-3 pl-1 transition-shadow", isDragging && "shadow-lg")}
    >
      <Button
        ref={handleRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`ลากเพื่อย้ายคำถามข้อ ${index + 1}`}
        disabled={disabled}
      >
        <GripVertical />
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {compact ? (
          <div className="flex h-8 min-w-0 items-center gap-2 text-sm">
            <Badge variant="secondary">ข้อ {index + 1}</Badge>
            <TypeIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{question.label.trim() || "คำถามที่ยังไม่ได้กรอก"}</span>
            {question.required && <span className="shrink-0 text-xs text-muted-foreground">· จำเป็นต้องตอบ</span>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">ข้อ {index + 1}</Badge>
            <form.Field
              name={`${name}.type`}
              listeners={{
                // a choice needs options to start from
                onChange: ({ value }) => {
                  if (value === "choice" && form.getFieldValue(`${name}.options`).length === 0) {
                    form.setFieldValue(`${name}.options`, ["", ""]);
                  }
                },
              }}
            >
              {(field) => (
                <Select
                  items={typeItems}
                  value={field.state.value}
                  onValueChange={(next) => next && field.handleChange(next as QuestionType)}
                  disabled={disabled}
                >
                  <SelectTrigger size="sm" className="w-40" aria-label={`รูปแบบคำตอบของข้อ ${index + 1}`}>
                    <TypeIcon className="text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {questionTypes.map(([type, { label, icon: Icon }]) => (
                        <SelectItem key={type} value={type}>
                          <Icon />
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </form.Field>
            <div className="ml-auto flex items-center gap-1">
              <form.Field name={`${name}.required`}>
                {(field) => (
                  <Field orientation="horizontal" className="w-auto">
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      disabled={disabled}
                    />
                    <FieldLabel htmlFor={field.name} className="font-normal whitespace-nowrap">
                      จำเป็นต้องตอบ
                    </FieldLabel>
                  </Field>
                )}
              </form.Field>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="ghost" size="icon-sm" disabled={disabled} />}
                  aria-label={`จัดการคำถามข้อ ${index + 1}`}
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuGroup>
                    <DropdownMenuItem disabled={index === 0} onClick={() => onMove(index - 1)}>
                      <ArrowUp />
                      เลื่อนขึ้น
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === total - 1} onClick={() => onMove(index + 1)}>
                      <ArrowDown />
                      เลื่อนลง
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={total >= MAX_QUESTIONS} onClick={onDuplicate}>
                      <Copy />
                      ทำสำเนา
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive" onClick={onRemove}>
                      <Trash2 />
                      ลบคำถาม
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
        {/* hidden rather than unmounted while compact, so the inputs keep their state */}
        <div className={cn("flex flex-col gap-4", compact && "hidden")}>
          <form.Field name={`${name}.label`}>
            {(field) => (
              <TextField
                field={field}
                label="คำถาม"
                icon={MessageCircleQuestion}
                placeholder="เช่น ไซซ์เสื้อที่ต้องการ"
                maxLength={200}
                disabled={disabled}
              />
            )}
          </form.Field>
          {question.type === "choice" && <ChoiceOptions form={form} index={index} disabled={disabled} />}
        </div>
      </div>
    </li>
  );
}

function ChoiceOptions({ form, index, disabled }: { form: TicketTypeForm; index: number; disabled?: boolean }) {
  const name = `questions[${index}].options` as const;
  return (
    <form.Field name={name} mode="array">
      {(optionsField) => {
        const options = optionsField.state.value;
        return (
          <FieldSet>
            <FieldLegend variant="label">ตัวเลือก (ผู้ตอบเลือกได้ 1 ข้อ)</FieldLegend>
            <div className="flex flex-col gap-2">
              {options.map((_, optionIndex) => (
                <form.Field key={optionIndex} name={`${name}[${optionIndex}]`}>
                  {(field) => {
                    const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={invalid}>
                        <InputGroup data-disabled={disabled}>
                          <InputGroupAddon>
                            <CircleDot />
                          </InputGroupAddon>
                          <InputGroupInput
                            id={field.name}
                            aria-label={`ตัวเลือกที่ ${optionIndex + 1}`}
                            placeholder={`ตัวเลือกที่ ${optionIndex + 1}`}
                            maxLength={100}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onKeyDown={(e) => {
                              // Enter adds the next option, like most form builders
                              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                              e.preventDefault();
                              if (optionIndex === options.length - 1 && options.length < MAX_OPTIONS) {
                                optionsField.pushValue("");
                              }
                              focusLater(`${name}[${optionIndex + 1}]`);
                            }}
                            aria-invalid={invalid}
                            disabled={disabled}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              size="icon-xs"
                              aria-label={`ลบตัวเลือกที่ ${optionIndex + 1}`}
                              disabled={disabled || options.length <= 2}
                              onClick={() => optionsField.removeValue(optionIndex)}
                            >
                              <X />
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                        {invalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    );
                  }}
                </form.Field>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={disabled || options.length >= MAX_OPTIONS}
              onClick={() => {
                optionsField.pushValue("");
                focusLater(`${name}[${options.length}]`);
              }}
            >
              <Plus data-icon="inline-start" />
              เพิ่มตัวเลือก
            </Button>
            {optionsField.state.meta.errors.length > 0 && <FieldError errors={optionsField.state.meta.errors} />}
          </FieldSet>
        );
      }}
    </form.Field>
  );
}
