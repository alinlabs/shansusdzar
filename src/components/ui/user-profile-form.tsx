import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, LocateFixed, MapPin, X } from 'lucide-react';
import type { CapturedCoordinates, CustomerFormErrors, GeolocationState } from '../../pages/pesanan/types';
import { buildGeolocationErrorMessage, formatCoordinatesLabel } from '../../pages/pesanan/utils';
import type {
  SaveUserProfileInput,
  SaveUserProfileResult,
  UserProfileData,
} from '../../store/user-profile-store';
import { Button } from './button';
import { FormField, Input, PhoneInput, Textarea } from './form-controls';

export interface UserProfileFormProps {
  idPrefix: string;
  formId?: string;
  profile: UserProfileData;
  onSave: (input: SaveUserProfileInput) => SaveUserProfileResult;
  onSaved?: (profile: UserProfileData) => void;
  submitLabel: string;
  submitTestId?: string;
  fullWidthSubmit?: boolean;
  hideSubmitIcon?: boolean;
  hideSubmitOnDesktop?: boolean;
  extraActions?: ReactNode;
}

export function UserProfileForm({
  idPrefix,
  formId,
  profile,
  onSave,
  onSaved,
  submitLabel,
  submitTestId,
  fullWidthSubmit = false,
  hideSubmitIcon = false,
  hideSubmitOnDesktop = false,
  extraActions,
}: UserProfileFormProps) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [geolocation, setGeolocation] = useState<GeolocationState>(() => ({
    status: profile.coordinates ? 'success' : 'idle',
    coordinates: profile.coordinates,
    message: null,
  }));
  const [errors, setErrors] = useState<CustomerFormErrors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setFullName(profile.fullName);
    setPhone(profile.phone);
    setAddress(profile.address);
    setGeolocation((prev) => ({
      status: profile.coordinates ? 'success' : 'idle',
      coordinates: profile.coordinates,
      message: prev.message,
    }));
  }, [profile.fullName, profile.phone, profile.address, profile.coordinates]);

  const handleRequestLocation = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeolocation({
        status: 'unavailable',
        coordinates: null,
        message: buildGeolocationErrorMessage('unsupported'),
      });
      return;
    }

    setGeolocation((prev) => ({
      status: 'loading',
      coordinates: prev.coordinates,
      message: null,
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords: CapturedCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAtIso: new Date(position.timestamp || Date.now()).toISOString(),
        };
        setGeolocation({
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
        setGeolocation({
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
    setGeolocation({
      status: 'idle',
      coordinates: null,
      message: null,
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const result = onSave({
      fullName,
      phone,
      address,
      coordinates: geolocation.coordinates,
    });

    if (!result.ok || !result.profile) {
      const nextErrors = result.errors ?? {};
      setErrors(nextErrors);
      if (nextErrors.fullName) {
        nameRef.current?.focus();
      } else if (nextErrors.phone) {
        phoneRef.current?.focus();
      } else if (nextErrors.address) {
        addressRef.current?.focus();
      }
      return;
    }

    setErrors({});
    setFullName(result.profile.fullName);
    setPhone(result.profile.phone);
    setAddress(result.profile.address);
    onSaved?.(result.profile);
  };

  const coordLabel = geolocation.coordinates
    ? formatCoordinatesLabel(geolocation.coordinates)
    : null;

  const isGeolocationError =
    geolocation.status === 'denied' ||
    geolocation.status === 'timeout' ||
    geolocation.status === 'unavailable' ||
    geolocation.status === 'error';

  const nameId = `${idPrefix}-full-name`;
  const phoneId = `${idPrefix}-phone`;
  const addressId = `${idPrefix}-address`;

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField id={nameId} label="Nama Lengkap" required error={errors.fullName}>
          <Input
            ref={nameRef}
            id={nameId}
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Contoh: Budi Santoso"
            value={fullName}
            hasError={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? `${nameId}-error` : undefined}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
          />
        </FormField>

        <FormField
          id={phoneId}
          label="Nomor Telepon / WhatsApp"
          required
          error={errors.phone}
        >
          <PhoneInput
            ref={phoneRef}
            id={phoneId}
            name="phone"
            value={phone}
            hasError={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
            onValueChange={(nextPhone) => {
              setPhone(nextPhone);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
          />
        </FormField>
      </div>

      <FormField
        id={addressId}
        label="Lokasi / Alamat"
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
          id={addressId}
          name="address"
          rows={2}
          autoGrowMaxRows={4}
          autoComplete="street-address"
          placeholder="Nama jalan, nomor rumah, kelurahan/kecamatan, kota atau patokan terdekat"
          value={address}
          hasError={Boolean(errors.address)}
          aria-describedby={errors.address ? `${addressId}-error` : undefined}
          onChange={(e) => {
            setAddress(e.target.value);
            if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
          }}
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

      <div
        className={[
          extraActions
            ? 'flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 pt-1'
            : 'pt-1',
          hideSubmitOnDesktop && !extraActions ? 'md:hidden' : '',
          hideSubmitOnDesktop && extraActions ? 'md:justify-end' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={hideSubmitOnDesktop ? 'w-full sm:w-auto md:hidden' : fullWidthSubmit ? 'w-full' : 'w-full sm:w-auto'}>
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth={fullWidthSubmit}
            data-testid={submitTestId}
            className={fullWidthSubmit ? undefined : 'w-full sm:w-auto'}
          >
            <span>{submitLabel}</span>
            {!hideSubmitIcon && <ArrowRight className="size-4 shrink-0" aria-hidden="true" />}
          </Button>
        </div>
        {extraActions}
      </div>
    </form>
  );
}
