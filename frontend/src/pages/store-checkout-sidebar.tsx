import { useMemo, useState } from "react";

import {
  AuthApiError,
  createApplication,
  requestAiPrecheck,
  type AiPrecheckResult,
} from "../api";
import { toAiRecommendationLabel } from "./page-helpers";
import type { CartEntry } from "./m02-cart";
import { readSubmittedApplications, saveSubmittedApplications } from "./m02-storage";

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

function IconRole(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.51 4.51 0 0 0 12 12Zm0 2c-4.2 0-8 2.16-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.84-3.8-5-8-5Z"
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

  const cartIsEmpty = cartItems.length === 0;
  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "EXPRESS">("PICKUP");
  const [applicantJobTitle, setApplicantJobTitle] = useState("");
  const [applicantReason, setApplicantReason] = useState("");
  const [aiPrecheck, setAiPrecheck] = useState<AiPrecheckResult | null>(null);
  const [isPrechecking, setIsPrechecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const expressNotSupported = deliveryType === "EXPRESS";

  const canRunActions = useMemo(
    () => Boolean(accessToken) && !cartIsEmpty && !isSubmitting,
    [accessToken, cartIsEmpty, isSubmitting],
  );

  const canSubmit = useMemo(
    () => canRunActions && !expressNotSupported,
    [canRunActions, expressNotSupported],
  );

  async function runPrecheck(): Promise<void> {
    if (!accessToken || cartItems.length === 0) {
      return;
    }

    setIsPrechecking(true);
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
    } finally {
      setIsPrechecking(false);
    }
  }

  async function submitApplication(): Promise<void> {
    if (!accessToken || cartItems.length === 0) {
      return;
    }

    if (expressNotSupported) {
      setErrorMessage("快递申请请前往“领用购物车”页面填写地址后提交。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmitMessage(null);
    try {
      const result = await createApplication(accessToken, {
        type: "APPLY",
        deliveryType: "PICKUP",
        items: cartItems.map((item) => ({
          skuId: item.sku.id,
          quantity: item.quantity,
        })),
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
    <article className="app-shell__card store-checkout" aria-label="结算区">
      <div className="store-checkout__head">
        <p className="app-shell__section-label">结算区</p>
        <div className="store-checkout__title-row">
          <h3 className="store-checkout__title">
            购物车{" "}
            <span className="store-checkout__count" aria-label={`购物车数量 ${cartTotalQuantity}`}>
              ({cartTotalQuantity})
            </span>
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
                    aria-label={`减少 ${entry.sku.brand} ${entry.sku.model} 的数量`}
                    onClick={() => setCartQuantity(entry.sku.id, entry.quantity - 1)}
                  >
                    -
                  </button>
                  <span className="store-checkout__qty-value">{entry.quantity}</span>
                  <button
                    className="app-shell__header-action store-checkout__qty-btn"
                    type="button"
                    aria-label={`增加 ${entry.sku.brand} ${entry.sku.model} 的数量`}
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
                <option value="EXPRESS">快递（需地址）</option>
              </select>
            </label>

            <label className="store-checkout__field">
              <span className="store-checkout__field-label">
                <span className="store-checkout__field-icon" aria-hidden="true">
                  <IconRole />
                </span>
                岗位
              </span>
              <input
                value={applicantJobTitle}
                onChange={(event) => setApplicantJobTitle(event.target.value)}
                placeholder="例如：前端工程师"
              />
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
          </form>

          {expressNotSupported ? (
            <p className="store-precheck-result" role="note">
              快递申请请前往“领用购物车”页面填写地址后提交。
            </p>
          ) : null}

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
              onClick={() => void runPrecheck()}
            >
              {isPrechecking ? "预检中..." : "智能预检"}
            </button>
            <button
              className="auth-submit store-checkout__primary"
              type="button"
              disabled={!canSubmit}
              onClick={() => void submitApplication()}
            >
              {isSubmitting ? "提交中..." : "提交申请"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
