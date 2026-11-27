import { createContext, useContext, useState, type ReactNode } from 'react';

export interface OrderBottomSecondaryActionConfig {
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  isBusy?: boolean;
}

export interface OrderBottomActionConfig {
  label: string;
  onSubmit: () => void;
  disabled?: boolean;
  isBusy?: boolean;
  secondaryAction?: OrderBottomSecondaryActionConfig;
}

interface OrderBottomActionContextValue {
  action: OrderBottomActionConfig | null;
  setAction: (next: OrderBottomActionConfig | null) => void;
}

const OrderBottomActionContext = createContext<OrderBottomActionContextValue | null>(null);

export function OrderBottomActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<OrderBottomActionConfig | null>(null);

  return (
    <OrderBottomActionContext.Provider value={{ action, setAction }}>
      {children}
    </OrderBottomActionContext.Provider>
  );
}

export function useOrderBottomAction() {
  const ctx = useContext(OrderBottomActionContext);
  if (!ctx) {
    throw new Error('useOrderBottomAction must be used inside OrderBottomActionProvider');
  }
  return ctx;
}
