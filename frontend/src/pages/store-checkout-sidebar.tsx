import { useEffect, useMemo, useState } from "react";

import {
  AuthApiError,
  createApplication,
  createMyAddress,
  fetchMyAddresses,
  fetchMyDepartments,
  requestAiPrecheck,
  type AiPrecheckResult,
  type CreateAddressInput,
  type UserAddressItem,
} from "../api";
import { useAuthSession } from "../stores";
import { toAiRecommendationLabel } from "./page-helpers";
import type { CartEntry } from "./m02-cart";

interface ManualAddressForm {
  readonly receiverName: string;
  readonly receiverPhone: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
}

const EMPTY_MANUAL_ADDRESS: ManualAddressForm = {
  receiverName: "",
  receiverPhone: "",
  province: "",
  city: "",
  district: "",
  detail: "",
};

function toAddressLabel(address: UserAddressItem): string {
  return `${address.receiverName} ${address.receiverPhone} - ${address.province}${address.city}${address.district}${address.detail}`;
}

function hasManualAddressValue(address: ManualAddressForm): boolean {
  return Boolean(
    address.receiverName.trim() &&
      address.receiverPhone.trim() &&
      address.province.trim() &&
      address.city.trim() &&
      address.district.trim() &&
      address.detail.trim(),
  );
}

function IconCart(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.3 19.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm10 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM6.2 6h15.7a1 1 0 0 1 .97 1.25l-1.6 6.4a2 2 0 0 1-1.95 1.52H8.2a2 2 0 0 1-1.95-1.54L4.9 4H2a1 1 0 1 1 0-2h3.6a1 1 0 0 1 .98.8L7 4h-.8l.02.08Z"
      />
    </svg>
  );
}

function IconDelivery(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2h1.6a2 2 0 0 1 1.74 1l1.67 3A2 2 0 0 1 22 15v2a2 2 0 0 1-2 2h-1.2a2.8 2.8 0 0 1-5.6 0H10.8a2.8 2.8 0 0 1-5.6 0H5a2 2 0 0 1-2-2V6Zm14 8V6H5v8h12Zm2.8 5a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Zm-10.4 0a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6ZM19 10h-2v4h4v-.8L19.4 10.3A.5.5 0 0 0 19 10Z"
      />
    </svg>
  );
}

function IconDepartment(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4.5A1.5 1.5 0 0 1 5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15Zm3 2a1 1 0 0 0 0 2h10a1 1 0 1 0 0-2H7Zm0 4a1 1 0 0 0 0 2h10a1 1 0 1 0 0-2H7Zm0 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Z"
      />
    </svg>
  );
}

function IconReason(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L14 3.5ZM8 11a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Zm0 4a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Z"
      />
    </svg>
  );
}

export function StoreCheckoutSidebar(props: {
  readonly accessToken: string | null;
  readonly cartItems: readonly CartEntry[];
  readonly cartTotalQuantity: number;
  readonly setCartQuantity: (skuId: number, quantity: number) => void;
  readonly clearCart: () => void;
}): JSX.Element {
  const { accessToken, cartItems, cartTotalQuantity, setCartQuantity, clearCart } = props;
  const { state } = useAuthSession();

  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "EXPRESS">("PICKUP");
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [addresses, setAddresses] = useState<UserAddressItem[]>([]);
  const [useSavedAddress, setUseSavedAddress] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | undefined>();
  const [manualAddress, setManualAddress] = useState<ManualAddressForm>(EMPTY_MANUAL_ADDRESS);
  const [applicantReason, setApplicantReason] = useState("");

  const [aiPrecheck, setAiPrecheck] = useState<AiPrecheckResult | null>(null);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(false);
  const [isPrechecking, setIsPrechecking] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const cartIsEmpty = cartItems.length === 0;

  const canRunActions = useMemo(
    () => Boolean(accessToken) && !cartIsEmpty && !isSubmitting,
    [accessToken, cartIsEmpty, isSubmitting],
  );

  const canSubmitExpressWithSavedAddress =
    deliveryType !== "EXPRESS" || !useSavedAddress || Boolean(selectedAddressId);
  const canSubmitExpressWithManualAddress =
    deliveryType !== "EXPRESS" || useSavedAddress || hasManualAddressValue(manualAddress);
  const canSubmit = canRunActions && canSubmitExpressWithSavedAddress && canSubmitExpressWithManualAddress;

  useEffect(() => {
    let cancelled = false;

    async function loadBaseData(): Promise<void> {
      if (!accessToken) {
        return;
      }

      setIsLoadingBaseData(true);
      try {
        const [addressResult, departmentResult] = await Promise.all([
          fetchMyAddresses(accessToken),
          fetchMyDepartments(accessToken),
        ]);
        if (cancelled) {
          return;
        }

        setAddresses(addressResult);
        const defaultAddress = addressResult.find((item) => item.isDefault);
        setSelectedAddressId(defaultAddress?.id);

        setDepartments(departmentResult);
        const defaultDepartment =
          state.user?.departmentName && departmentResult.includes(state.user.departmentName)
            ? state.user.departmentName
            : departmentResult[0] ?? state.user?.departmentName ?? "";
        setSelectedDepartment(defaultDepartment);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof AuthApiError ? error.message : "加载基础数据失败。");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBaseData(false);
        }
      }
    }

    void loadBaseData();

    return () => {
      cancelled = true;
    };
  }, [accessToken, state.user?.departmentName]);

  async function runPrecheck(): Promise<void> {
    if (!accessToken || cartItems.length === 0) {
      return;
    }

    setIsPrechecking(true);
    setErrorMessage(null);
    try {
      const result = await requestAiPrecheck(accessToken, {
        jobTitle: state.user?.jobTitle ?? "未填写职务",
        reason: applicantReason.trim() || "未填写申请原因",
        items: cartItems.map((item) => ({
          skuId: item.sku.id,
          quantity: item.quantity,
        })),
      });
      setAiPrecheck(result);
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "智能预检失败。");
    } finally {
      setIsPrechecking(false);
    }
  }

  async function saveManualAddress(): Promise<void> {
    if (!accessToken) {
      return;
    }
    if (!hasManualAddressValue(manualAddress)) {
      setErrorMessage("请先完整填写地址信息后再保存。");
      return;
    }

    const input: CreateAddressInput = {
      receiverName: manualAddress.receiverName.trim(),
      receiverPhone: manualAddress.receiverPhone.trim(),
      province: manualAddress.province.trim(),
      city: manualAddress.city.trim(),
      district: manualAddress.district.trim(),
      detail: manualAddress.detail.trim(),
      isDefault: false,
    };

    setIsSavingAddress(true);
    setErrorMessage(null);
    try {
      const created = await createMyAddress(accessToken, input);
      setAddresses((current) => [created, ...current]);
      setSelectedAddressId(created.id);
      setUseSavedAddress(true);
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "保存地址失败。");
    } finally {
      setIsSavingAddress(false);
    }
  }

  async function submitApplication(): Promise<void> {
    if (!accessToken || cartItems.length === 0) {
      return;
    }

    if (!canSubmitExpressWithSavedAddress) {
      setErrorMessage("请选择已保存地址后再提交。");
      return;
    }
    if (!canSubmitExpressWithManualAddress) {
      setErrorMessage("请先完整填写快递地址后再提交。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmitMessage(null);
    try {
      const result = await createApplication(accessToken, {
        type: "APPLY",
        deliveryType,
        items: cartItems.map((item) => ({
          skuId: item.sku.id,
          quantity: item.quantity,
        })),
        expressAddressId:
          deliveryType === "EXPRESS" && useSavedAddress ? selectedAddressId : undefined,
        expressAddress:
          deliveryType === "EXPRESS" && !useSavedAddress
            ? {
                receiverName: manualAddress.receiverName.trim(),
                receiverPhone: manualAddress.receiverPhone.trim(),
                province: manualAddress.province.trim(),
                city: manualAddress.city.trim(),
                district: manualAddress.district.trim(),
                detail: manualAddress.detail.trim(),
              }
            : undefined,
        applicantReason: applicantReason.trim() || undefined,
        applicantDepartmentName: selectedDepartment || undefined,
        applicantPhone: state.user?.mobilePhone ?? undefined,
        applicantJobTitle: state.user?.jobTitle ?? undefined,
      });
      setSubmitMessage(`申请单 #${result.id} 提交成功，取件码：${result.pickupCode}`);
      clearCart();
      setAiPrecheck(null);
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "提交申请失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="app-shell__card store-checkout" aria-label="结算区">
      <div className="store-checkout__head">
        <p className="app-shell__section-label">结算区</p>
        <div className="store-checkout__title-row">
          <h3 className="store-checkout__title">
            购物车 <span className="store-checkout__count">({cartTotalQuantity})</span>
          </h3>
          <button
            className="app-shell__header-action store-checkout__clear"
            type="button"
            disabled={cartIsEmpty}
            onClick={() => {
              clearCart();
              setAiPrecheck(null);
              setSubmitMessage(null);
              setErrorMessage(null);
            }}
          >
            清空
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="auth-error store-checkout__message" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {submitMessage ? (
        <p className="store-success store-checkout__message" aria-live="polite">
          {submitMessage}
        </p>
      ) : null}

      {cartIsEmpty ? (
        <div className="store-checkout__empty" role="note">
          <div className="store-checkout__empty-icon" aria-hidden="true">
            <IconCart />
          </div>
          <p className="store-checkout__empty-title">购物车为空</p>
          <p className="store-checkout__empty-copy">请至少添加一种物料后再提交申请。</p>
        </div>
      ) : (
        <div className="store-checkout__body">
          <ul className="store-checkout__cart-list" aria-label="购物车物料清单">
            {cartItems.map((entry) => (
              <li key={entry.sku.id} className="store-checkout__cart-item">
                <div className="store-checkout__cart-main">
                  <p className="store-checkout__cart-title">
                    {entry.sku.brand} {entry.sku.model}
                  </p>
                  <p className="store-checkout__cart-meta">规格：{entry.sku.spec}</p>
                </div>
                <div className="store-checkout__qty">
                  <button
                    className="app-shell__header-action store-checkout__qty-btn"
                    type="button"
                    onClick={() => setCartQuantity(entry.sku.id, entry.quantity - 1)}
                  >
                    -
                  </button>
                  <span className="store-checkout__qty-value">{entry.quantity}</span>
                  <button
                    className="app-shell__header-action store-checkout__qty-btn"
                    type="button"
                    disabled={entry.quantity >= entry.sku.availableStock}
                    onClick={() => setCartQuantity(entry.sku.id, entry.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form className="store-checkout__form" onSubmit={(event) => event.preventDefault()}>
            <label className="store-checkout__field">
              <span className="store-checkout__field-label">
                <span className="store-checkout__field-icon" aria-hidden="true">
                  <IconDelivery />
                </span>
                交付方式
              </span>
              <select
                value={deliveryType}
                onChange={(event) => {
                  setDeliveryType(event.target.value as "PICKUP" | "EXPRESS");
                  setErrorMessage(null);
                }}
              >
                <option value="PICKUP">自提</option>
                <option value="EXPRESS">快递</option>
              </select>
            </label>

            <label className="store-checkout__field">
              <span className="store-checkout__field-label">
                <span className="store-checkout__field-icon" aria-hidden="true">
                  <IconDepartment />
                </span>
                部门
              </span>
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                disabled={isLoadingBaseData}
              >
                <option value="">请选择部门</option>
                {departments.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="store-checkout__field">
              <span className="store-checkout__field-label">
                <span className="store-checkout__field-icon" aria-hidden="true">
                  <IconReason />
                </span>
                申请原因
              </span>
              <textarea
                value={applicantReason}
                onChange={(event) => setApplicantReason(event.target.value)}
                placeholder="请描述业务需求"
                rows={3}
              />
            </label>

            {deliveryType === "EXPRESS" ? (
              <div className="store-checkout__express-block">
                <div className="store-checkout__express-toggle page-actions">
                  <button
                    className="app-shell__header-action"
                    type="button"
                    onClick={() => setUseSavedAddress(true)}
                  >
                    使用已保存地址
                  </button>
                  <button
                    className="app-shell__header-action"
                    type="button"
                    onClick={() => setUseSavedAddress(false)}
                  >
                    填写新地址
                  </button>
                </div>

                {useSavedAddress ? (
                  <label className="store-checkout__field">
                    <span className="store-checkout__field-label">快递地址</span>
                    <select
                      value={selectedAddressId ?? ""}
                      onChange={(event) =>
                        setSelectedAddressId(event.target.value ? Number(event.target.value) : undefined)
                      }
                    >
                      <option value="">请选择地址</option>
                      {addresses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {toAddressLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="store-checkout__address-grid">
                    <label className="store-checkout__field">
                      <span className="store-checkout__field-label">收件人</span>
                      <input
                        value={manualAddress.receiverName}
                        onChange={(event) =>
                          setManualAddress((current) => ({ ...current, receiverName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="store-checkout__field">
                      <span className="store-checkout__field-label">联系电话</span>
                      <input
                        value={manualAddress.receiverPhone}
                        onChange={(event) =>
                          setManualAddress((current) => ({ ...current, receiverPhone: event.target.value }))
                        }
                      />
                    </label>
                    <label className="store-checkout__field">
                      <span className="store-checkout__field-label">省份</span>
                      <input
                        value={manualAddress.province}
                        onChange={(event) =>
                          setManualAddress((current) => ({ ...current, province: event.target.value }))
                        }
                      />
                    </label>
                    <label className="store-checkout__field">
                      <span className="store-checkout__field-label">城市</span>
                      <input
                        value={manualAddress.city}
                        onChange={(event) =>
                          setManualAddress((current) => ({ ...current, city: event.target.value }))
                        }
                      />
                    </label>
                    <label className="store-checkout__field">
                      <span className="store-checkout__field-label">区县</span>
                      <input
                        value={manualAddress.district}
                        onChange={(event) =>
                          setManualAddress((current) => ({ ...current, district: event.target.value }))
                        }
                      />
                    </label>
                    <label className="store-checkout__field">
                      <span className="store-checkout__field-label">详细地址</span>
                      <input
                        value={manualAddress.detail}
                        onChange={(event) =>
                          setManualAddress((current) => ({ ...current, detail: event.target.value }))
                        }
                      />
                    </label>
                    <button
                      className="app-shell__header-action"
                      type="button"
                      disabled={isSavingAddress}
                      onClick={() => {
                        void saveManualAddress();
                      }}
                    >
                      {isSavingAddress ? "保存中..." : "保存地址"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </form>

          {aiPrecheck ? (
            <p className="store-precheck-result" aria-live="polite">
              {toAiRecommendationLabel(aiPrecheck.recommendation)}：{aiPrecheck.reason}
            </p>
          ) : null}

          <div className="store-checkout__actions">
            <button
              className="app-shell__header-action store-checkout__secondary"
              type="button"
              disabled={!canRunActions || isPrechecking}
              onClick={() => {
                void runPrecheck();
              }}
            >
              {isPrechecking ? "预检中..." : "智能预检"}
            </button>
            <button
              className="auth-submit store-checkout__primary"
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                void submitApplication();
              }}
            >
              {isSubmitting ? "提交中..." : "提交申请"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
