import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router';
import { useIsMobileViewport } from '../../hooks/use-mobile-viewport';
import {
  AdminMobileBottomAction,
  AdminPageHeader,
  useAdminScrollControl,
} from '../../pages/admin/admin-shell';
import { AdminActionButton } from './admin-action-buttons';
import {
  AdminMobileTabBar,
  AdminMobileViewModeToggle,
  doesTabHaveErrors,
  resolveFirstErrorTabId,
  resolveSafeActiveTabId,
  useMobileFormViewMode,
  type MobileFormTabItem,
} from './mobile-form-tabs';
import { Button } from '../ui/button';
import {
  Checkbox,
  CurrencyInput,
  DatePicker,
  DimensionInput,
  FormField,
  FormFieldStyleProvider,
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
  | 'dimension'
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
  mobileTabLabel?: string;
  description?: string;
  titleAlign?: 'left' | 'center';
  headerVariant?: 'default' | 'accent';
  unwrapped?: boolean;
  columns?: 1 | 2 | 3;
  visibleWhen?: (values: TValues) => boolean;
  fields?: readonly AdminFormFieldConfig<TValues>[];
  errorFields?: readonly string[];
  errorPrefixes?: readonly string[];
  hasSectionError?: (errors: Partial<Record<string, string>>, values: TValues) => boolean;
  renderContent?: (ctx: AdminFormRenderContext<TValues>) => ReactNode;
  headerAction?: (ctx: AdminFormRenderContext<TValues>) => ReactNode;
}

export function AdminFormSectionCard({
  title,
  headerVariant = 'accent',
  headerAction,
  children,
}: {
  title: string;
  description?: string;
  titleAlign?: 'left' | 'center';
  headerVariant?: 'default' | 'accent';
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const hasHeaderAction = Boolean(headerAction);

  if (headerVariant === 'accent') {
    return (
      <section className="overflow-hidden border border-[var(--border)] border-t-2 border-t-[var(--form-card-line)] bg-[var(--surface)] rounded-[var(--radius-lg)]">
        <div className="px-4 sm:px-6 py-3 bg-[linear-gradient(135deg,#312F2E_0%,#252322_55%,#1A1918_100%)] dark:bg-[linear-gradient(125deg,#D4C8B6_0%,#BFAE9A_52%,#9F8F7B_100%)] text-white dark:text-[#21201E] border-b border-[#1E1D1C]/75 dark:border-[#8D7E6B]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]">
          <div
            className={
              hasHeaderAction
                ? 'flex flex-wrap items-center justify-between gap-2.5 sm:gap-3'
                : 'flex items-center justify-center'
            }
          >
            <div className={hasHeaderAction ? 'min-w-0 text-left' : 'w-full text-center'}>
              <h2 className="text-sm sm:text-base font-semibold text-white dark:text-[#21201E]">
                {title}
              </h2>
            </div>
            {headerAction}
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-4">{children}</div>
      </section>
    );
  }

  return (
    <section className="p-4 sm:p-6 border border-[var(--border)] border-t-2 border-t-[var(--form-card-line)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
      <div
        className={
          hasHeaderAction
            ? 'flex flex-wrap items-center justify-between gap-2.5 sm:gap-3'
            : 'flex items-center justify-center'
        }
      >
        <div className={hasHeaderAction ? 'min-w-0 text-left' : 'w-full text-center'}>
          <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">{title}</h2>
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
  mobileSubmitLabel?: string;
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
  asideTabLabel?: string;
  asideErrorFields?: readonly string[];
  asideErrorPrefixes?: readonly string[];
  hasAsideError?: (errors: Partial<Record<string, string>>, values: TValues) => boolean;
  extraHeaderActions?: ReactNode;
  actionMode?: 'default' | 'header-icon-mobile-bottom';
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
  mobileSubmitLabel = 'Simpan',
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
  asideTabLabel = 'Ringkasan',
  asideErrorFields,
  asideErrorPrefixes,
  hasAsideError,
  extraHeaderActions,
  actionMode = 'header-icon-mobile-bottom',
  notFoundState,
}: AdminFormProps<TValues>) {
  const formId = useId();
  const isMobile = useIsMobileViewport();
  const { mode, toggleMode } = useMobileFormViewMode();
  const { scrollMainToTop, scrollMainToFirstError } = useAdminScrollControl();
  const formWrapperRef = useRef<HTMLDivElement | null>(null);
  const pendingSubmitCheckRef = useRef(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  const visibleSections = useMemo(
    () => sections.filter((section) => !section.visibleWhen || section.visibleWhen(values)),
    [sections, values]
  );

  const mobileTabMatchers = useMemo(() => {
    const items = visibleSections.map((section) => ({
      id: section.id,
      label: section.mobileTabLabel ?? section.title,
      fields: section.fields?.map((f) => f.name),
      errorFields: section.errorFields,
      errorPrefixes: section.errorPrefixes,
      hasSectionError: section.hasSectionError,
    }));
    if (aside) {
      items.push({
        id: '__aside__',
        label: asideTabLabel,
        fields: undefined,
        errorFields: asideErrorFields,
        errorPrefixes: asideErrorPrefixes,
        hasSectionError: hasAsideError,
      });
    }
    return items;
  }, [
    visibleSections,
    aside,
    asideTabLabel,
    asideErrorFields,
    asideErrorPrefixes,
    hasAsideError,
  ]);

  const [activeTabId, setActiveTabId] = useState<string>(() => mobileTabMatchers[0]?.id ?? '');
  const safeActiveTabId = resolveSafeActiveTabId(mobileTabMatchers, activeTabId);

  useEffect(() => {
    if (safeActiveTabId && safeActiveTabId !== activeTabId) {
      setActiveTabId(safeActiveTabId);
    }
  }, [safeActiveTabId, activeTabId]);

  const hasMultipleTabs = mobileTabMatchers.length > 1;
  const isMobileTabMode = isMobile && mode === 'tab' && hasMultipleTabs;

  const mobileTabs = useMemo<MobileFormTabItem[]>(
    () =>
      mobileTabMatchers.map((matcher) => ({
        id: matcher.id,
        label: matcher.label,
        hasError: doesTabHaveErrors(matcher, fieldErrors, values),
      })),
    [mobileTabMatchers, fieldErrors, values]
  );

  useEffect(() => {
    if (!pendingSubmitCheckRef.current) return;
    if (!isMobileTabMode) {
      pendingSubmitCheckRef.current = false;
      return;
    }

    const firstErrorTab = resolveFirstErrorTabId(
      mobileTabMatchers,
      safeActiveTabId,
      fieldErrors,
      values
    );
    if (firstErrorTab) {
      pendingSubmitCheckRef.current = false;
      if (firstErrorTab !== safeActiveTabId) {
        setActiveTabId(firstErrorTab);
      }
      scrollMainToFirstError(formWrapperRef.current);
      return;
    }

    if (formError) {
      pendingSubmitCheckRef.current = false;
      scrollMainToTop();
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      pendingSubmitCheckRef.current = false;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [
    submitAttempt,
    fieldErrors,
    formError,
    isMobileTabMode,
    mobileTabMatchers,
    safeActiveTabId,
    values,
    scrollMainToFirstError,
    scrollMainToTop,
  ]);

  if (notFoundState) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <AdminPageHeader
          title={notFoundState.title}
          description={notFoundState.message}
          backTo={backTo}
          backLabel={backLabel}
        />
        <div className="p-6 border border-[var(--border)] border-t-2 border-t-[var(--form-card-line)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-3 max-w-xl">
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

  const handleFormSubmit = (event: FormEvent) => {
    pendingSubmitCheckRef.current = true;
    setSubmitAttempt((prev) => prev + 1);
    onSubmit(event);
  };

  const handleSelectMobileTab = (nextTabId: string) => {
    setActiveTabId(nextTabId);
    scrollMainToTop();
  };

  const showMobileToggle = hasMultipleTabs;
  const hasHeaderActions = Boolean(extraHeaderActions || !readOnly || showMobileToggle);

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title={title}
        description={description}
        backTo={backTo}
        backLabel={backLabel}
        actions={
          hasHeaderActions ? (
            <>
              {extraHeaderActions}
              {!readOnly &&
                (actionMode === 'header-icon-mobile-bottom' ? (
                  <span className="hidden md:inline-flex">
                    <AdminActionButton
                      type="submit"
                      form={formId}
                      variant="primary"
                      size="sm"
                      iconOnly
                      icon={<Save className="size-4" />}
                      label={submitLabel}
                      disabled={isSubmitting}
                      data-testid="desktop-header-submit-btn"
                    />
                  </span>
                ) : (
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
                ))}
              {showMobileToggle && <AdminMobileViewModeToggle mode={mode} onToggle={toggleMode} />}
            </>
          ) : undefined
        }
      />

      {isMobileTabMode && (
        <AdminMobileTabBar
          tabs={mobileTabs}
          activeTabId={safeActiveTabId}
          onSelectTab={handleSelectMobileTab}
        />
      )}

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

      <FormFieldStyleProvider labelTone="thin" hideHints>
        <div ref={formWrapperRef} className="[&_input]:font-medium [&_textarea]:font-medium">
          <form id={formId} onSubmit={handleFormSubmit} noValidate className="space-y-5 sm:space-y-6">
            <div
              className={
                aside
                  ? 'grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start'
                  : 'grid grid-cols-1 gap-5 sm:gap-6 max-w-6xl'
              }
            >
              <div
                className={
                  aside
                    ? 'xl:col-span-8 grid grid-cols-1 gap-5 sm:gap-6'
                    : 'grid grid-cols-1 gap-5 sm:gap-6'
                }
              >
                {visibleSections.map((section) => {
                  const columns = section.columns ?? 2;
                  const headerActionNode = section.headerAction?.(renderCtx);

                  const sectionBody = (
                    <>
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

                        if (field.type === 'dimension') {
                          return (
                            <div key={field.name} className={spanClass}>
                              <FormField
                                id={fieldId}
                                label={field.label}
                                required={field.required}
                                error={error}
                              >
                                <DimensionInput
                                  id={fieldId}
                                  disabled={isDisabled}
                                  required={field.required}
                                  hasError={Boolean(error)}
                                  value={String(rawValue ?? '')}
                                  onValueChange={(nextDim) => handleFieldUpdate(field, nextDim)}
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
                </>
              );

              const sectionCardNode = section.unwrapped ? (
                (() => {
                  const hasHeaderAction = Boolean(headerActionNode);
                  return (
                    <section className="space-y-4">
                      <div
                        className={
                          hasHeaderAction
                            ? 'flex items-center justify-between gap-3'
                            : 'flex items-center justify-center'
                        }
                      >
                        <div className={hasHeaderAction ? 'min-w-0 text-left' : 'w-full text-center'}>
                          <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">
                            {section.title}
                          </h2>
                        </div>
                        {headerActionNode}
                      </div>
                      {sectionBody}
                    </section>
                  );
                })()
              ) : (
                <AdminFormSectionCard
                  title={section.title}
                  headerVariant={section.headerVariant}
                  headerAction={headerActionNode}
                >
                  {sectionBody}
                </AdminFormSectionCard>
              );

              return (
                <div
                  key={section.id}
                  id={isMobileTabMode ? `admin-form-panel-${section.id}` : undefined}
                  role={isMobileTabMode ? 'tabpanel' : undefined}
                  aria-labelledby={isMobileTabMode ? `admin-form-tab-${section.id}` : undefined}
                  className={
                    isMobileTabMode
                      ? safeActiveTabId === section.id
                        ? 'block min-w-0'
                        : 'hidden'
                      : 'min-w-0'
                  }
                >
                  {sectionCardNode}
                </div>
              );
            })}
          </div>

          {aside && (
            <aside
              id={isMobileTabMode ? 'admin-form-panel-__aside__' : undefined}
              role={isMobileTabMode ? 'tabpanel' : undefined}
              aria-labelledby={isMobileTabMode ? 'admin-form-tab-__aside__' : undefined}
              className={
                isMobileTabMode
                  ? safeActiveTabId === '__aside__'
                    ? 'block space-y-4 min-w-0'
                    : 'hidden'
                  : 'xl:col-span-4 space-y-4 xl:sticky xl:top-4 min-w-0'
              }
            >
              {aside}
            </aside>
          )}
        </div>

        {actionMode === 'default' && (
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
        )}
          </form>
        </div>
      </FormFieldStyleProvider>

      {!readOnly && actionMode === 'header-icon-mobile-bottom' && (
        <AdminMobileBottomAction>
          <nav aria-label="Aksi simpan seluler">
            <Button
              type="submit"
              form={formId}
              variant="primary"
              size="md"
              fullWidth
              disabled={isSubmitting}
              data-testid="mobile-bottom-submit-btn"
            >
              {mobileSubmitLabel}
            </Button>
          </nav>
        </AdminMobileBottomAction>
      )}
    </div>
  );
}
