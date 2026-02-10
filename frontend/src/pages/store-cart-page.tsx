import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AuthApiError,
  createApplication,
  createMyAddress,
  fetchMyAddresses,
  requestAiPrecheck,
  type AiPrecheckResult,
  type CreateAddressInput,
  type UserAddressItem,
} from "../api";
import { useAuthSession } from "../stores";
import { useM02Cart } from "./m02-cart";
import { readSubmittedApplications, saveSubmittedApplications } from "./m02-storage";
import { toAiRecommendationLabel } from "./page-helpers";

interface ManualAddressForm {
  readonly receiverName: string;
  readonly receiverPhone: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
}

function toAddressText(address: UserAddressItem): string {
  return `${address.receiverName} ${address.receiverPhone} · ${address.province} ${address.city} ${address.district} ${address.detail}`;
}

export function StoreCartPage(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useAuthSession();
  const accessToken = state.accessToken;

  const { cartItems, cartTotalQuantity, setCartQuantity, clearCart } = useM02Cart();

  const [addresses, setAddresses] = useState<UserAddressItem[]>([]);
  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "EXPRESS">("PICKUP");
  const [useSavedAddress, setUseSavedAddress] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | undefined>();
  const [manualAddress, setManualAddress] = useState<ManualAddressForm>({
    receiverName: "",
    receiverPhone: "",
    province: "",
    city: "",
    district: "",
    detail: "",
  });

  const [applicantReason, setApplicantReason] = useState("");
  const [applicantJobTitle, setApplicantJobTitle] = useState("");
  const [aiPrecheck, setAiPrecheck] = useState<AiPrecheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const cartIsEmpty = cartItems.length === 0;

  const canSubmitExpressWithSavedAddress =
    deliveryType !== "EXPRESS" || !useSavedAddress || Boolean(selectedAddressId);

  const canSubmitExpressWithManualAddress = useMemo(() => {
    if (deliveryType !== "EXPRESS" || useSavedAddress) {
      return true;
    }
    const input = {
      receiverName: manualAddress.receiverName.trim(),
      receiverPhone: manualAddress.receiverPhone.trim(),
      province: manualAddress.province.trim(),
      city: manualAddress.city.trim(),
      district: manualAddress.district.trim(),
      detail: manualAddress.detail.trim(),
    };
    return Boolean(
      input.receiverName &&
        input.receiverPhone &&
        input.province &&
        input.city &&
        input.district &&
        input.detail,
    );
  }, [deliveryType, manualAddress, useSavedAddress]);

  useEffect(() => {
    let cancelled = false;

    async function loadAddresses(): Promise<void> {
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
        const addressResult = await fetchMyAddresses(accessToken);
        if (cancelled) {
          return;
        }
        setAddresses(addressResult);
        const defaultAddress = addressResult.find((item) => item.isDefault);
        setSelectedAddressId(defaultAddress?.id);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof AuthApiError ? error.message : "加载地址失败。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAddresses();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function runPrecheck(): Promise<void> {
    if (!accessToken || cartItems.length === 0) {
      return;
    }
    setErrorMessage(null);
    try {
      const result = await requestAiPrecheck(accessToken, {
        jobTitle: applicantJobTitle.trim() || "未知岗位",
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

  async function saveCurrentAddress(): Promise<void> {
    if (!accessToken) {
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
    if (!input.receiverName || !input.receiverPhone || !input.province || !input.city || !input.district || !input.detail) {
      setErrorMessage("请先完整填写地址信息再保存。");
      return;
    }

    setIsSavingAddress(true);
    setErrorMessage(null);
    try {
      const created = await createMyAddress(accessToken, input);
      const nextAddresses = [created, ...addresses];
      setAddresses(nextAddresses);
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
      setErrorMessage("请先完整填写快递地址信息后再提交。");
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
        applicantJobTitle: applicantJobTitle.trim() || undefined,
      });

      saveSubmittedApplications([result, ...readSubmittedApplications()]);
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
          <p className="app-shell__section-label">M02 商城</p>
          <h2 className="app-shell__panel-title">领用购物车</h2>
          <p className="app-shell__panel-copy">
            核对购物车内容后提交自提或快递申请。需要继续添加物料可返回商城。
          </p>
        </div>
        <div className="page-actions">
          <button
            className="app-shell__header-action"
            type="button"
            onClick={() => navigate("/store")}
          >
            返回商城
          </button>
          <button
            className="app-shell__header-action"
            type="button"
            disabled={cartIsEmpty}
            onClick={() => clearCart()}
          >
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
            <ul className="dashboard-list">
              {cartItems.map((entry) => (
                <li key={entry.sku.id} className="dashboard-list__item">
                  <p className="dashboard-list__title">
                    {entry.sku.brand} {entry.sku.model}
                  </p>
                  <p className="dashboard-list__meta">规格：{entry.sku.spec}</p>
                  <div className="store-qty-row">
                    <button
                      className="app-shell__header-action"
                      type="button"
                      aria-label={`减少 ${entry.sku.brand} ${entry.sku.model} 的数量`}
                      onClick={() => setCartQuantity(entry.sku.id, entry.quantity - 1)}
                    >
                      -
                    </button>
                    <span>{entry.quantity}</span>
                    <button
                      className="app-shell__header-action"
                      type="button"
                      aria-label={`增加 ${entry.sku.brand} ${entry.sku.model} 的数量`}
                      onClick={() => setCartQuantity(entry.sku.id, entry.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">提交申请</p>
              <h3 className="app-shell__card-title">结算信息</h3>
            </div>

            <div className="store-checkout-form page-form-grid">
              <label className="store-field">
                交付方式
                <select
                  value={deliveryType}
                  onChange={(event) =>
                    setDeliveryType(event.target.value === "EXPRESS" ? "EXPRESS" : "PICKUP")
                  }
                >
                  <option value="PICKUP">自提</option>
                  <option value="EXPRESS">快递</option>
                </select>
              </label>

              <label className="store-field">
                岗位
                <input
                  value={applicantJobTitle}
                  onChange={(event) => setApplicantJobTitle(event.target.value)}
                  placeholder="例如：前端工程师"
                />
              </label>

              <label className="store-field">
                申请原因
                <textarea
                  value={applicantReason}
                  onChange={(event) => setApplicantReason(event.target.value)}
                  rows={3}
                  placeholder="请描述业务需求"
                />
              </label>

              {deliveryType === "EXPRESS" ? (
                <>
                  <div className="store-toggle-row page-actions">
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
                    <label className="store-field">
                      地址
                      <select
                        value={selectedAddressId ?? ""}
                        onChange={(event) =>
                          setSelectedAddressId(
                            event.target.value ? Number(event.target.value) : undefined,
                          )
                        }
                        disabled={isLoading}
                      >
                        <option value="">请选择地址</option>
                        {addresses.map((item) => (
                          <option key={item.id} value={item.id}>
                            {toAddressText(item)}
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
                          placeholder="收件人"
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
                          placeholder="联系电话"
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
                          placeholder="省份"
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
                          placeholder="城市"
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
                          placeholder="区县"
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
                          placeholder="详细地址"
                        />
                      </label>
                      <button
                        className="app-shell__header-action"
                        type="button"
                        disabled={isSavingAddress}
                        onClick={() => {
                          void saveCurrentAddress();
                        }}
                      >
                        {isSavingAddress ? "保存中..." : "保存地址"}
                      </button>
                    </div>
                  )}
                </>
              ) : null}

              <div className="store-action-row page-actions">
                <button
                  className="app-shell__header-action"
                  type="button"
                  disabled={cartIsEmpty || isSubmitting}
                  onClick={() => {
                    void runPrecheck();
                  }}
                >
                  智能预检
                </button>
                <button
                  className="auth-submit"
                  type="button"
                  disabled={
                    cartIsEmpty ||
                    isSubmitting ||
                    !canSubmitExpressWithSavedAddress ||
                    !canSubmitExpressWithManualAddress
                  }
                  onClick={() => {
                    void submitApplication();
                  }}
                >
                  {isSubmitting ? "提交中..." : "提交申请"}
                </button>
              </div>

              {aiPrecheck ? (
                <p className="store-precheck-result">
                  智能预检结果：
                  <strong>{toAiRecommendationLabel(aiPrecheck.recommendation)}</strong> ·{" "}
                  {aiPrecheck.reason}
                </p>
              ) : null}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

