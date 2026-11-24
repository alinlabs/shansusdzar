import { useId, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router';
import { AdminPageHeader } from '../../pages/admin/admin-shell';
import { Button } from '../ui/button';
import {
  Checkbox,
  CurrencyInput,
  DatePicker,
  FormField,
  Input,
  PhoneInput,
  Select,
  Textarea,
  type PhoneValueFormat,
} from '../ui/form-controls';

export interface AdminFormFieldOption {
  value: string;
  label: string;
}

export type AdminFormFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'tel'
  | 'date'
  | 'time'
  | 'email'
  | 'url'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'custom';

export interface AdminFormRenderContext<TValues> {
  values: TValues;
  setValues: (updater: TValues | ((prev: TValues) => TValues)) => void;
  setFieldValue: <K extends keyof TValues>(field: K, value: TValues[K]) => void;
  errors: Partial<Record<string, string>>;
  readOnly: boolean;
}

export interface AdminFormFieldConfig<TValues> {
  name: keyof TValues & string;
  label: string;
  type: AdminFormFieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string | ((values: TValues) => string | undefined);
  colSpan?: 1 | 2 | 3 | 'full';
  disabled?: boolean | ((values: TValues) => boolean);
  rows?: number;
  autoGrowMaxRows?: number;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  zeroAsEmpty?: boolean;
  phoneValueFormat?: PhoneValueFormat;
  minDate?: string;
  maxDate?: string;
  searchable?: boolean | 'auto';
  options?: readonly AdminFormFieldOption[] | ((values: TValues) => readonly AdminFormFieldOption[]);
  checkboxDescription?: string;
  visibleWhen?: (values: TValues) => boolean;
  onValueChange?: (nextValue: TValues[keyof TValues], prevValues: TValues) => Partial<TValues> | void;
  render?: (ctx: AdminFormRenderContext<TValues> & { id: string; error?: string }) => ReactNode;
}

export interface AdminFormSectionConfig<TValues> {
  id: string;
  title: string;
  description?: string;
  columns?: 1 | 2 | 3;
  visibleWhen?: (values: TValues) => boolean;
  fields?: readonly AdminFormFieldConfig<TValues>[];
  renderContent?: (ctx: AdminFormRenderContext<TValues>) => ReactNode;
  headerAction?: (ctx: AdminFormRenderContext<TValues>) => ReactNode;
}

export function AdminFormSectionCard({
  title,
  description,
  headerAction,
  children,
}: {
  title: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="p-4 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">{title}</h2>
          {description && <p className="text-xs text-[var(--text-muted)]">{description}</p>}
        </div>
        {headerAction}
      </div>
      {children}
    </section>
  );
}

export interface AdminFormProps<TValues> {
  title: string;
  description?: string;
  backTo: string;
  backLabel?: string;
  submitLabel?: string;
  cancelLabel?: string;
  values: TValues;
  onChange: (updater: TValues | ((prev: TValues) => TValues)) => void;
  sections: readonly AdminFormSectionConfig<TValues>[];
  onSubmit: (event: FormEvent) => void;
  formError?: string | null;
  fieldErrors?: Partial<Record<string, string>>;
  readOnly?: boolean;
  readOnlyNotice?: string;
  isSubmitting?: boolean;
  aside?: ReactNode;
  extraHeaderActions?: ReactNode;
  notFoundState?: {
    title: string;
    message: string;
  };
}

function getGridColumnsClass(columns: 1 | 2 | 3 = 2): string {
  if (columns === 1) return 'grid grid-cols-1 gap-4';
  if (columns === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
  return 'grid grid-cols-1 sm:grid-cols-2 gap-4';
}

function getColSpanClass(colSpan: 1 | 2 | 3 | 'full' | undefined, columns: 1 | 2 | 3 = 2): string {
  if (!colSpan || colSpan === 1) return '';
  if (colSpan === 'full') return 'col-span-full';
  if (colSpan === 2) return columns === 3 ? 'sm:col-span-2' : 'sm:col-span-2';
  return 'col-span-full';
}

export function AdminForm<TValues extends object>({
  title,
  description,
  backTo,
  backLabel = 'Kembali ke Daftar',
  submitLabel = 'Simpan Perubahan',
  cancelLabel = 'Batal',
  values,
  onChange,
  sections,
  onSubmit,
  formError,
  fieldErrors = {},
  readOnly = false,
  readOnlyNotice = 'Akun Anda hanya memiliki akses baca pada halaman ini.',
  isSubmitting = false,
  aside,
  extraHeaderActions,
  notFoundState,
}: AdminFormProps<TValues>) {
  const formId = useId();

  if (notFoundState) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <AdminPageHeader
          title={notFoundState.title}
          description={notFoundState.message}
          actions={
            <Link
              to={backTo}
              aria-label={backLabel}
              title={backLabel}
              className="inline-flex items-center justify-center gap-1.5 size-9 sm:w-auto sm:h-8 sm:px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          }
        />
        <div className="p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-3 max-w-xl">
          <p className="text-sm font-semibold text-[var(--text)]">{notFoundState.title}</p>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{notFoundState.message}</p>
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const setFieldValue = <K extends keyof TValues>(field: K, value: TValues[K]) => {
    onChange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const renderCtx: AdminFormRenderContext<TValues> = {
    values,
    setValues: onChange,
    setFieldValue,
    errors: fieldErrors,
    readOnly,
  };

  const handleFieldUpdate = (field: AdminFormFieldConfig<TValues>, nextValue: unknown) => {
    onChange((prev) => {
      const baseNext = {
        ...prev,
        [field.name]: nextValue,
      } as TValues;
      if (field.onValueChange) {
        const extraPatch = field.onValueChange(nextValue as TValues[keyof TValues], prev);
        if (extraPatch && typeof extraPatch === 'object') {
          return { ...baseNext, ...extraPatch };
        }
      }
      return baseNext;
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <>
            <Link
              to={backTo}
              aria-label={backLabel}
              title={backLabel}
              className="inline-flex items-center justify-center gap-1.5 size-9 sm:w-auto sm:h-8 sm:px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
            {extraHeaderActions}
            {!readOnly && (
              <Button
                type="submit"
                form={formId}
                variant="primary"
                size="sm"
                aria-label={submitLabel}
                title={submitLabel}
                disabled={isSubmitting}
                className="min-h-9 px-3 sm:min-h-8 sm:px-3.5"
              >
                <Save className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">Simpan</span>
                <span className="hidden sm:inline">{submitLabel}</span>
              </Button>
            )}
          </>
        }
      />

      {readOnly && (
        <div
          role="status"
          className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]"
        >
          {readOnlyNotice}
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="p-3.5 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-xs font-medium text-[var(--danger)]"
        >
          {formError}
        </div>
      )}

      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5 sm:space-y-6">
        <div className={aside ? 'grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start' : 'space-y-5 sm:space-y-6 max-w-6xl'}>
          <div className={aside ? 'xl:col-span-8 space-y-5 sm:space-y-6' : 'space-y-5 sm:space-y-6'}>
            {sections.map((section) => {
              if (section.visibleWhen && !section.visibleWhen(values)) return null;
              const columns = section.columns ?? 2;

              return (
                <AdminFormSectionCard
                  key={section.id}
                  title={section.title}
                  description={section.description}
                  headerAction={section.headerAction?.(renderCtx)}
                >
                  {section.fields && section.fields.length > 0 && (
                    <div className={getGridColumnsClass(columns)}>
                      {section.fields.map((field) => {
                        if (field.visibleWhen && !field.visibleWhen(values)) return null;

                        const fieldId = `${formId}-${section.id}-${field.name}`;
                        const rawValue = values[field.name];
                        const error = fieldErrors[field.name];
                        const isDisabled =
                          readOnly ||
                          (typeof field.disabled === 'function'
                            ? field.disabled(values)
                            : Boolean(field.disabled));
                        const resolvedHint =
                          typeof field.hint === 'function' ? field.hint(values) : field.hint;
                        const spanClass = getColSpanClass(field.colSpan, columns);

                        if (field.type === 'custom' && field.render) {
                          return (
                            <div key={field.name} className={spanClass}>
                              {field.render({ ...renderCtx, id: fieldId, error })}
                            </div>
                          );
                        }

                        if (field.type === 'checkbox') {
                          return (
                            <div key={field.name} className={spanClass}>
                              <Checkbox
                                id={fieldId}
                                label={field.label}
                                description={field.checkboxDescription}
                                disabled={isDisabled}
                                checked={Boolean(rawValue)}
                                onChange={(e) => handleFieldUpdate(field, e.target.checked)}
                              />
                            </div>
                          );
                        }

                        if (field.type === 'select') {
                          const opts =
                            typeof field.options === 'function'
                              ? field.options(values)
                              : (field.options ?? []);
                          return (
                            <div key={field.name} className={spanClass}>
                              <FormField
                                id={fieldId}
                                label={field.label}
                                required={field.required}
                                hint={resolvedHint}
                                error={error}
                              >
                                <Select
                                  id={fieldId}
                                  disabled={isDisabled}
                                  hasError={Boolean(error)}
                                  searchable={field.searchable}
                                  value={String(rawValue ?? '')}
                                  onValueChange={(nextVal) => handleFieldUpdate(field, nextVal)}
                                >
                                  {opts.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </Select>
                              </FormField>
                            </div>
                          );
                        }

                        if (field.type === 'date') {
                          return (
                            <div key={field.name} className={spanClass}>
                              <FormField
                                id={fieldId}
                                label={field.label}
                                required={field.required}
                                hint={resolvedHint}
                                error={error}
                              >
                                <DatePicker
                                  id={fieldId}
                                  disabled={isDisabled}
                                  required={field.required}
                                  hasError={Boolean(error)}
                                  minDate={field.minDate}
                                  maxDate={field.maxDate}
                                  placeholder={field.placeholder}
                                  value={String(rawValue ?? '')}
                                  onValueChange={(nextIso) => handleFieldUpdate(field, nextIso)}
                                />
                              </FormField>
                            </div>
                          );
                        }

                        if (field.type === 'tel') {
                          return (
                            <div key={field.name} className={spanClass}>
                              <FormField
                                id={fieldId}
                                label={field.label}
                                required={field.required}
                                hint={resolvedHint}
                                error={error}
                              >
                                <PhoneInput
                                  id={fieldId}
                                  disabled={isDisabled}
                                  required={field.required}
                                  hasError={Boolean(error)}
                                  valueFormat={field.phoneValueFormat ?? 'e164'}
                                  placeholder={field.placeholder ?? '+62 812-3456-7890'}
                                  value={String(rawValue ?? '')}
                                  onValueChange={(nextPhone) => handleFieldUpdate(field, nextPhone)}
                                />
                              </FormField>
                            </div>
                          );
                        }

                        if (field.type === 'currency') {
                          const numericVal =
                            rawValue === null || rawValue === undefined || rawValue === ''
                              ? null
                              : Number(rawValue);
                          return (
                            <div key={field.name} className={spanClass}>
                              <FormField
                                id={fieldId}
                                label={field.label}
                                required={field.required}
                                hint={resolvedHint}
                                error={error}
                              >
                                <CurrencyInput
                                  id={fieldId}
                                  disabled={isDisabled}
                                  required={field.required}
                                  hasError={Boolean(error)}
                                  zeroAsEmpty={field.zeroAsEmpty ?? false}
                                  placeholder={field.placeholder ?? '0'}
                                  value={numericVal}
                                  onValueChange={(nextAmount) =>
                                    handleFieldUpdate(field, nextAmount)
                                  }
                                />
                              </FormField>
                            </div>
                          );
                        }

                        if (field.type === 'textarea') {
                          return (
                            <div key={field.name} className={spanClass}>
                              <FormField
                                id={fieldId}
                                label={field.label}
                                required={field.required}
                                hint={resolvedHint}
                                error={error}
                              >
                                <Textarea
                                  id={fieldId}
                                  rows={field.rows ?? 3}
                                  autoGrowMaxRows={field.autoGrowMaxRows}
                                  disabled={isDisabled}
                                  required={field.required}
                                  hasError={Boolean(error)}
                                  placeholder={field.placeholder}
                                  value={String(rawValue ?? '')}
                                  onChange={(e) => handleFieldUpdate(field, e.target.value)}
                                />
                              </FormField>
                            </div>
                          );
                        }

                        if (field.type === 'number') {
                          const numericVal =
                            rawValue === null || rawValue === undefined || rawValue === ''
                              ? ''
                              : Number(rawValue);
                          return (
                            <div key={field.name} className={spanClass}>
                              <FormField
                                id={fieldId}
                                label={field.label}
                                required={field.required}
                                hint={resolvedHint}
                                error={error}
                              >
                                <Input
                                  id={fieldId}
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  disabled={isDisabled}
                                  required={field.required}
                                  hasError={Boolean(error)}
                                  placeholder={field.placeholder}
                                  value={numericVal === 0 ? (field.min === 0 ? 0 : '') : numericVal}
                                  onChange={(e) => {
                                    const nextStr = e.target.value;
                                    handleFieldUpdate(
                                      field,
                                      nextStr === '' ? 0 : Number(nextStr)
                                    );
                                  }}
                                />
                              </FormField>
                            </div>
                          );
                        }

                        return (
                          <div key={field.name} className={spanClass}>
                            <FormField
                              id={fieldId}
                              label={field.label}
                              required={field.required}
                              hint={resolvedHint}
                              error={error}
                            >
                              <Input
                                id={fieldId}
                                type={field.type}
                                disabled={isDisabled}
                                required={field.required}
                                hasError={Boolean(error)}
                                maxLength={field.maxLength}
                                placeholder={field.placeholder}
                                value={String(rawValue ?? '')}
                                onChange={(e) => handleFieldUpdate(field, e.target.value)}
                              />
                            </FormField>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {section.renderContent && section.renderContent(renderCtx)}
                </AdminFormSectionCard>
              );
            })}
          </div>

          {aside && <aside className="xl:col-span-4 space-y-4 xl:sticky xl:top-4">{aside}</aside>}
        </div>

        <div
          className={[
            'pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3',
            aside ? '' : 'max-w-6xl',
          ].join(' ')}
        >
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            {cancelLabel}
          </Link>

          {!readOnly && (
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              <Save className="size-4" aria-hidden="true" />
              {submitLabel}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
