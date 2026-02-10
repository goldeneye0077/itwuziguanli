import { useEffect, useMemo, useState } from "react";

import type { SkuItem } from "../api";

export interface CartEntry {
  readonly sku: SkuItem;
  readonly quantity: number;
}

export type CartState = Record<number, CartEntry>;

const CART_STORAGE_KEY = "pgc-m02-cart-v1";

function isSkuItem(value: unknown): value is SkuItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    id?: unknown;
    categoryId?: unknown;
    brand?: unknown;
    model?: unknown;
    spec?: unknown;
    referencePrice?: unknown;
    coverUrl?: unknown;
    safetyStockThreshold?: unknown;
    availableStock?: unknown;
  };

  return (
    typeof candidate.id === "number" &&
    typeof candidate.categoryId === "number" &&
    typeof candidate.brand === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.spec === "string" &&
    typeof candidate.referencePrice === "string" &&
    (candidate.coverUrl === null || typeof candidate.coverUrl === "string") &&
    typeof candidate.safetyStockThreshold === "number" &&
    typeof candidate.availableStock === "number"
  );
}

function normalizeCart(candidate: unknown): CartState {
  if (!candidate || typeof candidate !== "object") {
    return {};
  }

  const cart: CartState = {};
  for (const [rawKey, rawValue] of Object.entries(candidate)) {
    const skuId = Number(rawKey);
    if (!Number.isFinite(skuId) || skuId <= 0) {
      continue;
    }
    if (!rawValue || typeof rawValue !== "object") {
      continue;
    }

    const entry = rawValue as { sku?: unknown; quantity?: unknown };
    if (!isSkuItem(entry.sku) || typeof entry.quantity !== "number") {
      continue;
    }

    const quantity = Math.max(0, Math.floor(entry.quantity));
    if (quantity <= 0) {
      continue;
    }

    cart[skuId] = {
      sku: entry.sku,
      quantity,
    };
  }

  return cart;
}

function readCartFromStorage(): CartState {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return normalizeCart(JSON.parse(raw));
  } catch {
    return {};
  }
}

function saveCartToStorage(cart: CartState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

export function useM02Cart(): {
  readonly cart: CartState;
  readonly cartItems: readonly CartEntry[];
  readonly cartTotalQuantity: number;
  readonly addSkuToCart: (item: SkuItem) => void;
  readonly setCartQuantity: (skuId: number, quantity: number) => void;
  readonly clearCart: () => void;
} {
  const [cart, setCart] = useState<CartState>(() => readCartFromStorage());

  useEffect(() => {
    saveCartToStorage(cart);
  }, [cart]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  function addSkuToCart(item: SkuItem): void {
    setCart((current) => {
      const existing = current[item.id];
      const nextQuantity = Math.min(item.availableStock, (existing?.quantity ?? 0) + 1);
      if (nextQuantity <= 0) {
        return current;
      }
      return {
        ...current,
        [item.id]: { sku: item, quantity: nextQuantity },
      };
    });
  }

  function setCartQuantity(skuId: number, quantity: number): void {
    setCart((current) => {
      const entry = current[skuId];
      if (!entry) {
        return current;
      }

      const nextQuantity = Math.max(0, Math.floor(quantity));
      if (nextQuantity <= 0) {
        const { [skuId]: _, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [skuId]: {
          sku: entry.sku,
          quantity: Math.min(nextQuantity, entry.sku.availableStock),
        },
      };
    });
  }

  function clearCart(): void {
    setCart({});
  }

  return {
    cart,
    cartItems,
    cartTotalQuantity,
    addSkuToCart,
    setCartQuantity,
    clearCart,
  };
}

