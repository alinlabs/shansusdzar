import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BuiltOrderPdfResult } from '../../lib/pdf/build-order-pdf';
import {
  buildOrderPdfDataModel,
  generateLocalReferenceCode,
  type OrderPdfDataModel,
} from '../../lib/pdf/order-pdf-data';
import { preloadWorkshopBrandPdfAssets } from '../../lib/pdf/image-prep';
import type { CartItem } from '../../types/cart';
import type { ValidatedCustomerData } from './types';

export interface OrderPdfState {
  referenceCode: string;
  dataModel: OrderPdfDataModel | null;
  isBuilding: boolean;
  buildError: string | null;
  builtPdf: BuiltOrderPdfResult | null;
  pdfBlobUrl: string | null;
  retryBuild: () => void;
}

export function useOrderPdf(
  items: CartItem[],
  validatedCustomer: ValidatedCustomerData | null
): OrderPdfState {
  const [referenceSeed] = useState(() => ({
    code: generateLocalReferenceCode(),
    createdAt: new Date(),
  }));

  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [builtPdf, setBuiltPdf] = useState<BuiltOrderPdfResult | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [rebuildTick, setRebuildTick] = useState(0);

  useEffect(() => {
    preloadWorkshopBrandPdfAssets();
  }, []);

  const dataModel = useMemo(() => {
    if (!validatedCustomer || items.length === 0) return null;
    return buildOrderPdfDataModel({
      items,
      customer: validatedCustomer,
      referenceCode: referenceSeed.code,
      createdAt: referenceSeed.createdAt,
    });
  }, [items, validatedCustomer, referenceSeed]);

  useEffect(() => {
    if (!dataModel) {
      setBuiltPdf(null);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setBuildError(null);
      setIsBuilding(false);
      return;
    }

    let isCancelled = false;
    let createdUrl: string | null = null;
    setIsBuilding(true);
    setBuildError(null);

    (async () => {
      try {
        const { buildOrderSummaryPdf } = await import('../../lib/pdf/build-order-pdf');
        const pdfResult = await buildOrderSummaryPdf(dataModel);

        if (isCancelled) return;

        createdUrl = URL.createObjectURL(pdfResult.blob);
        setBuiltPdf(pdfResult);
        setPdfBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return createdUrl;
        });
      } catch {
        if (!isCancelled) {
          setBuildError(
            'Gagal menyiapkan dokumen PDF di peramban. Silakan coba muat ulang.'
          );
          setBuiltPdf(null);
          setPdfBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (!isCancelled) {
          setIsBuilding(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [dataModel, rebuildTick]);

  useEffect(() => {
    return () => {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const retryBuild = useCallback(() => {
    setRebuildTick((t) => t + 1);
  }, []);

  return {
    referenceCode: referenceSeed.code,
    dataModel,
    isBuilding,
    buildError,
    builtPdf,
    pdfBlobUrl,
    retryBuild,
  };
}
