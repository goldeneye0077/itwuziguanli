import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { useM02Cart } from "./m02-cart";
import { toAiRecommendationLabel } from "./page-helpers";

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

export function StoreCartPage(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useAuthSession();
  const accessToken = state.accessToken;
  const currentUserId = state.user?.id ?? null;

  const { cartItems, cartTotalQuantity, setCartQuantity, clearCart } = useM02Cart(currentUserId);

  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "EXPRESS">("PICKUP");
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [addresses, setAddresses] = useState<UserAddressItem[]>([]);
  const [useSavedAddress, setUseSavedAddress] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | undefined>();
  const [manualAddress, setManualAddress] = useState<ManualAddressForm>(EMPTY_MANUAL_ADDRESS);

  const [applicantReason, setApplicantReason] = useState("");
  const [aiPrecheck, setAiPrecheck] = useState<AiPrecheckResult | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const cartIsEmpty = cartItems.length === 0;
  const canSubmitExpressWithSavedAddress =
    deliveryType !== "EXPRESS" || !useSavedAddress || Boolean(selectedAddressId);
  const canSubmitExpressWithManualAddress =
    deliveryType !== "EXPRESS" || useSavedAddress || hasManualAddressValue(manualAddress);

  const canSubmit =
    !cartIsEmpty &&
    !isSubmitting &&
    canSubmitExpressWithSavedAddress &&
    canSubmitExpressWithManualAddress;

  useEffect(() => {
    let cancelled = false;

    async function loadBaseData(): Promise<void> {
      if (!accessToken) {
        if (!cancelled) {
          setErrorMessage("会话令牌缺失，请重新登录。");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
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
          setIsLoading(false);
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
      setErrorMessage("请选择快递地址后再提交。");
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
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="购物车概览">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">领用购物车</h2>
          <p className="app-shell__panel-copy">在当前页面完成结算、地址与申请提交。</p>
        </div>
        <div className="page-actions">
          <button className="app-shell__header-action" type="button" onClick={() => navigate("/store")}>
            返回商城
          </button>
          <button className="app-shell__header-action" type="button" disabled={cartIsEmpty} onClick={() => clearCart()}>
            清空购物车
          </button>
        </div>
      </section>

      {errorMessage || submitMessage ? (
        <div className="page-stack__messages">
          {errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {submitMessage ? (
            <p className="store-success" aria-live="polite">
              {submitMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {cartIsEmpty ? (
        <section className="app-shell__panel" aria-label="购物车为空">
          <p className="app-shell__section-label">提示</p>
          <h3 className="app-shell__panel-title">购物车为空</h3>
          <p className="app-shell__panel-copy">请先在商城中添加物料后再提交申请。</p>
          <button className="auth-submit" type="button" onClick={() => navigate("/store")}>
            去商城选购
          </button>
        </section>
      ) : (
        <section className="app-shell__grid" aria-label="购物车结算区">
          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">购物车</p>
              <h3 className="app-shell__card-title">物料清单（{cartTotalQuantity}）</h3>
            </div>
            <div className="page-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th scope="col">缩略图</th>
                    <th scope="col">物料名称</th>
                    <th scope="col">型号</th>
                    <th scope="col">品牌</th>
                    <th scope="col">规格</th>
                    <th scope="col">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((entry) => (
                    <tr key={entry.sku.id}>
                      <td>
                        {entry.sku.coverUrl ? (
                          <img className="store-cart-cover" src={entry.sku.coverUrl} alt={`${entry.sku.brand} ${entry.sku.model}`} />
                        ) : (
                          <span className="muted-text">无图</span>
                        )}
                      </td>
                      <td>{`${entry.sku.brand} ${entry.sku.model}`}</td>
                      <td>{entry.sku.model}</td>
                      <td>{entry.sku.brand}</td>
                      <td>{entry.sku.spec}</td>
                      <td>
                        <div className="store-qty-row">
                          <button className="app-shell__header-action" type="button" onClick={() => setCartQuantity(entry.sku.id, entry.quantity - 1)}>
                            -
                          </button>
                          <span>{entry.quantity}</span>
                          <button
                            className="app-shell__header-action"
                            type="button"
                            disabled={entry.quantity >= entry.sku.availableStock}
                            onClick={() => setCartQuantity(entry.sku.id, entry.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">提交申请</p>
              <h3 className="app-shell__card-title">结算信息</h3>
            </div>

            <div className="store-checkout-form page-form-grid">
              <label className="store-field">
                交付方式
                <select value={deliveryType} onChange={(event) => setDeliveryType(event.target.value as "PICKUP" | "EXPRESS")}>
                  <option value="PICKUP">自提</option>
                  <option value="EXPRESS">快递</option>
                </select>
              </label>

              <label className="store-field">
                部门
                <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} disabled={isLoading}>
                  <option value="">请选择部门</option>
                  {departments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="store-field">
                申请原因
                <textarea value={applicantReason} onChange={(event) => setApplicantReason(event.target.value)} rows={3} placeholder="请描述业务需求" />
              </label>

              {deliveryType === "EXPRESS" ? (
                <>
                  <div className="store-toggle-row page-actions">
                    <button className="app-shell__header-action" type="button" onClick={() => setUseSavedAddress(true)}>
                      使用已保存地址
                    </button>
                    <button className="app-shell__header-action" type="button" onClick={() => setUseSavedAddress(false)}>
                      填写新地址
                    </button>
                  </div>

                  {useSavedAddress ? (
                    <label className="store-field">
                      快递地址
                      <select
                        value={selectedAddressId ?? ""}
                        onChange={(event) => setSelectedAddressId(event.target.value ? Number(event.target.value) : undefined)}
                        disabled={isLoading}
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
                    <div className="store-address-grid">
                      <label className="store-field">
                        收件人
                        <input
                          value={manualAddress.receiverName}
                          onChange={(event) =>
                            setManualAddress((current) => ({
                              ...current,
                              receiverName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="store-field">
                        联系电话
                        <input
                          value={manualAddress.receiverPhone}
                          onChange={(event) =>
                            setManualAddress((current) => ({
                              ...current,
                              receiverPhone: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="store-field">
                        省份
                        <input
                          value={manualAddress.province}
                          onChange={(event) =>
                            setManualAddress((current) => ({
                              ...current,
                              province: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="store-field">
                        城市
                        <input
                          value={manualAddress.city}
                          onChange={(event) =>
                            setManualAddress((current) => ({
                              ...current,
                              city: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="store-field">
                        区县
                        <input
                          value={manualAddress.district}
                          onChange={(event) =>
                            setManualAddress((current) => ({
                              ...current,
                              district: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="store-field">
                        详细地址
                        <input
                          value={manualAddress.detail}
                          onChange={(event) =>
                            setManualAddress((current) => ({
                              ...current,
                              detail: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button className="app-shell__header-action" type="button" disabled={isSavingAddress} onClick={() => void saveManualAddress()}>
                        {isSavingAddress ? "保存中..." : "保存地址"}
                      </button>
                    </div>
                  )}
                </>
              ) : null}

              <div className="store-action-row page-actions">
                <button className="app-shell__header-action" type="button" disabled={cartIsEmpty || isSubmitting} onClick={() => void runPrecheck()}>
                  智能预检
                </button>
                <button className="auth-submit" type="button" disabled={!canSubmit} onClick={() => void submitApplication()}>
                  {isSubmitting ? "提交中..." : "提交申请"}
                </button>
              </div>

              {aiPrecheck ? (
                <p className="store-precheck-result">
                  智能预检结果：<strong>{toAiRecommendationLabel(aiPrecheck.recommendation)}</strong> - {aiPrecheck.reason}
                </p>
              ) : null}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

