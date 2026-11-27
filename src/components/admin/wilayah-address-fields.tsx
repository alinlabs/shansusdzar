import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  clearWilayahCache,
  fetchDistricts,
  fetchProvinces,
  fetchRegencies,
  fetchVillages,
  formatFullWilayahAddress,
  type ClientWilayahAddress,
  type WilayahItem,
  type WilayahVillageItem,
} from '../../lib/wilayah-indonesia';
import { FormField, Input, Select, type SelectOptionItem } from '../ui/form-controls';

export interface WilayahAddressFieldsProps {
  idPrefix: string;
  value?: ClientWilayahAddress;
  fallbackLocation?: string;
  disabled?: boolean;
  required?: boolean;
  errors?: Partial<Record<string, string>>;
  showHints?: boolean;
  onChange: (nextAddress: ClientWilayahAddress) => void;
}

function mergeWithCurrentSelection<T extends WilayahItem>(
  list: readonly T[],
  current?: { id?: string; name?: string }
): T[] {
  const cleanId = current?.id?.trim();
  const cleanName = current?.name?.trim();
  if (!cleanId || !cleanName) return [...list];
  if (list.some((item) => item.id === cleanId)) return [...list];
  return [{ id: cleanId, name: cleanName } as T, ...list];
}

export function WilayahAddressFields({
  idPrefix,
  value,
  fallbackLocation,
  disabled = false,
  required = false,
  errors = {},
  showHints = false,
  onChange,
}: WilayahAddressFieldsProps) {
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahVillageItem[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const provinceId = value?.provinsi?.id ?? '';
  const regencyId = value?.kabupaten?.id ?? '';
  const districtId = value?.kecamatan?.id ?? '';
  const villageId = value?.desa?.id ?? '';

  useEffect(() => {
    const controller = new AbortController();
    setLoadingProvinces(true);
    setFetchError(null);

    fetchProvinces(controller.signal)
      .then((list) => {
        setProvinces(list);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setFetchError('Gagal memuat daftar provinsi dari server wilayah.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingProvinces(false);
        }
      });

    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    if (!provinceId) {
      setRegencies([]);
      setLoadingRegencies(false);
      return;
    }

    const controller = new AbortController();
    setLoadingRegencies(true);
    setFetchError(null);

    fetchRegencies(provinceId, controller.signal)
      .then((list) => {
        setRegencies(list);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setFetchError('Gagal memuat daftar kabupaten/kota dari server wilayah.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingRegencies(false);
        }
      });

    return () => controller.abort();
  }, [provinceId, reloadToken]);

  useEffect(() => {
    if (!regencyId) {
      setDistricts([]);
      setLoadingDistricts(false);
      return;
    }

    const controller = new AbortController();
    setLoadingDistricts(true);
    setFetchError(null);

    fetchDistricts(regencyId, controller.signal)
      .then((list) => {
        setDistricts(list);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setFetchError('Gagal memuat daftar kecamatan dari server wilayah.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingDistricts(false);
        }
      });

    return () => controller.abort();
  }, [regencyId, reloadToken]);

  useEffect(() => {
    if (!districtId) {
      setVillages([]);
      setLoadingVillages(false);
      return;
    }

    const controller = new AbortController();
    setLoadingVillages(true);
    setFetchError(null);

    fetchVillages(districtId, controller.signal)
      .then((list) => {
        setVillages(list);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setFetchError('Gagal memuat daftar desa/kelurahan dari server wilayah.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingVillages(false);
        }
      });

    return () => controller.abort();
  }, [districtId, reloadToken]);

  const provinceOptions = useMemo<SelectOptionItem[]>(() => {
    return mergeWithCurrentSelection(provinces, value?.provinsi).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [provinces, value?.provinsi]);

  const regencyOptions = useMemo<SelectOptionItem[]>(() => {
    return mergeWithCurrentSelection(regencies, value?.kabupaten).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [regencies, value?.kabupaten]);

  const districtOptions = useMemo<SelectOptionItem[]>(() => {
    return mergeWithCurrentSelection(districts, value?.kecamatan).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [districts, value?.kecamatan]);

  const villageOptions = useMemo<SelectOptionItem[]>(() => {
    const merged = mergeWithCurrentSelection(villages, value?.desa);
    return merged.map((item) => {
      const villageItem = item as WilayahVillageItem;
      const postal = villageItem.postal_code || (value?.desa?.id === item.id ? value?.desa?.postalCode : '');
      return {
        value: item.id,
        label: item.name,
        ...(postal ? { description: `Kode Pos ${postal}` } : {}),
      };
    });
  }, [villages, value?.desa]);

  const formattedPreview = formatFullWilayahAddress(value, fallbackLocation);
  const postalHint = value?.desa?.postalCode
    ? `Kode Pos ${value.desa.postalCode}`
    : undefined;

  const handleProvinceChange = (nextProvinceId: string) => {
    if (nextProvinceId === provinceId) return;
    const picked = provinces.find((p) => p.id === nextProvinceId);
    if (!picked) return;
    onChange({
      provinsi: { id: picked.id, name: picked.name },
      detail: value?.detail ?? '',
    });
  };

  const handleRegencyChange = (nextRegencyId: string) => {
    if (nextRegencyId === regencyId) return;
    const picked = regencies.find((r) => r.id === nextRegencyId);
    if (!picked || !value?.provinsi) return;
    onChange({
      provinsi: value.provinsi,
      kabupaten: { id: picked.id, name: picked.name },
      detail: value?.detail ?? '',
    });
  };

  const handleDistrictChange = (nextDistrictId: string) => {
    if (nextDistrictId === districtId) return;
    const picked = districts.find((d) => d.id === nextDistrictId);
    if (!picked || !value?.provinsi || !value?.kabupaten) return;
    onChange({
      provinsi: value.provinsi,
      kabupaten: value.kabupaten,
      kecamatan: { id: picked.id, name: picked.name },
      detail: value?.detail ?? '',
    });
  };

  const handleVillageChange = (nextVillageId: string) => {
    if (nextVillageId === villageId) return;
    const picked = villages.find((v) => v.id === nextVillageId);
    if (!picked || !value?.provinsi || !value?.kabupaten || !value?.kecamatan) return;
    onChange({
      provinsi: value.provinsi,
      kabupaten: value.kabupaten,
      kecamatan: value.kecamatan,
      desa: {
        id: picked.id,
        name: picked.name,
        ...(picked.postal_code ? { postalCode: picked.postal_code } : {}),
      },
      detail: value?.detail ?? '',
    });
  };

  const handleDetailChange = (nextDetail: string) => {
    onChange({
      ...value,
      detail: nextDetail,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          id={`${idPrefix}-provinsi`}
          label="Provinsi"
          required={required}
          error={errors['alamat.provinsi']}
        >
          <Select
            id={`${idPrefix}-provinsi`}
            value={provinceId}
            options={provinceOptions}
            searchable
            searchPlaceholder="Cari provinsi..."
            placeholder={loadingProvinces ? 'Memuat provinsi...' : 'Pilih provinsi...'}
            disabled={disabled || (loadingProvinces && provinceOptions.length === 0)}
            hasError={Boolean(errors['alamat.provinsi'])}
            onValueChange={handleProvinceChange}
          />
        </FormField>

        <FormField
          id={`${idPrefix}-kabupaten`}
          label="Kabupaten / Kota"
          required={required}
          error={errors['alamat.kabupaten']}
        >
          <Select
            id={`${idPrefix}-kabupaten`}
            value={regencyId}
            options={regencyOptions}
            searchable
            searchPlaceholder="Cari kabupaten atau kota..."
            placeholder={
              !provinceId
                ? 'Pilih provinsi dahulu'
                : loadingRegencies
                  ? 'Memuat kab/kota...'
                  : 'Pilih kabupaten / kota...'
            }
            disabled={disabled || !provinceId || (loadingRegencies && regencyOptions.length === 0)}
            hasError={Boolean(errors['alamat.kabupaten'])}
            onValueChange={handleRegencyChange}
          />
        </FormField>

        <FormField
          id={`${idPrefix}-kecamatan`}
          label="Kecamatan"
          required={required}
          error={errors['alamat.kecamatan']}
        >
          <Select
            id={`${idPrefix}-kecamatan`}
            value={districtId}
            options={districtOptions}
            searchable
            searchPlaceholder="Cari kecamatan..."
            placeholder={
              !regencyId
                ? 'Pilih kabupaten/kota dahulu'
                : loadingDistricts
                  ? 'Memuat kecamatan...'
                  : 'Pilih kecamatan...'
            }
            disabled={disabled || !regencyId || (loadingDistricts && districtOptions.length === 0)}
            hasError={Boolean(errors['alamat.kecamatan'])}
            onValueChange={handleDistrictChange}
          />
        </FormField>

        <FormField
          id={`${idPrefix}-desa`}
          label="Desa / Kelurahan"
          required={required}
          hint={showHints ? postalHint : undefined}
          error={errors['alamat.desa']}
        >
          <Select
            id={`${idPrefix}-desa`}
            value={villageId}
            options={villageOptions}
            searchable
            searchPlaceholder="Cari desa / kelurahan..."
            placeholder={
              !districtId
                ? 'Pilih kecamatan dahulu'
                : loadingVillages
                  ? 'Memuat desa/kelurahan...'
                  : 'Pilih desa / kelurahan...'
            }
            disabled={disabled || !districtId || (loadingVillages && villageOptions.length === 0)}
            hasError={Boolean(errors['alamat.desa'])}
            onValueChange={handleVillageChange}
          />
        </FormField>
      </div>

      <FormField
        id={`${idPrefix}-detail-alamat`}
        label="Alamat Lengkap / Jalan / Perumahan (Opsional)"
        hint={showHints && formattedPreview ? `Alamat tersimpan: ${formattedPreview}` : undefined}
      >
        <Input
          id={`${idPrefix}-detail-alamat`}
          type="text"
          disabled={disabled}
          placeholder="Contoh: Perumahan Bukit Indah Blok C4 / Jl. Veteran No. 12"
          value={value?.detail ?? ''}
          onChange={(e) => handleDetailChange(e.target.value)}
        />
      </FormField>

      {fetchError && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--danger)]">
          <span>{fetchError}</span>
          <button
            type="button"
            onClick={() => {
              clearWilayahCache();
              setReloadToken((n) => n + 1);
            }}
            className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline cursor-pointer"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Muat Ulang Wilayah
          </button>
        </div>
      )}
    </div>
  );
}
