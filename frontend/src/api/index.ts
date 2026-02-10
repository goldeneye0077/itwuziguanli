import type { AppRole } from "../routes/blueprint-routes";

const API_PREFIX = "/api/v1";

export type SkuStockMode = "SERIALIZED" | "QUANTITY";

interface ApiErrorEnvelope {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly request_id?: string;
  readonly timestamp?: string;
}

interface ApiResponseEnvelope<TData> {
  readonly success: boolean;
  readonly data: TData | null;
  readonly error: ApiErrorEnvelope | null;
}

interface LoginResponseBody {
  readonly access_token: string;
  readonly expires_in: number;
  readonly user: {
    readonly id: number;
    readonly employee_no: string;
    readonly name: string;
    readonly roles: AppRole[];
    readonly permissions: string[];
  };
}

interface DashboardHeroResponseBody {
  readonly title: string;
  readonly subtitle: string | null;
  readonly image_url: string | null;
  readonly link_url: string | null;
}

interface AnnouncementItemResponseBody {
  readonly id: number;
  readonly title: string;
  readonly content: string;
  readonly published_at: string;
}

interface AnnouncementListResponseBody {
  readonly items: AnnouncementItemResponseBody[];
  readonly meta: {
    readonly page: number;
    readonly page_size: number;
    readonly total: number;
  };
}

interface MyAssetResponseBody {
  readonly id: number;
  readonly asset_tag: string;
  readonly sku_id: number;
  readonly sn: string;
  readonly status: string;
  readonly holder_user_id: number | null;
  readonly inbound_at: string;
}

interface CategoryTreeNodeResponseBody {
  readonly id: number;
  readonly name: string;
  readonly children: CategoryTreeNodeResponseBody[];
}

interface SkuResponseBody {
  readonly id: number;
  readonly category_id: number;
  readonly brand: string;
  readonly model: string;
  readonly spec: string;
  readonly reference_price: string;
  readonly cover_url: string | null;
  readonly stock_mode: SkuStockMode;
  readonly safety_stock_threshold: number;
  readonly available_stock: number;
}

interface SkuListResponseBody {
  readonly items: SkuResponseBody[];
  readonly meta: {
    readonly page: number;
    readonly page_size: number;
    readonly total: number;
  };
}

interface UserAddressResponseBody {
  readonly id: number;
  readonly user_id: number;
  readonly receiver_name: string;
  readonly receiver_phone: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
  readonly is_default: boolean;
}

interface ApplicationItemResponseBody {
  readonly id: number;
  readonly sku_id: number;
  readonly quantity: number;
  readonly note: string | null;
}

interface ApplicationAssetResponseBody {
  readonly application_asset_id: number;
  readonly asset_id: number;
}

interface ApplicationResponseBody {
  readonly id: number;
  readonly applicant_user_id: number;
  readonly type: string;
  readonly status: string;
  readonly delivery_type: "PICKUP" | "EXPRESS";
  readonly pickup_code: string;
  readonly pickup_qr_string: string | null;
  readonly created_at: string;
  readonly items: ApplicationItemResponseBody[];
  readonly locked_assets: ApplicationAssetResponseBody[];
  readonly express_address:
    | Omit<UserAddressResponseBody, "id" | "user_id" | "is_default">
    | UserAddressResponseBody
    | null;
}

interface AiPrecheckResponseBody {
  readonly recommendation: "PASS" | "REJECT";
  readonly reason: string;
}

interface ApprovalInboxItemResponseBody {
  readonly application_id: number;
  readonly applicant: {
    readonly id: number;
    readonly name: string;
    readonly department_id: number;
  };
  readonly delivery_type: "PICKUP" | "EXPRESS";
  readonly status: string;
  readonly created_at: string;
  readonly items_summary: Array<{
    readonly sku_id: number;
    readonly quantity: number;
  }>;
  readonly ai_suggestion: {
    readonly recommendation: "PASS" | "REJECT";
    readonly reason: string;
  } | null;
}

interface ApprovalInboxResponseBody {
  readonly items: ApprovalInboxItemResponseBody[];
  readonly meta: {
    readonly page: number;
    readonly page_size: number;
    readonly total: number;
  };
}

interface ApplicationDetailResponseBody {
  readonly application: {
    readonly id: number;
    readonly applicant_user_id: number;
    readonly type: string;
    readonly status: string;
    readonly delivery_type: "PICKUP" | "EXPRESS";
    readonly pickup_code: string;
    readonly pickup_qr_string: string | null;
    readonly created_at: string;
    readonly leader_approver_user_id: number | null;
    readonly admin_reviewer_user_id: number | null;
    readonly items: ApplicationItemResponseBody[];
  };
  readonly approval_history: Array<{
    readonly id: number;
    readonly node: "LEADER" | "ADMIN";
    readonly action: "APPROVE" | "REJECT";
    readonly actor_user_id: number;
    readonly comment: string | null;
    readonly ai_recommendation_json: {
      readonly recommendation?: "PASS" | "REJECT";
      readonly reason?: string;
    } | null;
    readonly created_at: string;
  }>;
  readonly logistics: {
    readonly id: number;
    readonly application_id: number;
    readonly receiver_name: string;
    readonly receiver_phone: string;
    readonly province: string;
    readonly city: string;
    readonly district: string;
    readonly detail: string;
    readonly carrier: string;
    readonly tracking_no: string;
    readonly shipped_at: string | null;
  } | null;
  readonly assigned_assets: Array<{
    readonly asset_id: number;
    readonly asset_tag: string;
    readonly sn: string;
    readonly sku_id: number;
    readonly status: string;
  }>;
}

interface ApplicationApprovalActionResponseBody {
  readonly application_id: number;
  readonly status: string;
}

interface ApplicationAssignAssetsResponseBody {
  readonly application_id: number;
  readonly status: string;
  readonly assigned_assets: Array<{
    readonly asset_id: number;
    readonly asset_tag: string;
    readonly sn: string;
    readonly sku_id: number;
    readonly sku_label?: string;
  }>;
}

interface PickupTicketResponseBody {
  readonly application_id: number;
  readonly pickup_code: string;
  readonly pickup_code_display: string;
  readonly pickup_qr_string: string;
  readonly expires_at: string | null;
  readonly items: Array<{
    readonly sku_id: number;
    readonly quantity: number;
  }>;
}

interface PickupVerifyResponseBody {
  readonly application_id: number;
  readonly status: string;
  readonly applicant_user_id: number;
  readonly items: Array<{
    readonly sku_id: number;
    readonly quantity: number;
  }>;
  readonly assigned_assets: Array<{
    readonly asset_id: number;
    readonly asset_tag: string;
    readonly sn: string;
  }>;
}

interface NotificationTestResponseBody {
  readonly id: number;
  readonly channel: "EMAIL" | "DINGTALK";
  readonly receiver: string;
  readonly template_key: string;
  readonly status: string;
  readonly created_at: string;
  readonly requested_at: string;
}

interface OutboundPickupQueueItemResponseBody {
  readonly application_id: number;
  readonly applicant_user_id: number;
  readonly pickup_code: string;
  readonly created_at: string;
  readonly items: Array<{
    readonly sku_id: number;
    readonly quantity: number;
  }>;
}

interface OutboundExpressQueueItemResponseBody {
  readonly application_id: number;
  readonly applicant_user_id: number;
  readonly created_at: string;
  readonly items: Array<{
    readonly sku_id: number;
    readonly quantity: number;
  }>;
}

interface OutboundQueueResponseBody<TItem> {
  readonly items: TItem[];
  readonly meta: {
    readonly page: number;
    readonly page_size: number;
    readonly total: number;
  };
}

interface OutboundConfirmPickupResponseBody {
  readonly application_id: number;
  readonly status: string;
  readonly delivered_assets: Array<{
    readonly asset_id: number;
    readonly asset_tag: string;
    readonly sn: string;
  }>;
  readonly delivered_items: Array<{
    readonly sku_id: number;
    readonly quantity: number;
  }>;
}

interface OutboundShipResponseBody {
  readonly application_id: number;
  readonly status: string;
  readonly delivered_assets: Array<{
    readonly asset_id: number;
    readonly asset_tag: string;
    readonly sn: string;
  }>;
  readonly delivered_items: Array<{
    readonly sku_id: number;
    readonly quantity: number;
  }>;
}

interface InboundOcrJobCreateResponseBody {
  readonly job_id: number;
  readonly status: string;
}

interface InboundOcrJobDetailResponseBody {
  readonly job_id: number;
  readonly status: string;
  readonly source_file_url: string;
  readonly extracted: Record<string, unknown>;
}

interface InboundCreatedAssetResponseBody {
  readonly asset_id: number;
  readonly asset_tag: string;
  readonly sn: string;
}

interface InboundOcrConfirmResponseBody {
  readonly sku_id: number;
  readonly inbound_quantity: number;
  readonly created_assets: InboundCreatedAssetResponseBody[];
}

interface AdminSkuResponseBody {
  readonly id: number;
  readonly category_id: number;
  readonly brand: string;
  readonly model: string;
  readonly spec: string;
  readonly reference_price: string;
  readonly cover_url: string | null;
  readonly stock_mode: SkuStockMode;
  readonly safety_stock_threshold: number;
}

interface AdminAssetResponseBody {
  readonly id: number;
  readonly asset_tag: string;
  readonly sku_id: number;
  readonly sn: string;
  readonly status: string;
  readonly holder_user_id: number | null;
  readonly locked_application_id: number | null;
  readonly inbound_at: string;
}

interface AdminAssetsCreateResponseBody {
  readonly sku_id: number;
  readonly created_assets: InboundCreatedAssetResponseBody[];
}

interface InventorySummaryResponseBody {
  readonly sku_id: number;
  readonly category_id: number;
  readonly brand: string;
  readonly model: string;
  readonly spec: string;
  readonly reference_price: string;
  readonly cover_url: string | null;
  readonly stock_mode: SkuStockMode;
  readonly safety_stock_threshold: number;
  readonly total_count: number;
  readonly in_stock_count: number;
  readonly locked_count: number;
  readonly in_use_count: number;
  readonly repairing_count: number;
  readonly scrapped_count: number;
  readonly on_hand_qty: number;
  readonly reserved_qty: number;
  readonly available_qty: number;
  readonly below_safety_stock: boolean;
}

export interface SessionUser {
  readonly id: number;
  readonly employeeNo: string;
  readonly name: string;
  readonly roles: AppRole[];
  readonly permissions: string[];
}

export interface LoginResult {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly user: SessionUser;
}

export interface DashboardHero {
  readonly title: string;
  readonly subtitle: string;
  readonly imageUrl: string | null;
  readonly linkUrl: string | null;
}

export interface AnnouncementItem {
  readonly id: number;
  readonly title: string;
  readonly content: string;
  readonly publishedAt: string;
}

export interface AnnouncementList {
  readonly items: AnnouncementItem[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}

export interface MyAssetItem {
  readonly id: number;
  readonly assetTag: string;
  readonly skuId: number;
  readonly sn: string;
  readonly status: string;
  readonly holderUserId: number | null;
  readonly inboundAt: string;
}

export interface CategoryTreeNode {
  readonly id: number;
  readonly name: string;
  readonly children: CategoryTreeNode[];
}

export interface SkuItem {
  readonly id: number;
  readonly categoryId: number;
  readonly brand: string;
  readonly model: string;
  readonly spec: string;
  readonly referencePrice: string;
  readonly coverUrl: string | null;
  readonly stockMode: SkuStockMode;
  readonly safetyStockThreshold: number;
  readonly availableStock: number;
}

export interface SkuList {
  readonly items: SkuItem[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}

export interface UserAddressItem {
  readonly id: number;
  readonly userId: number;
  readonly receiverName: string;
  readonly receiverPhone: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
  readonly isDefault: boolean;
}

export interface CreateAddressInput {
  readonly receiverName: string;
  readonly receiverPhone: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
  readonly isDefault: boolean;
}

export interface ApplicationItemInput {
  readonly skuId: number;
  readonly quantity: number;
  readonly note?: string;
}

export interface ApplicationCreateInput {
  readonly type: "APPLY" | "RETURN" | "REPAIR";
  readonly deliveryType: "PICKUP" | "EXPRESS";
  readonly items: ApplicationItemInput[];
  readonly expressAddressId?: number;
  readonly expressAddress?: {
    readonly receiverName: string;
    readonly receiverPhone: string;
    readonly province: string;
    readonly city: string;
    readonly district: string;
    readonly detail: string;
  };
  readonly applicantReason?: string;
  readonly applicantJobTitle?: string;
}

export interface ApplicationItemResult {
  readonly id: number;
  readonly skuId: number;
  readonly quantity: number;
  readonly note: string | null;
}

export interface ApplicationResult {
  readonly id: number;
  readonly applicantUserId: number;
  readonly type: string;
  readonly status: string;
  readonly deliveryType: "PICKUP" | "EXPRESS";
  readonly pickupCode: string;
  readonly pickupQrString: string | null;
  readonly createdAt: string;
  readonly items: ApplicationItemResult[];
  readonly lockedAssetIds: number[];
}

export interface AiPrecheckInput {
  readonly jobTitle: string;
  readonly reason: string;
  readonly items: ApplicationItemInput[];
}

export interface AiPrecheckResult {
  readonly recommendation: "PASS" | "REJECT";
  readonly reason: string;
}

export interface ApprovalInboxItem {
  readonly applicationId: number;
  readonly applicant: {
    readonly id: number;
    readonly name: string;
    readonly departmentId: number;
  };
  readonly deliveryType: "PICKUP" | "EXPRESS";
  readonly status: string;
  readonly createdAt: string;
  readonly itemsSummary: Array<{
    readonly skuId: number;
    readonly quantity: number;
  }>;
  readonly aiSuggestion: {
    readonly recommendation: "PASS" | "REJECT";
    readonly reason: string;
  } | null;
}

export interface ApprovalInboxResult {
  readonly items: ApprovalInboxItem[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}

export interface ApplicationDetailResult {
  readonly application: {
    readonly id: number;
    readonly applicantUserId: number;
    readonly type: string;
    readonly status: string;
    readonly deliveryType: "PICKUP" | "EXPRESS";
    readonly pickupCode: string;
    readonly pickupQrString: string | null;
    readonly createdAt: string;
    readonly leaderApproverUserId: number | null;
    readonly adminReviewerUserId: number | null;
    readonly items: ApplicationItemResult[];
  };
  readonly approvalHistory: Array<{
    readonly id: number;
    readonly node: "LEADER" | "ADMIN";
    readonly action: "APPROVE" | "REJECT";
    readonly actorUserId: number;
    readonly comment: string | null;
    readonly aiRecommendation:
      | {
          readonly recommendation?: "PASS" | "REJECT";
          readonly reason?: string;
        }
      | null;
    readonly createdAt: string;
  }>;
  readonly logistics:
    | {
        readonly id: number;
        readonly applicationId: number;
        readonly receiverName: string;
        readonly receiverPhone: string;
        readonly province: string;
        readonly city: string;
        readonly district: string;
        readonly detail: string;
        readonly carrier: string;
        readonly trackingNo: string;
        readonly shippedAt: string | null;
      }
    | null;
  readonly assignedAssets: Array<{
    readonly assetId: number;
    readonly assetTag: string;
    readonly sn: string;
    readonly skuId: number;
    readonly status: string;
  }>;
}

export interface AssignAssetsInput {
  readonly assignments: Array<{
    readonly skuId: number;
    readonly assetIds: number[];
  }>;
}

export interface PickupTicketResult {
  readonly applicationId: number;
  readonly pickupCode: string;
  readonly pickupCodeDisplay: string;
  readonly pickupQrString: string;
  readonly expiresAt: string | null;
  readonly items: Array<{
    readonly skuId: number;
    readonly quantity: number;
  }>;
}

export interface PickupVerifyResult {
  readonly applicationId: number;
  readonly status: string;
  readonly applicantUserId: number;
  readonly items: Array<{
    readonly skuId: number;
    readonly quantity: number;
  }>;
  readonly assignedAssets: Array<{
    readonly assetId: number;
    readonly assetTag: string;
    readonly sn: string;
  }>;
}

export interface NotificationTestResult {
  readonly id: number;
  readonly channel: "EMAIL" | "DINGTALK";
  readonly receiver: string;
  readonly templateKey: string;
  readonly status: string;
  readonly createdAt: string;
  readonly requestedAt: string;
}

export interface OutboundPickupQueueItem {
  readonly applicationId: number;
  readonly applicantUserId: number;
  readonly pickupCode: string;
  readonly createdAt: string;
  readonly items: Array<{
    readonly skuId: number;
    readonly quantity: number;
  }>;
}

export interface OutboundExpressQueueItem {
  readonly applicationId: number;
  readonly applicantUserId: number;
  readonly createdAt: string;
  readonly items: Array<{
    readonly skuId: number;
    readonly quantity: number;
  }>;
}

export interface OutboundQueueResult<TItem> {
  readonly items: TItem[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}

export interface OutboundConfirmPickupResult {
  readonly applicationId: number;
  readonly status: string;
  readonly deliveredAssets: Array<{
    readonly assetId: number;
    readonly assetTag: string;
    readonly sn: string;
  }>;
  readonly deliveredItems: Array<{
    readonly skuId: number;
    readonly quantity: number;
  }>;
}

export type InboundOcrDocType = "INVOICE" | "DELIVERY_NOTE" | "OTHER";

export interface InboundOcrJobSummary {
  readonly jobId: number;
  readonly status: string;
}

export interface InboundOcrJobDetail {
  readonly jobId: number;
  readonly status: string;
  readonly sourceFileUrl: string;
  readonly extracted: Record<string, unknown>;
}

export interface InboundCreatedAsset {
  readonly assetId: number;
  readonly assetTag: string;
  readonly sn: string;
}

export interface ConfirmInboundOcrInput {
  readonly sku: {
    readonly categoryId: number;
    readonly brand: string;
    readonly model: string;
    readonly spec: string;
    readonly referencePrice: string;
    readonly coverUrl?: string | null;
    readonly stockMode?: SkuStockMode;
    readonly safetyStockThreshold?: number;
  };
  readonly quantity?: number;
  readonly assets?: Array<{
    readonly sn: string;
    readonly inboundAt?: string;
  }>;
}

export interface InboundOcrConfirmResult {
  readonly skuId: number;
  readonly inboundQuantity: number;
  readonly createdAssets: InboundCreatedAsset[];
}

export interface AdminSkuItem {
  readonly id: number;
  readonly categoryId: number;
  readonly brand: string;
  readonly model: string;
  readonly spec: string;
  readonly referencePrice: string;
  readonly coverUrl: string | null;
  readonly stockMode: SkuStockMode;
  readonly safetyStockThreshold: number;
}

export interface CreateAdminSkuInput {
  readonly categoryId: number;
  readonly brand: string;
  readonly model: string;
  readonly spec: string;
  readonly referencePrice: string;
  readonly coverUrl?: string | null;
  readonly stockMode?: SkuStockMode;
  readonly safetyStockThreshold?: number;
}

export type UpdateAdminSkuInput = CreateAdminSkuInput;

interface UploadSkuImageResponseBody {
  readonly file_id: string;
  readonly url: string;
  readonly file_name: string;
  readonly file_size: number;
  readonly mime_type: string;
  readonly uploaded_at: string;
}

export interface UploadSkuImageResult {
  readonly fileId: string;
  readonly url: string;
  readonly fileName: string;
  readonly fileSize: number;
  readonly mimeType: string;
  readonly uploadedAt: string;
}

export type AdminAssetStatus =
  | "IN_STOCK"
  | "LOCKED"
  | "IN_USE"
  | "PENDING_INSPECTION"
  | "BORROWED"
  | "REPAIRING"
  | "SCRAPPED";

export interface AdminAssetItem {
  readonly id: number;
  readonly assetTag: string;
  readonly skuId: number;
  readonly sn: string;
  readonly status: AdminAssetStatus;
  readonly holderUserId: number | null;
  readonly lockedApplicationId: number | null;
  readonly inboundAt: string;
}

export interface CreateAdminAssetsInput {
  readonly skuId: number;
  readonly assets: Array<{
    readonly sn: string;
    readonly inboundAt?: string;
  }>;
}

export interface AdminAssetsCreateResult {
  readonly skuId: number;
  readonly createdAssets: InboundCreatedAsset[];
}

export interface UpdateAdminAssetInput {
  readonly skuId?: number;
  readonly sn?: string;
  readonly status?: AdminAssetStatus;
  readonly inboundAt?: string;
}

export interface InventorySummaryItem {
  readonly skuId: number;
  readonly categoryId: number;
  readonly brand: string;
  readonly model: string;
  readonly spec: string;
  readonly referencePrice: string;
  readonly coverUrl: string | null;
  readonly stockMode: SkuStockMode;
  readonly safetyStockThreshold: number;
  readonly totalCount: number;
  readonly inStockCount: number;
  readonly lockedCount: number;
  readonly inUseCount: number;
  readonly repairingCount: number;
  readonly scrappedCount: number;
  readonly onHandQty: number;
  readonly reservedQty: number;
  readonly availableQty: number;
  readonly belowSafetyStock: boolean;
}

export class AuthApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthApiError";
  }
}

function defaultErrorForStatus(status: number): AuthApiError {
  return new AuthApiError("REQUEST_FAILED", `请求失败（状态码 ${status}）。`);
}

async function requestApi<TData>(
  path: string,
  init: RequestInit,
): Promise<ApiResponseEnvelope<TData>> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
    ...init,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    // Avoid redirect loops for explicit auth flows; only invalidate for protected API calls.
    if (path !== "/auth/login" && path !== "/auth/logout") {
      window.dispatchEvent(new CustomEvent("pgc-auth-unauthorized"));
    }
  }

  let parsed: ApiResponseEnvelope<TData> | null = null;
  try {
    parsed = (await response.json()) as ApiResponseEnvelope<TData>;
  } catch {
    if (!response.ok) {
      throw defaultErrorForStatus(response.status);
    }
    throw new AuthApiError("INVALID_RESPONSE", "接口响应格式不正确。");
  }

  if (!response.ok || !parsed.success) {
    const error = parsed.error;
    throw new AuthApiError(
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? `请求失败（状态码 ${response.status}）。`,
    );
  }

  return parsed;
}

export async function loginWithPassword(
  employeeNo: string,
  password: string,
): Promise<LoginResult> {
  const envelope = await requestApi<LoginResponseBody>("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      employee_no: employeeNo,
      password,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "登录响应数据为空。");
  }

  return {
    accessToken: envelope.data.access_token,
    expiresIn: envelope.data.expires_in,
    user: {
      id: envelope.data.user.id,
      employeeNo: envelope.data.user.employee_no,
      name: envelope.data.user.name,
      roles: envelope.data.user.roles,
      permissions: envelope.data.user.permissions,
    },
  };
}

export async function logoutWithToken(accessToken: string): Promise<void> {
  if (!accessToken) {
    return;
  }

  await requestApi<{ logged_out: boolean }>("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function assertToken(accessToken: string): void {
  if (!accessToken) {
    throw new AuthApiError("UNAUTHORIZED", "缺少访问令牌。");
  }
}

export async function fetchDashboardHero(
  accessToken: string,
): Promise<DashboardHero> {
  assertToken(accessToken);
  const envelope = await requestApi<DashboardHeroResponseBody>("/dashboard/hero", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "首页横幅响应数据为空。");
  }

  return {
    title: envelope.data.title,
    subtitle: envelope.data.subtitle ?? "",
    imageUrl: envelope.data.image_url,
    linkUrl: envelope.data.link_url,
  };
}

export async function fetchAnnouncements(
  accessToken: string,
  page: number,
  pageSize: number,
): Promise<AnnouncementList> {
  assertToken(accessToken);
  const envelope = await requestApi<AnnouncementListResponseBody>(
    `/announcements?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!envelope.data) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      "公告列表响应数据为空。",
    );
  }

  return {
    items: envelope.data.items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      publishedAt: item.published_at,
    })),
    meta: {
      page: envelope.data.meta.page,
      pageSize: envelope.data.meta.page_size,
      total: envelope.data.meta.total,
    },
  };
}

export async function fetchMyAssets(
  accessToken: string,
): Promise<MyAssetItem[]> {
  assertToken(accessToken);
  const envelope = await requestApi<MyAssetResponseBody[]>("/me/assets", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!envelope.data) {
    return [];
  }

  return envelope.data.map((item) => ({
    id: item.id,
    assetTag: item.asset_tag,
    skuId: item.sku_id,
    sn: item.sn,
    status: item.status,
    holderUserId: item.holder_user_id,
    inboundAt: item.inbound_at,
  }));
}

export async function fetchCategoryTree(
  accessToken: string,
): Promise<CategoryTreeNode[]> {
  assertToken(accessToken);
  const envelope = await requestApi<CategoryTreeNodeResponseBody[]>("/categories/tree", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return envelope.data ?? [];
}

interface AdminCategoryResponseBody {
  readonly id: number;
  readonly name: string;
  readonly parent_id: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AdminCategoryItem {
  readonly id: number;
  readonly name: string;
  readonly parentId: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAdminCategoryInput {
  readonly name: string;
  readonly parentId?: number | null;
}

export type UpdateAdminCategoryInput = CreateAdminCategoryInput;

export async function createAdminCategory(
  accessToken: string,
  input: CreateAdminCategoryInput,
): Promise<AdminCategoryItem> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminCategoryResponseBody>("/admin/categories", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      parent_id: input.parentId ?? null,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "创建分类响应数据为空。");
  }

  return {
    id: envelope.data.id,
    name: envelope.data.name,
    parentId: envelope.data.parent_id,
    createdAt: envelope.data.created_at,
    updatedAt: envelope.data.updated_at,
  };
}

export async function updateAdminCategory(
  accessToken: string,
  categoryId: number,
  input: UpdateAdminCategoryInput,
): Promise<AdminCategoryItem> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminCategoryResponseBody>(`/admin/categories/${categoryId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      parent_id: input.parentId ?? null,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "更新分类响应数据为空。");
  }

  return {
    id: envelope.data.id,
    name: envelope.data.name,
    parentId: envelope.data.parent_id,
    createdAt: envelope.data.created_at,
    updatedAt: envelope.data.updated_at,
  };
}

export async function deleteAdminCategory(
  accessToken: string,
  categoryId: number,
): Promise<void> {
  assertToken(accessToken);
  await requestApi<{ deleted: boolean; id: number }>(`/admin/categories/${categoryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function fetchSkus(
  accessToken: string,
  options: {
    readonly categoryId?: number;
    readonly keyword?: string;
    readonly page: number;
    readonly pageSize: number;
  },
): Promise<SkuList> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(options.page));
  searchParams.set("page_size", String(options.pageSize));
  if (options.categoryId) {
    searchParams.set("category_id", String(options.categoryId));
  }
  if (options.keyword && options.keyword.trim()) {
    searchParams.set("keyword", options.keyword.trim());
  }

  const envelope = await requestApi<SkuListResponseBody>(`/skus?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!envelope.data) {
    return {
      items: [],
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        total: 0,
      },
    };
  }

  return {
    items: envelope.data.items.map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      brand: item.brand,
      model: item.model,
      spec: item.spec,
      referencePrice: item.reference_price,
      coverUrl: item.cover_url,
      stockMode: item.stock_mode,
      safetyStockThreshold: item.safety_stock_threshold,
      availableStock: item.available_stock,
    })),
    meta: {
      page: envelope.data.meta.page,
      pageSize: envelope.data.meta.page_size,
      total: envelope.data.meta.total,
    },
  };
}

export async function fetchMyAddresses(
  accessToken: string,
): Promise<UserAddressItem[]> {
  assertToken(accessToken);
  const envelope = await requestApi<UserAddressResponseBody[]>("/me/addresses", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const items = envelope.data ?? [];
  return items.map((item) => ({
    id: item.id,
    userId: item.user_id,
    receiverName: item.receiver_name,
    receiverPhone: item.receiver_phone,
    province: item.province,
    city: item.city,
    district: item.district,
    detail: item.detail,
    isDefault: item.is_default,
  }));
}

export async function createMyAddress(
  accessToken: string,
  input: CreateAddressInput,
): Promise<UserAddressItem> {
  assertToken(accessToken);
  const envelope = await requestApi<UserAddressResponseBody>("/me/addresses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receiver_name: input.receiverName,
      receiver_phone: input.receiverPhone,
      province: input.province,
      city: input.city,
      district: input.district,
      detail: input.detail,
      is_default: input.isDefault,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "地址响应数据为空。");
  }

  return {
    id: envelope.data.id,
    userId: envelope.data.user_id,
    receiverName: envelope.data.receiver_name,
    receiverPhone: envelope.data.receiver_phone,
    province: envelope.data.province,
    city: envelope.data.city,
    district: envelope.data.district,
    detail: envelope.data.detail,
    isDefault: envelope.data.is_default,
  };
}

export async function createApplication(
  accessToken: string,
  input: ApplicationCreateInput,
): Promise<ApplicationResult> {
  assertToken(accessToken);
  const envelope = await requestApi<ApplicationResponseBody>("/applications", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: input.type,
      delivery_type: input.deliveryType,
      items: input.items.map((item) => ({
        sku_id: item.skuId,
        quantity: item.quantity,
        note: item.note,
      })),
      express_address_id: input.expressAddressId,
      express_address: input.expressAddress
        ? {
            receiver_name: input.expressAddress.receiverName,
            receiver_phone: input.expressAddress.receiverPhone,
            province: input.expressAddress.province,
            city: input.expressAddress.city,
            district: input.expressAddress.district,
            detail: input.expressAddress.detail,
          }
        : undefined,
      applicant_reason: input.applicantReason,
      applicant_job_title: input.applicantJobTitle,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      "申请单响应数据为空。",
    );
  }

  return {
    id: envelope.data.id,
    applicantUserId: envelope.data.applicant_user_id,
    type: envelope.data.type,
    status: envelope.data.status,
    deliveryType: envelope.data.delivery_type,
    pickupCode: envelope.data.pickup_code,
    pickupQrString: envelope.data.pickup_qr_string,
    createdAt: envelope.data.created_at,
    items: envelope.data.items.map((item) => ({
      id: item.id,
      skuId: item.sku_id,
      quantity: item.quantity,
      note: item.note,
    })),
    lockedAssetIds: envelope.data.locked_assets.map((item) => item.asset_id),
  };
}

export async function requestAiPrecheck(
  accessToken: string,
  input: AiPrecheckInput,
): Promise<AiPrecheckResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AiPrecheckResponseBody>("/ai/precheck", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_title: input.jobTitle,
      reason: input.reason,
      items: input.items.map((item) => ({
        sku_id: item.skuId,
        quantity: item.quantity,
      })),
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      "智能预检响应数据为空。",
    );
  }

  return {
    recommendation: envelope.data.recommendation,
    reason: envelope.data.reason,
  };
}

export async function fetchApprovalInbox(
  accessToken: string,
  options: {
    readonly node: "LEADER" | "ADMIN";
    readonly page: number;
    readonly pageSize: number;
  },
): Promise<ApprovalInboxResult> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  searchParams.set("node", options.node);
  searchParams.set("page", String(options.page));
  searchParams.set("page_size", String(options.pageSize));

  const envelope = await requestApi<ApprovalInboxResponseBody>(
    `/approvals/inbox?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!envelope.data) {
    return {
      items: [],
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        total: 0,
      },
    };
  }

  return {
    items: envelope.data.items.map((item) => ({
      applicationId: item.application_id,
      applicant: {
        id: item.applicant.id,
        name: item.applicant.name,
        departmentId: item.applicant.department_id,
      },
      deliveryType: item.delivery_type,
      status: item.status,
      createdAt: item.created_at,
      itemsSummary: item.items_summary.map((summary) => ({
        skuId: summary.sku_id,
        quantity: summary.quantity,
      })),
      aiSuggestion: item.ai_suggestion,
    })),
    meta: {
      page: envelope.data.meta.page,
      pageSize: envelope.data.meta.page_size,
      total: envelope.data.meta.total,
    },
  };
}

export async function fetchApplicationDetail(
  accessToken: string,
  applicationId: number,
): Promise<ApplicationDetailResult> {
  assertToken(accessToken);
  const envelope = await requestApi<ApplicationDetailResponseBody>(
    `/applications/${applicationId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "申请单详情响应数据为空。");
  }

  return {
    application: {
      id: envelope.data.application.id,
      applicantUserId: envelope.data.application.applicant_user_id,
      type: envelope.data.application.type,
      status: envelope.data.application.status,
      deliveryType: envelope.data.application.delivery_type,
      pickupCode: envelope.data.application.pickup_code,
      pickupQrString: envelope.data.application.pickup_qr_string,
      createdAt: envelope.data.application.created_at,
      leaderApproverUserId: envelope.data.application.leader_approver_user_id,
      adminReviewerUserId: envelope.data.application.admin_reviewer_user_id,
      items: envelope.data.application.items.map((item) => ({
        id: item.id,
        skuId: item.sku_id,
        quantity: item.quantity,
        note: item.note,
      })),
    },
    approvalHistory: envelope.data.approval_history.map((item) => ({
      id: item.id,
      node: item.node,
      action: item.action,
      actorUserId: item.actor_user_id,
      comment: item.comment,
      aiRecommendation: item.ai_recommendation_json,
      createdAt: item.created_at,
    })),
    logistics: envelope.data.logistics
      ? {
          id: envelope.data.logistics.id,
          applicationId: envelope.data.logistics.application_id,
          receiverName: envelope.data.logistics.receiver_name,
          receiverPhone: envelope.data.logistics.receiver_phone,
          province: envelope.data.logistics.province,
          city: envelope.data.logistics.city,
          district: envelope.data.logistics.district,
          detail: envelope.data.logistics.detail,
          carrier: envelope.data.logistics.carrier,
          trackingNo: envelope.data.logistics.tracking_no,
          shippedAt: envelope.data.logistics.shipped_at,
        }
      : null,
    assignedAssets: envelope.data.assigned_assets.map((item) => ({
      assetId: item.asset_id,
      assetTag: item.asset_tag,
      sn: item.sn,
      skuId: item.sku_id,
      status: item.status,
    })),
  };
}

export async function approveApplicationByNode(
  accessToken: string,
  input: {
    readonly applicationId: number;
    readonly node: "LEADER" | "ADMIN";
    readonly action: "APPROVE" | "REJECT";
    readonly comment?: string;
  },
): Promise<{ applicationId: number; status: string }> {
  assertToken(accessToken);
  const envelope = await requestApi<ApplicationApprovalActionResponseBody>(
    `/applications/${input.applicationId}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        node: input.node,
        action: input.action,
        comment: input.comment,
      }),
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "审批响应数据为空。");
  }

  return {
    applicationId: envelope.data.application_id,
    status: envelope.data.status,
  };
}

export async function assignApplicationAssets(
  accessToken: string,
  applicationId: number,
  input: AssignAssetsInput,
): Promise<{ applicationId: number; status: string; assignedAssetIds: number[] }> {
  assertToken(accessToken);
  const envelope = await requestApi<ApplicationAssignAssetsResponseBody>(
    `/applications/${applicationId}/assign-assets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignments: input.assignments.map((item) => ({
          sku_id: item.skuId,
          asset_ids: item.assetIds,
        })),
      }),
    },
  );

  if (!envelope.data) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      "资产分配响应数据为空。",
    );
  }

  return {
    applicationId: envelope.data.application_id,
    status: envelope.data.status,
    assignedAssetIds: envelope.data.assigned_assets.map((item) => item.asset_id),
  };
}

export async function fetchPickupTicket(
  accessToken: string,
  applicationId: number,
): Promise<PickupTicketResult> {
  assertToken(accessToken);
  const envelope = await requestApi<PickupTicketResponseBody>(
    `/applications/${applicationId}/pickup-ticket`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "取件凭证响应数据为空。");
  }

  return {
    applicationId: envelope.data.application_id,
    pickupCode: envelope.data.pickup_code,
    pickupCodeDisplay: envelope.data.pickup_code_display,
    pickupQrString: envelope.data.pickup_qr_string,
    expiresAt: envelope.data.expires_at,
    items: envelope.data.items.map((item) => ({
      skuId: item.sku_id,
      quantity: item.quantity,
    })),
  };
}

export async function verifyPickup(
  accessToken: string,
  input: {
    readonly verifyType: "QR" | "CODE";
    readonly value: string;
  },
): Promise<PickupVerifyResult> {
  assertToken(accessToken);
  const envelope = await requestApi<PickupVerifyResponseBody>("/pickup/verify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      verify_type: input.verifyType,
      value: input.value,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "取件核验响应数据为空。");
  }

  return {
    applicationId: envelope.data.application_id,
    status: envelope.data.status,
    applicantUserId: envelope.data.applicant_user_id,
    items: envelope.data.items.map((item) => ({
      skuId: item.sku_id,
      quantity: item.quantity,
    })),
    assignedAssets: envelope.data.assigned_assets.map((asset) => ({
      assetId: asset.asset_id,
      assetTag: asset.asset_tag,
      sn: asset.sn,
    })),
  };
}

export async function sendNotificationTest(
  accessToken: string,
  input: {
    readonly channel: "EMAIL" | "DINGTALK";
    readonly receiver: string;
    readonly message?: string;
  },
): Promise<NotificationTestResult> {
  assertToken(accessToken);
  const envelope = await requestApi<NotificationTestResponseBody>(
    "/admin/notifications/test",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: input.channel,
        receiver: input.receiver,
        message: input.message,
      }),
    },
  );

  if (!envelope.data) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      "通知测试响应数据为空。",
    );
  }

  return {
    id: envelope.data.id,
    channel: envelope.data.channel,
    receiver: envelope.data.receiver,
    templateKey: envelope.data.template_key,
    status: envelope.data.status,
    createdAt: envelope.data.created_at,
    requestedAt: envelope.data.requested_at,
  };
}

export async function fetchOutboundPickupQueue(
  accessToken: string,
  options: {
    readonly page: number;
    readonly pageSize: number;
  },
): Promise<OutboundQueueResult<OutboundPickupQueueItem>> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(options.page));
  searchParams.set("page_size", String(options.pageSize));

  const envelope = await requestApi<
    OutboundQueueResponseBody<OutboundPickupQueueItemResponseBody>
  >(`/outbound/pickup-queue?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!envelope.data) {
    return {
      items: [],
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        total: 0,
      },
    };
  }

  return {
    items: envelope.data.items.map((item) => ({
      applicationId: item.application_id,
      applicantUserId: item.applicant_user_id,
      pickupCode: item.pickup_code,
      createdAt: item.created_at,
      items: item.items.map((row) => ({
        skuId: row.sku_id,
        quantity: row.quantity,
      })),
    })),
    meta: {
      page: envelope.data.meta.page,
      pageSize: envelope.data.meta.page_size,
      total: envelope.data.meta.total,
    },
  };
}

export async function confirmOutboundPickup(
  accessToken: string,
  input: {
    readonly verifyType: "QR" | "CODE" | "APPLICATION_ID";
    readonly value: string;
  },
): Promise<OutboundConfirmPickupResult> {
  assertToken(accessToken);
  const envelope = await requestApi<OutboundConfirmPickupResponseBody>(
    "/outbound/confirm-pickup",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        verify_type: input.verifyType,
        value: input.value,
      }),
    },
  );

  if (!envelope.data) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      "确认自提响应数据为空。",
    );
  }

  return {
    applicationId: envelope.data.application_id,
    status: envelope.data.status,
    deliveredAssets: envelope.data.delivered_assets.map((asset) => ({
      assetId: asset.asset_id,
      assetTag: asset.asset_tag,
      sn: asset.sn,
    })),
    deliveredItems: envelope.data.delivered_items.map((item) => ({
      skuId: item.sku_id,
      quantity: item.quantity,
    })),
  };
}

export async function fetchOutboundExpressQueue(
  accessToken: string,
  options: {
    readonly page: number;
    readonly pageSize: number;
  },
): Promise<OutboundQueueResult<OutboundExpressQueueItem>> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(options.page));
  searchParams.set("page_size", String(options.pageSize));

  const envelope = await requestApi<
    OutboundQueueResponseBody<OutboundExpressQueueItemResponseBody>
  >(`/outbound/express-queue?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!envelope.data) {
    return {
      items: [],
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        total: 0,
      },
    };
  }

  return {
    items: envelope.data.items.map((item) => ({
      applicationId: item.application_id,
      applicantUserId: item.applicant_user_id,
      createdAt: item.created_at,
      items: item.items.map((row) => ({
        skuId: row.sku_id,
        quantity: row.quantity,
      })),
    })),
    meta: {
      page: envelope.data.meta.page,
      pageSize: envelope.data.meta.page_size,
      total: envelope.data.meta.total,
    },
  };
}

export async function shipOutbound(
  accessToken: string,
  input: {
    readonly applicationId: number;
    readonly carrier: string;
    readonly trackingNo: string;
    readonly shippedAt?: string;
  },
): Promise<{ applicationId: number; status: string }> {
  assertToken(accessToken);
  const envelope = await requestApi<OutboundShipResponseBody>("/outbound/ship", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      application_id: input.applicationId,
      carrier: input.carrier,
      tracking_no: input.trackingNo,
      shipped_at: input.shippedAt,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "发货响应数据为空。");
  }

  return {
    applicationId: envelope.data.application_id,
    status: envelope.data.status,
  };
}

export async function createInboundOcrJob(
  accessToken: string,
  file: File,
  docType?: InboundOcrDocType,
): Promise<InboundOcrJobSummary> {
  assertToken(accessToken);
  const formData = new FormData();
  formData.append("file", file);
  if (docType) {
    formData.append("doc_type", docType);
  }

  const envelope = await requestApi<InboundOcrJobCreateResponseBody>('/inbound/ocr-jobs', {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "创建单据识别任务响应数据为空。");
  }

  return {
    jobId: envelope.data.job_id,
    status: envelope.data.status,
  };
}

export async function fetchInboundOcrJob(
  accessToken: string,
  jobId: number,
): Promise<InboundOcrJobDetail> {
  assertToken(accessToken);
  const envelope = await requestApi<InboundOcrJobDetailResponseBody>(
    `/inbound/ocr-jobs/${jobId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "单据识别任务详情响应数据为空。");
  }

  return {
    jobId: envelope.data.job_id,
    status: envelope.data.status,
    sourceFileUrl: envelope.data.source_file_url,
    extracted: envelope.data.extracted,
  };
}

export async function confirmInboundOcrJob(
  accessToken: string,
  jobId: number,
  input: ConfirmInboundOcrInput,
): Promise<InboundOcrConfirmResult> {
  assertToken(accessToken);
  const assets = input.assets ?? [];
  const normalizedQuantity = input.quantity ?? (assets.length > 0 ? assets.length : 1);
  const envelope = await requestApi<InboundOcrConfirmResponseBody>(
    `/inbound/ocr-jobs/${jobId}/confirm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sku: {
          category_id: input.sku.categoryId,
          brand: input.sku.brand,
          model: input.sku.model,
          spec: input.sku.spec,
          reference_price: input.sku.referencePrice,
          cover_url: input.sku.coverUrl,
          stock_mode: input.sku.stockMode ?? "SERIALIZED",
          safety_stock_threshold: input.sku.safetyStockThreshold ?? 0,
        },
        quantity: normalizedQuantity,
        assets: assets.map((asset) => ({
          sn: asset.sn,
          inbound_at: asset.inboundAt,
        })),
      }),
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "单据识别任务确认响应数据为空。");
  }

  return {
    skuId: envelope.data.sku_id,
    inboundQuantity: envelope.data.inbound_quantity,
    createdAssets: envelope.data.created_assets.map((asset) => ({
      assetId: asset.asset_id,
      assetTag: asset.asset_tag,
      sn: asset.sn,
    })),
  };
}

export async function fetchAdminSkus(
  accessToken: string,
  options?: {
    readonly skuId?: number;
    readonly categoryId?: number;
    readonly q?: string;
  },
): Promise<AdminSkuItem[]> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  if (options?.skuId) {
    searchParams.set("sku_id", String(options.skuId));
  }
  if (options?.categoryId) {
    searchParams.set("category_id", String(options.categoryId));
  }
  if (options?.q && options.q.trim()) {
    searchParams.set("q", options.q.trim());
  }

  const query = searchParams.toString();
  const path = query ? `/admin/skus?${query}` : "/admin/skus";

  const envelope = await requestApi<AdminSkuResponseBody[]>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return (envelope.data ?? []).map((item) => ({
    id: item.id,
    categoryId: item.category_id,
    brand: item.brand,
    model: item.model,
    spec: item.spec,
    referencePrice: item.reference_price,
    coverUrl: item.cover_url,
    stockMode: item.stock_mode,
    safetyStockThreshold: item.safety_stock_threshold,
  }));
}

export async function uploadSkuImage(
  accessToken: string,
  file: File,
): Promise<UploadSkuImageResult> {
  assertToken(accessToken);

  const formData = new FormData();
  formData.append("file", file);

  const envelope = await requestApi<UploadSkuImageResponseBody>("/upload/sku-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "上传 SKU 图片响应数据为空。");
  }

  return {
    fileId: envelope.data.file_id,
    url: envelope.data.url,
    fileName: envelope.data.file_name,
    fileSize: envelope.data.file_size,
    mimeType: envelope.data.mime_type,
    uploadedAt: envelope.data.uploaded_at,
  };
}

export async function createAdminSku(
  accessToken: string,
  input: CreateAdminSkuInput,
): Promise<AdminSkuItem> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminSkuResponseBody>('/admin/skus', {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      category_id: input.categoryId,
      brand: input.brand,
      model: input.model,
      spec: input.spec,
      reference_price: input.referencePrice,
      cover_url: input.coverUrl,
      stock_mode: input.stockMode ?? "SERIALIZED",
      safety_stock_threshold: input.safetyStockThreshold ?? 0,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "创建物料响应数据为空。");
  }

  return {
    id: envelope.data.id,
    categoryId: envelope.data.category_id,
    brand: envelope.data.brand,
    model: envelope.data.model,
    spec: envelope.data.spec,
    referencePrice: envelope.data.reference_price,
    coverUrl: envelope.data.cover_url,
    stockMode: envelope.data.stock_mode,
    safetyStockThreshold: envelope.data.safety_stock_threshold,
  };
}

export async function updateAdminSku(
  accessToken: string,
  skuId: number,
  input: UpdateAdminSkuInput,
): Promise<AdminSkuItem> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminSkuResponseBody>(`/admin/skus/${skuId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      category_id: input.categoryId,
      brand: input.brand,
      model: input.model,
      spec: input.spec,
      reference_price: input.referencePrice,
      cover_url: input.coverUrl,
      stock_mode: input.stockMode ?? "SERIALIZED",
      safety_stock_threshold: input.safetyStockThreshold ?? 0,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "更新物料响应数据为空。");
  }

  return {
    id: envelope.data.id,
    categoryId: envelope.data.category_id,
    brand: envelope.data.brand,
    model: envelope.data.model,
    spec: envelope.data.spec,
    referencePrice: envelope.data.reference_price,
    coverUrl: envelope.data.cover_url,
    stockMode: envelope.data.stock_mode,
    safetyStockThreshold: envelope.data.safety_stock_threshold,
  };
}

export async function deleteAdminSku(accessToken: string, skuId: number): Promise<void> {
  assertToken(accessToken);
  await requestApi<{ deleted: boolean; id: number }>(`/admin/skus/${skuId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function fetchAdminAssets(
  accessToken: string,
  options?: {
    readonly skuId?: number;
    readonly status?: AdminAssetStatus;
  },
): Promise<AdminAssetItem[]> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  if (options?.skuId) {
    searchParams.set("sku_id", String(options.skuId));
  }
  if (options?.status) {
    searchParams.set("status", options.status);
  }
  const query = searchParams.toString();
  const path = query ? `/admin/assets?${query}` : "/admin/assets";

  const envelope = await requestApi<AdminAssetResponseBody[]>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return (envelope.data ?? []).map((item) => ({
    id: item.id,
    assetTag: item.asset_tag,
    skuId: item.sku_id,
    sn: item.sn,
    status: item.status as AdminAssetStatus,
    holderUserId: item.holder_user_id,
    lockedApplicationId: item.locked_application_id,
    inboundAt: item.inbound_at,
  }));
}

export async function createAdminAssets(
  accessToken: string,
  input: CreateAdminAssetsInput,
): Promise<AdminAssetsCreateResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminAssetsCreateResponseBody>('/admin/assets', {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sku_id: input.skuId,
      assets: input.assets.map((asset) => ({
        sn: asset.sn,
        inbound_at: asset.inboundAt,
      })),
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "创建资产响应数据为空。");
  }

  return {
    skuId: envelope.data.sku_id,
    createdAssets: envelope.data.created_assets.map((asset) => ({
      assetId: asset.asset_id,
      assetTag: asset.asset_tag,
      sn: asset.sn,
    })),
  };
}

export async function updateAdminAsset(
  accessToken: string,
  assetId: number,
  input: UpdateAdminAssetInput,
): Promise<AdminAssetItem> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminAssetResponseBody>(`/admin/assets/${assetId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sku_id: input.skuId,
      sn: input.sn,
      status: input.status,
      inbound_at: input.inboundAt,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "更新资产响应数据为空。");
  }

  return {
    id: envelope.data.id,
    assetTag: envelope.data.asset_tag,
    skuId: envelope.data.sku_id,
    sn: envelope.data.sn,
    status: envelope.data.status as AdminAssetStatus,
    holderUserId: envelope.data.holder_user_id,
    lockedApplicationId: envelope.data.locked_application_id,
    inboundAt: envelope.data.inbound_at,
  };
}

export async function deleteAdminAsset(
  accessToken: string,
  assetId: number,
): Promise<void> {
  assertToken(accessToken);
  await requestApi<{ deleted: boolean; id: number }>(`/admin/assets/${assetId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function fetchInventorySummary(
  accessToken: string,
  options?: {
    readonly skuId?: number;
    readonly categoryId?: number;
    readonly q?: string;
    readonly belowThreshold?: boolean;
  },
): Promise<InventorySummaryItem[]> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  if (options?.skuId) {
    searchParams.set("sku_id", String(options.skuId));
  }
  if (options?.categoryId) {
    searchParams.set("category_id", String(options.categoryId));
  }
  if (options?.q && options.q.trim()) {
    searchParams.set("q", options.q.trim());
  }
  if (options?.belowThreshold) {
    searchParams.set("below_threshold", "true");
  }
  const query = searchParams.toString();
  const path = query ? `/inventory/summary?${query}` : "/inventory/summary";

  const envelope = await requestApi<InventorySummaryResponseBody[]>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return (envelope.data ?? []).map((item) => ({
    skuId: item.sku_id,
    categoryId: item.category_id,
    brand: item.brand,
    model: item.model,
    spec: item.spec,
    referencePrice: item.reference_price,
    coverUrl: item.cover_url,
    stockMode: item.stock_mode,
    safetyStockThreshold: item.safety_stock_threshold,
    totalCount: item.total_count,
    inStockCount: item.in_stock_count,
    lockedCount: item.locked_count,
    inUseCount: item.in_use_count,
    repairingCount: item.repairing_count,
    scrappedCount: item.scrapped_count,
    onHandQty: item.on_hand_qty,
    reservedQty: item.reserved_qty,
    availableQty: item.available_qty,
    belowSafetyStock: item.below_safety_stock,
  }));
}

export type SkuStockFlowAction =
  | "INBOUND"
  | "OUTBOUND"
  | "ADJUST"
  | "LOCK"
  | "UNLOCK"
  | "SHIP";

interface SkuStockSnapshotResponseBody {
  readonly sku_id: number;
  readonly on_hand_qty: number;
  readonly reserved_qty: number;
  readonly available_qty: number;
}

export interface SkuStockSnapshot {
  readonly skuId: number;
  readonly onHandQty: number;
  readonly reservedQty: number;
  readonly availableQty: number;
}

export async function inboundSkuStock(
  accessToken: string,
  skuId: number,
  input: { readonly quantity: number; readonly note?: string; readonly occurredAt?: string },
): Promise<SkuStockSnapshot> {
  assertToken(accessToken);
  const envelope = await requestApi<SkuStockSnapshotResponseBody>(`/admin/sku-stocks/${skuId}/inbound`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quantity: input.quantity,
      note: input.note,
      occurred_at: input.occurredAt,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "数量入库响应数据为空。");
  }

  return {
    skuId: envelope.data.sku_id,
    onHandQty: envelope.data.on_hand_qty,
    reservedQty: envelope.data.reserved_qty,
    availableQty: envelope.data.available_qty,
  };
}

export async function outboundSkuStock(
  accessToken: string,
  skuId: number,
  input: { readonly quantity: number; readonly reason: string; readonly occurredAt?: string },
): Promise<SkuStockSnapshot> {
  assertToken(accessToken);
  const envelope = await requestApi<SkuStockSnapshotResponseBody>(`/admin/sku-stocks/${skuId}/outbound`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quantity: input.quantity,
      reason: input.reason,
      occurred_at: input.occurredAt,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "数量出库响应数据为空。");
  }

  return {
    skuId: envelope.data.sku_id,
    onHandQty: envelope.data.on_hand_qty,
    reservedQty: envelope.data.reserved_qty,
    availableQty: envelope.data.available_qty,
  };
}

export async function adjustSkuStock(
  accessToken: string,
  skuId: number,
  input: { readonly newOnHandQty: number; readonly reason: string; readonly occurredAt?: string },
): Promise<SkuStockSnapshot> {
  assertToken(accessToken);
  const envelope = await requestApi<SkuStockSnapshotResponseBody>(`/admin/sku-stocks/${skuId}/adjust`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      new_on_hand_qty: input.newOnHandQty,
      reason: input.reason,
      occurred_at: input.occurredAt,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "盘点调整响应数据为空。");
  }

  return {
    skuId: envelope.data.sku_id,
    onHandQty: envelope.data.on_hand_qty,
    reservedQty: envelope.data.reserved_qty,
    availableQty: envelope.data.available_qty,
  };
}

interface SkuStockFlowResponseBody {
  readonly id: number;
  readonly sku_id: number;
  readonly action: SkuStockFlowAction;
  readonly on_hand_delta: number;
  readonly reserved_delta: number;
  readonly on_hand_qty_after: number;
  readonly reserved_qty_after: number;
  readonly operator_user_id: number;
  readonly operator_user_name: string;
  readonly related_application_id: number | null;
  readonly occurred_at: string;
  readonly meta_json: unknown;
}

interface SkuStockFlowListResponseBody {
  readonly items: SkuStockFlowResponseBody[];
  readonly meta: {
    readonly page: number;
    readonly page_size: number;
    readonly total: number;
  };
}

export interface SkuStockFlowItem {
  readonly id: number;
  readonly skuId: number;
  readonly action: SkuStockFlowAction;
  readonly onHandDelta: number;
  readonly reservedDelta: number;
  readonly onHandQtyAfter: number;
  readonly reservedQtyAfter: number;
  readonly operatorUserId: number;
  readonly operatorUserName: string;
  readonly relatedApplicationId: number | null;
  readonly occurredAt: string;
  readonly metaJson: unknown;
}

export interface SkuStockFlowListResult {
  readonly items: SkuStockFlowItem[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}

export async function fetchSkuStockFlows(
  accessToken: string,
  skuId: number,
  options?: {
    readonly action?: SkuStockFlowAction;
    readonly from?: string;
    readonly to?: string;
    readonly page?: number;
    readonly pageSize?: number;
  },
): Promise<SkuStockFlowListResult> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  if (options?.action) {
    searchParams.set("action", options.action);
  }
  if (options?.from) {
    searchParams.set("from", options.from);
  }
  if (options?.to) {
    searchParams.set("to", options.to);
  }
  searchParams.set("page", String(options?.page ?? 1));
  searchParams.set("page_size", String(options?.pageSize ?? 20));

  const envelope = await requestApi<SkuStockFlowListResponseBody>(
    `/admin/sku-stocks/${skuId}/flows?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!envelope.data) {
    return {
      items: [],
      meta: { page: options?.page ?? 1, pageSize: options?.pageSize ?? 20, total: 0 },
    };
  }

  return {
    items: envelope.data.items.map((item) => ({
      id: item.id,
      skuId: item.sku_id,
      action: item.action,
      onHandDelta: item.on_hand_delta,
      reservedDelta: item.reserved_delta,
      onHandQtyAfter: item.on_hand_qty_after,
      reservedQtyAfter: item.reserved_qty_after,
      operatorUserId: item.operator_user_id,
      operatorUserName: item.operator_user_name,
      relatedApplicationId: item.related_application_id,
      occurredAt: item.occurred_at,
      metaJson: item.meta_json,
    })),
    meta: {
      page: envelope.data.meta.page,
      pageSize: envelope.data.meta.page_size,
      total: envelope.data.meta.total,
    },
  };
}

export async function downloadSkuStockFlowsCsv(
  accessToken: string,
  skuId: number,
  options?: { readonly action?: SkuStockFlowAction; readonly from?: string; readonly to?: string },
): Promise<{ readonly fileName: string; readonly blob: Blob }> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  if (options?.action) {
    searchParams.set("action", options.action);
  }
  if (options?.from) {
    searchParams.set("from", options.from);
  }
  if (options?.to) {
    searchParams.set("to", options.to);
  }

  const query = searchParams.toString();
  const path = query
    ? `/admin/sku-stocks/${skuId}/flows/export?${query}`
    : `/admin/sku-stocks/${skuId}/flows/export`;

  const response = await fetch(`${API_PREFIX}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "text/csv",
    },
  });

  if (!response.ok) {
    let parsed: ApiResponseEnvelope<unknown> | null = null;
    try {
      parsed = (await response.json()) as ApiResponseEnvelope<unknown>;
    } catch {
      throw defaultErrorForStatus(response.status);
    }

    const error = parsed.error;
    throw new AuthApiError(
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? `请求失败（状态码 ${response.status}）。`,
    );
  }

  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const match = contentDisposition.match(/filename=\"([^\"]+)\"/);
  const fileName = match?.[1] ?? `sku_stock_flows_${skuId}.csv`;
  const blob = await response.blob();
  return { fileName, blob };
}

interface AdminRbacPermissionResponseBody {
  readonly id: number;
  readonly resource: string;
  readonly action: string;
  readonly name: string;
  readonly description: string | null;
}

interface AdminRbacRoleResponseBody {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly is_system: boolean;
  readonly permissions: AdminRbacPermissionResponseBody[];
}

interface AdminRoleBindingGroupResponseBody {
  readonly resource: string;
  readonly actions: string[];
}

interface AdminRoleBindingsResponseBody {
  readonly role_key: string;
  readonly permission_count: number;
  readonly permissions: AdminRbacPermissionResponseBody[];
  readonly grouped_permissions: AdminRoleBindingGroupResponseBody[];
}

interface AdminUserRolesReplaceResponseBody {
  readonly user_id: number;
  readonly roles: string[];
}

interface AdminCrudListResponseBody {
  readonly resource: AdminCrudResource;
  readonly items: Record<string, unknown>[];
  readonly meta: {
    readonly page: number;
    readonly page_size: number;
    readonly total: number;
  };
}

export interface AdminRbacPermission {
  readonly id: number;
  readonly resource: string;
  readonly action: string;
  readonly name: string;
  readonly description: string | null;
}

export interface AdminRbacRole {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly permissions: AdminRbacPermission[];
}

export interface CreateAdminRbacRoleInput {
  readonly key: string;
  readonly name: string;
  readonly description?: string;
}

export interface BindAdminRbacRolePermissionsInput {
  readonly roleKey: string;
  readonly permissions: Array<{
    readonly resource: string;
    readonly actions: string[];
  }>;
}

export interface BindAdminRbacRolePermissionsResult {
  readonly roleKey: string;
  readonly permissionCount: number;
  readonly permissions: AdminRbacPermission[];
  readonly groupedPermissions: Array<{
    readonly resource: string;
    readonly actions: string[];
  }>;
}

export interface ReplaceAdminUserRolesResult {
  readonly userId: number;
  readonly roles: string[];
}

export type AdminCrudResource =
  | "users"
  | "categories"
  | "skus"
  | "assets"
  | "applications"
  | "announcements";

export interface AdminCrudListResult {
  readonly resource: AdminCrudResource;
  readonly items: Record<string, unknown>[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}

function mapAdminRbacPermission(
  payload: AdminRbacPermissionResponseBody,
): AdminRbacPermission {
  return {
    id: payload.id,
    resource: payload.resource,
    action: payload.action,
    name: payload.name,
    description: payload.description,
  };
}

function mapAdminRbacRole(payload: AdminRbacRoleResponseBody): AdminRbacRole {
  return {
    id: payload.id,
    key: payload.key,
    name: payload.name,
    description: payload.description,
    isSystem: payload.is_system,
    permissions: payload.permissions.map(mapAdminRbacPermission),
  };
}

export async function fetchAdminRbacRoles(
  accessToken: string,
): Promise<AdminRbacRole[]> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminRbacRoleResponseBody[]>('/admin/rbac/roles', {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return (envelope.data ?? []).map(mapAdminRbacRole);
}

export async function createAdminRbacRole(
  accessToken: string,
  input: CreateAdminRbacRoleInput,
): Promise<AdminRbacRole> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminRbacRoleResponseBody>('/admin/rbac/roles', {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: input.key,
      name: input.name,
      description: input.description,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "创建角色响应数据为空。");
  }

  return mapAdminRbacRole(envelope.data);
}

export async function fetchAdminRbacPermissions(
  accessToken: string,
): Promise<AdminRbacPermission[]> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminRbacPermissionResponseBody[]>(
    "/admin/rbac/permissions",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return (envelope.data ?? []).map(mapAdminRbacPermission);
}

export async function bindAdminRbacRolePermissions(
  accessToken: string,
  input: BindAdminRbacRolePermissionsInput,
): Promise<BindAdminRbacRolePermissionsResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminRoleBindingsResponseBody>(
    "/admin/rbac/role-bindings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role_key: input.roleKey,
        permissions: input.permissions.map((item) => ({
          resource: item.resource,
          actions: item.actions,
        })),
      }),
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "角色绑定响应数据为空。");
  }

  return {
    roleKey: envelope.data.role_key,
    permissionCount: envelope.data.permission_count,
    permissions: envelope.data.permissions.map(mapAdminRbacPermission),
    groupedPermissions: envelope.data.grouped_permissions.map((item) => ({
      resource: item.resource,
      actions: item.actions,
    })),
  };
}

export async function replaceAdminUserRoles(
  accessToken: string,
  userId: number,
  roles: string[],
): Promise<ReplaceAdminUserRolesResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AdminUserRolesReplaceResponseBody>(
    `/admin/users/${userId}/roles`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roles }),
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "用户角色更新响应数据为空。");
  }

  return {
    userId: envelope.data.user_id,
    roles: envelope.data.roles,
  };
}

export async function fetchAdminCrudResource(
  accessToken: string,
  resource: AdminCrudResource,
  options?: {
    readonly q?: string;
    readonly page?: number;
    readonly pageSize?: number;
  },
): Promise<AdminCrudListResult> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(options?.page ?? 1));
  searchParams.set("page_size", String(options?.pageSize ?? 20));
  if (options?.q && options.q.trim()) {
    searchParams.set("q", options.q.trim());
  }

  const envelope = await requestApi<AdminCrudListResponseBody>(
    `/admin/crud/${resource}?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "后台列表响应数据为空。");
  }

  return {
    resource: envelope.data.resource,
    items: envelope.data.items,
    meta: {
      page: envelope.data.meta.page,
      pageSize: envelope.data.meta.page_size,
      total: envelope.data.meta.total,
    },
  };
}

interface AssetReturnResponseBody {
  readonly application_id: number;
  readonly application_status: string;
  readonly asset_id: number;
  readonly asset_status: string;
}

interface AssetTransferResponseBody {
  readonly asset_id: number;
  readonly asset_status: string;
  readonly from_user_id: number;
  readonly to_user_id: number;
}

interface AssetScrapResponseBody {
  readonly asset_id: number;
  readonly asset_status: string;
  readonly reason: AssetScrapReason;
}

export type RepairUrgency = "LOW" | "MEDIUM" | "HIGH";
export type AssetScrapReason = "DAMAGE" | "OBSOLETE" | "LOST";

export interface AssetReturnResult {
  readonly applicationId: number;
  readonly applicationStatus: string;
  readonly assetId: number;
  readonly assetStatus: string;
}

export interface AssetTransferResult {
  readonly assetId: number;
  readonly assetStatus: string;
  readonly fromUserId: number;
  readonly toUserId: number;
}

export interface AssetScrapResult {
  readonly assetId: number;
  readonly assetStatus: string;
  readonly reason: AssetScrapReason;
}

export async function submitAssetReturn(
  accessToken: string,
  input: {
    readonly assetId: number;
    readonly reason: string;
  },
): Promise<AssetReturnResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AssetReturnResponseBody>("/assets/return", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      asset_id: input.assetId,
      reason: input.reason,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "归还响应数据为空。");
  }

  return {
    applicationId: envelope.data.application_id,
    applicationStatus: envelope.data.application_status,
    assetId: envelope.data.asset_id,
    assetStatus: envelope.data.asset_status,
  };
}

export async function submitAssetRepair(
  accessToken: string,
  input: {
    readonly assetId: number;
    readonly faultDescription: string;
    readonly urgency: RepairUrgency;
  },
): Promise<AssetReturnResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AssetReturnResponseBody>("/assets/repair", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      asset_id: input.assetId,
      fault_description: input.faultDescription,
      urgency: input.urgency,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "报修响应数据为空。");
  }

  return {
    applicationId: envelope.data.application_id,
    applicationStatus: envelope.data.application_status,
    assetId: envelope.data.asset_id,
    assetStatus: envelope.data.asset_status,
  };
}

export async function submitAssetTransfer(
  accessToken: string,
  input: {
    readonly assetId: number;
    readonly targetUserId: number;
    readonly reason: string;
  },
): Promise<AssetTransferResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AssetTransferResponseBody>("/assets/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      asset_id: input.assetId,
      target_user_id: input.targetUserId,
      reason: input.reason,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "调拨响应数据为空。");
  }

  return {
    assetId: envelope.data.asset_id,
    assetStatus: envelope.data.asset_status,
    fromUserId: envelope.data.from_user_id,
    toUserId: envelope.data.to_user_id,
  };
}

export async function submitAssetScrap(
  accessToken: string,
  input: {
    readonly assetId: number;
    readonly reason: AssetScrapReason;
    readonly scrapNote?: string;
  },
): Promise<AssetScrapResult> {
  assertToken(accessToken);
  const envelope = await requestApi<AssetScrapResponseBody>("/admin/assets/scrap", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      asset_id: input.assetId,
      reason: input.reason,
      scrap_note: input.scrapNote,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "报废响应数据为空。");
  }

  return {
    assetId: envelope.data.asset_id,
    assetStatus: envelope.data.asset_status,
    reason: envelope.data.reason,
  };
}

interface ApplicationsTrendPointResponseBody {
  readonly bucket: string;
  readonly count: number;
}

interface CostByDepartmentRowResponseBody {
  readonly department_id: number;
  readonly department_name: string;
  readonly total_cost: string;
  readonly application_count: number;
}

interface AssetStatusDistributionRowResponseBody {
  readonly status: string;
  readonly count: number;
}

type CopilotMetric = "TOTAL_COST" | "MAX_COST" | "COUNT_APPLICATIONS" | "COUNT_ASSETS";
type CopilotDimension = "USER" | "DEPARTMENT" | "SKU" | "CATEGORY" | "STATUS" | "MONTH";
type CopilotFilterOp = "EQ" | "IN" | "GTE" | "LTE" | "BETWEEN" | "CONTAINS";
type CopilotSortDirection = "ASC" | "DESC";

interface CopilotFilterResponseBody {
  readonly field: string;
  readonly op: CopilotFilterOp;
  readonly value: unknown;
}

interface CopilotOrderByResponseBody {
  readonly field: string;
  readonly direction: CopilotSortDirection;
}

interface CopilotQueryPlanResponseBody {
  readonly metric: CopilotMetric;
  readonly dimensions: CopilotDimension[];
  readonly filters: CopilotFilterResponseBody[];
  readonly order_by: CopilotOrderByResponseBody[];
  readonly limit: number;
}

interface CopilotQueryResponseBody {
  readonly query_plan: CopilotQueryPlanResponseBody;
  readonly columns: string[];
  readonly rows: unknown[][];
}

export type ReportGranularity = "DAY" | "WEEK" | "MONTH";

export interface ApplicationsTrendPoint {
  readonly bucket: string;
  readonly count: number;
}

export interface CostByDepartmentRow {
  readonly departmentId: number;
  readonly departmentName: string;
  readonly totalCost: string;
  readonly applicationCount: number;
}

export interface AssetStatusDistributionRow {
  readonly status: string;
  readonly count: number;
}

export interface CopilotFilter {
  readonly field: string;
  readonly op: CopilotFilterOp;
  readonly value: unknown;
}

export interface CopilotOrderBy {
  readonly field: string;
  readonly direction: CopilotSortDirection;
}

export interface CopilotQueryPlan {
  readonly metric: CopilotMetric;
  readonly dimensions: CopilotDimension[];
  readonly filters: CopilotFilter[];
  readonly orderBy: CopilotOrderBy[];
  readonly limit: number;
}

export interface CopilotQueryResult {
  readonly queryPlan: CopilotQueryPlan;
  readonly columns: string[];
  readonly rows: unknown[][];
}

export interface CopilotQueryInput {
  readonly question: string;
  readonly constraints?: Record<string, unknown>;
}

export async function fetchApplicationsTrendReport(
  accessToken: string,
  options?: {
    readonly granularity?: ReportGranularity;
    readonly startDate?: string;
    readonly endDate?: string;
  },
): Promise<ApplicationsTrendPoint[]> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  if (options?.granularity) {
    searchParams.set("granularity", options.granularity);
  }
  if (options?.startDate) {
    searchParams.set("start_date", options.startDate);
  }
  if (options?.endDate) {
    searchParams.set("end_date", options.endDate);
  }

  const query = searchParams.toString();
  const path = query ? `/reports/applications-trend?${query}` : "/reports/applications-trend";
  const envelope = await requestApi<ApplicationsTrendPointResponseBody[]>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return (envelope.data ?? []).map((item) => ({
    bucket: item.bucket,
    count: item.count,
  }));
}

export async function fetchCostByDepartmentReport(
  accessToken: string,
  options?: {
    readonly startDate?: string;
    readonly endDate?: string;
  },
): Promise<CostByDepartmentRow[]> {
  assertToken(accessToken);
  const searchParams = new URLSearchParams();
  if (options?.startDate) {
    searchParams.set("start_date", options.startDate);
  }
  if (options?.endDate) {
    searchParams.set("end_date", options.endDate);
  }

  const query = searchParams.toString();
  const path = query ? `/reports/cost-by-department?${query}` : "/reports/cost-by-department";
  const envelope = await requestApi<CostByDepartmentRowResponseBody[]>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return (envelope.data ?? []).map((item) => ({
    departmentId: item.department_id,
    departmentName: item.department_name,
    totalCost: item.total_cost,
    applicationCount: item.application_count,
  }));
}

export async function fetchAssetStatusDistributionReport(
  accessToken: string,
): Promise<AssetStatusDistributionRow[]> {
  assertToken(accessToken);
  const envelope = await requestApi<AssetStatusDistributionRowResponseBody[]>(
    "/reports/asset-status-distribution",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return (envelope.data ?? []).map((item) => ({
    status: item.status,
    count: item.count,
  }));
}

export async function queryCopilot(
  accessToken: string,
  input: CopilotQueryInput,
): Promise<CopilotQueryResult> {
  assertToken(accessToken);
  const envelope = await requestApi<CopilotQueryResponseBody>("/copilot/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question: input.question,
      constraints: input.constraints,
    }),
  });

  if (!envelope.data) {
    throw new AuthApiError("INVALID_RESPONSE", "智能问答响应数据为空。");
  }

  return {
    queryPlan: {
      metric: envelope.data.query_plan.metric,
      dimensions: envelope.data.query_plan.dimensions,
      filters: envelope.data.query_plan.filters.map((item) => ({
        field: item.field,
        op: item.op,
        value: item.value,
      })),
      orderBy: envelope.data.query_plan.order_by.map((item) => ({
        field: item.field,
        direction: item.direction,
      })),
      limit: envelope.data.query_plan.limit,
    },
    columns: envelope.data.columns,
    rows: envelope.data.rows,
  };
}
