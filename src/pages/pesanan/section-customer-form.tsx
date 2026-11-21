import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LocateFixed, MapPin, X } from 'lucide-react';
import { Link } from 'react-router';
import { FormField, Input, PhoneInput, Textarea } from '../../components/ui/form-controls';
import type {
  CustomerFormErrors,
  CustomerFormValues,
  GeolocationState,
  ValidatedCustomerData,
} from './types';
import {
  buildGeolocationErrorMessage,
  formatCoordinatesLabel,
  validateCustomerForm,
} from './utils';

export interface SectionCustomerFormProps {
  formId?: string;
  values: CustomerFormValues;
  geolocation: GeolocationState;
  validatedCustomer: ValidatedCustomerData | null;
  validationSignal?: number;
  itemSummaryLabel?: string;
  onValuesChange: (next: CustomerFormValues) => void;
  onGeolocationChange: (next: GeolocationState) => void;
  onValidated: (validated: ValidatedCustomerData | null) => void;
  onContinue?: (validated: ValidatedCustomerData) => void;
}

export function SectionCustomerForm({
  formId = 'customer-order-form',
  values,
  geolocation,
  validatedCustomer,
  validationSignal = 0,
  itemSummaryLabel,
  onValuesChange,
  onGeolocationChange,
  onValidated,
  onContinue,
}: SectionCustomerFormProps) {
  const [errors, setErrors] = useState<CustomerFormErrors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  const runValidationAndSubmit = () => {
    const check = validateCustomerForm(values);
    setErrors(check.errors);

    if (!check.isValid) {
      onValidated(null);
      if (check.errors.fullName) {
        nameRef.current?.focus();
      } else if (check.errors.phone) {
        phoneRef.current?.focus();
      } else if (check.errors.address) {
        addressRef.current?.focus();
      }
      return null;
    }

    const validData: ValidatedCustomerData = {
      fullName: values.fullName.trim(),
      rawPhone: values.phone.trim(),
      normalizedPhone: check.normalizedPhone,
      address: values.address.trim(),
      notes: values.notes.trim(),
      coordinates: geolocation.coordinates,
    };
    onValidated(validData);
    return validData;
  };

  useEffect(() => {
    if (validationSignal > 0) {
      runValidationAndSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationSignal]);

  const handleFieldChange = (field: keyof CustomerFormValues, nextVal: string) => {
    const nextValues = { ...values, [field]: nextVal };
    onValuesChange(nextValues);
    if (validatedCustomer) {
      onValidated(null);
    }
    if (field in errors && errors[field as keyof CustomerFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validData = runValidationAndSubmit();
    if (validData && onContinue) {
      onContinue(validData);
    }
  };

  const handleRequestLocation = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      onGeolocationChange({
        status: 'unavailable',
        coordinates: null,
        message: buildGeolocationErrorMessage('unsupported'),
      });
      return;
    }

    onGeolocationChange({
      status: 'loading',
      coordinates: geolocation.coordinates,
      message: null,
    });
    if (validatedCustomer) {
      onValidated(null);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAtIso: new Date(position.timestamp || Date.now()).toISOString(),
        };
        onGeolocationChange({
          status: 'success',
          coordinates: nextCoords,
          message: null,
        });
      },
      (error) => {
        const statusMap =
          error.code === 1
            ? 'denied'
            : error.code === 2
              ? 'unavailable'
              : error.code === 3
                ? 'timeout'
                : 'error';
        onGeolocationChange({
          status: statusMap,
          coordinates: null,
          message: buildGeolocationErrorMessage(error.code),
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleClearCoordinates = () => {
    onGeolocationChange({
      status: 'idle',
      coordinates: null,
      message: null,
    });
    if (validatedCustomer) {
      onValidated(null);
    }
  };

  const coordLabel = geolocation.coordinates
    ? formatCoordinatesLabel(geolocation.coordinates)
    : null;

  const isGeolocationError =
    geolocation.status === 'denied' ||
    geolocation.status === 'timeout' ||
    geolocation.status === 'unavailable' ||
    geolocation.status === 'error';

  return (
    <section
      aria-labelledby="customer-form-heading"
      className="pt-5 border-t border-[var(--border)] space-y-6 w-full"
    >
      <div className="space-y-1 pb-4 border-b border-[var(--border)] text-center">
        <h2
          id="customer-form-heading"
          className="text-base sm:text-lg font-semibold text-[var(--text)]"
        >
          Data Pemesan &amp; Lokasi
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          {itemSummaryLabel
            ? `${itemSummaryLabel} · Lengkapi data di bawah untuk meninjau ringkasan pesanan sebelum dikirim.`
            : 'Lengkapi data di bawah untuk meninjau ringkasan pesanan sebelum dikirim.'}
        </p>
      </div>

      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            id="customer-full-name"
            label="Nama Lengkap"
            required
            error={errors.fullName}
          >
            <Input
              ref={nameRef}
              id="customer-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              value={values.fullName}
              hasError={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'customer-full-name-error' : undefined}
              onChange={(e) => handleFieldChange('fullName', e.target.value)}
            />
          </FormField>

          <FormField
            id="customer-phone"
            label="Nomor Telepon / WhatsApp"
            required
            error={errors.phone}
          >
            <PhoneInput
              ref={phoneRef}
              id="customer-phone"
              name="phone"
              value={values.phone}
              hasError={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'customer-phone-error' : undefined}
              onValueChange={(nextPhone) => handleFieldChange('phone', nextPhone)}
            />
          </FormField>
        </div>

        <FormField
          id="customer-address"
          label="Alamat"
          required
          error={errors.address}
          labelAction={
            <button
              type="button"
              disabled={geolocation.status === 'loading'}
              onClick={handleRequestLocation}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed shrink-0"
            >
              <LocateFixed className="size-3.5" aria-hidden="true" />
              {geolocation.status === 'loading' ? 'Mengambil Lokasi...' : 'Gunakan Lokasi'}
            </button>
          }
        >
          <Textarea
            ref={addressRef}
            id="customer-address"
            name="address"
            rows={1}
            autoGrowMaxRows={3}
            autoComplete="street-address"
            value={values.address}
            hasError={Boolean(errors.address)}
            aria-describedby={errors.address ? 'customer-address-error' : undefined}
            onChange={(e) => handleFieldChange('address', e.target.value)}
          />
          {geolocation.status === 'success' && coordLabel && (
            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-[var(--success)]">
              <span className="inline-flex items-center gap-1.5 min-w-0 tabular-nums">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Koordinat: {coordLabel}</span>
              </span>
              <button
                type="button"
                aria-label="Hapus titik koordinat"
                onClick={handleClearCoordinates}
                className="inline-flex items-center justify-center p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer shrink-0"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
          {isGeolocationError && geolocation.message && (
            <p role="alert" className="pt-1 text-xs text-[var(--danger)] font-medium">
              {geolocation.message}
            </p>
          )}
        </FormField>

        <FormField
          id="customer-notes"
          label="Catatan Tambahan (Opsional)"
        >
          <Textarea
            id="customer-notes"
            name="notes"
            rows={1}
            autoGrowMaxRows={3}
            value={values.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
          />
        </FormField>

        <p className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)] leading-relaxed">
          Data pemesan dan koordinat opsional hanya digunakan untuk menyusun ringkasan pesanan PDF
          lokal di peramban Anda serta menindaklanjuti konsultasi via WhatsApp, sesuai{' '}
          <Link to="/kebijakan-privasi" className="text-[var(--text)] underline">
            Kebijakan Privasi
          </Link>{' '}
          dan{' '}
          <Link to="/syarat-ketentuan" className="text-[var(--text)] underline">
            Syarat &amp; Ketentuan
          </Link>
          .
        </p>
      </form>
    </section>
  );
}
