import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createAdminCategory,
  createAdminSku,
  deleteAdminCategory,
  deleteAdminSku,
  fetchAdminSkus,
  fetchCategoryTree,
  updateAdminCategory,
  updateAdminSku,
  uploadSkuImage,
  type AdminSkuItem,
  type CategoryTreeNode,
  type SkuStockMode,
} from "../api";
import { useAuthSession } from "../stores";
import { parsePositiveInteger, toErrorMessage } from "./page-helpers";

interface FlatCategoryOption {
  readonly id: number;
  readonly name: string;
  readonly parentId: number | null;
  readonly depth: number;
}

function flattenCategoryTree(
  nodes: readonly CategoryTreeNode[],
  parentId: number | null = null,
  depth = 0,
): FlatCategoryOption[] {
  const result: FlatCategoryOption[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      parentId,
      depth,
    });
    if (node.children.length) {
      result.push(...flattenCategoryTree(node.children, node.id, depth + 1));
    }
  }
  return result;
}

function toCategoryOptionLabel(option: FlatCategoryOption): string {
  const indent = option.depth > 0 ? "  ".repeat(option.depth) : "";
  return `${indent}${option.name} (#${option.id})`;
}

function toStockModeLabel(mode: SkuStockMode): string {
  if (mode === "QUANTITY") {
    return "数量库存（无需 SN）";
  }
  return "序列号资产（需要 SN）";
}

export function MaterialsPage(): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const categoryOptions = useMemo(() => flattenCategoryTree(categories), [categories]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string>("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryParentId, setEditCategoryParentId] = useState<string>("");
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);

  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);

  const [skuItems, setSkuItems] = useState<AdminSkuItem[]>([]);
  const [isLoadingSkus, setIsLoadingSkus] = useState(false);

  const [skuQuerySkuId, setSkuQuerySkuId] = useState("");
  const [skuQueryCategoryId, setSkuQueryCategoryId] = useState("");
  const [skuQueryKeyword, setSkuQueryKeyword] = useState("");

  const [newSkuCategoryId, setNewSkuCategoryId] = useState<string>("");
  const [newSkuStockMode, setNewSkuStockMode] = useState<SkuStockMode>("SERIALIZED");
  const [newSkuBrand, setNewSkuBrand] = useState("");
  const [newSkuModel, setNewSkuModel] = useState("");
  const [newSkuSpec, setNewSkuSpec] = useState("");
  const [newSkuReferencePrice, setNewSkuReferencePrice] = useState("");
  const [newSkuSafetyStockThreshold, setNewSkuSafetyStockThreshold] = useState("0");
  const [newSkuCoverUrl, setNewSkuCoverUrl] = useState<string | null>(null);
  const [isUploadingNewSkuCover, setIsUploadingNewSkuCover] = useState(false);
  const [isCreatingSku, setIsCreatingSku] = useState(false);

  const [editingSkuId, setEditingSkuId] = useState<number | null>(null);
  const [editSkuCategoryId, setEditSkuCategoryId] = useState<string>("");
  const [editSkuStockMode, setEditSkuStockMode] = useState<SkuStockMode>("SERIALIZED");
  const [editSkuBrand, setEditSkuBrand] = useState("");
  const [editSkuModel, setEditSkuModel] = useState("");
  const [editSkuSpec, setEditSkuSpec] = useState("");
  const [editSkuReferencePrice, setEditSkuReferencePrice] = useState("");
  const [editSkuSafetyStockThreshold, setEditSkuSafetyStockThreshold] = useState("0");
  const [editSkuCoverUrl, setEditSkuCoverUrl] = useState<string | null>(null);
  const [isUploadingEditSkuCover, setIsUploadingEditSkuCover] = useState(false);
  const [isUpdatingSku, setIsUpdatingSku] = useState(false);
  const [deletingSkuId, setDeletingSkuId] = useState<number | null>(null);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <p className="app-shell__section-label">M06 物料管理</p>
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  const token = accessToken;

  const loadCategories = useCallback(async (): Promise<void> => {
    setIsLoadingCategories(true);
    setErrorMessage(null);
    try {
      const next = await fetchCategoryTree(token);
      setCategories(next);
      if (!newSkuCategoryId && next.length > 0) {
        const first = flattenCategoryTree(next)[0];
        if (first) {
          setNewSkuCategoryId(String(first.id));
        }
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载分类树失败。"));
    } finally {
      setIsLoadingCategories(false);
    }
  }, [newSkuCategoryId, token]);

  const loadSkus = useCallback(async (): Promise<void> => {
    const normalizedSkuId = skuQuerySkuId.trim();
    const parsedSkuId = normalizedSkuId ? parsePositiveInteger(normalizedSkuId) : null;
    if (normalizedSkuId && parsedSkuId === null) {
      setErrorMessage("SKU 编号必须为正整数。");
      return;
    }

    const normalizedCategoryId = skuQueryCategoryId.trim();
    const parsedCategoryId = normalizedCategoryId
      ? parsePositiveInteger(normalizedCategoryId)
      : null;
    if (normalizedCategoryId && parsedCategoryId === null) {
      setErrorMessage("分类编号必须为正整数。");
      return;
    }

    setIsLoadingSkus(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await fetchAdminSkus(token, {
        skuId: parsedSkuId ?? undefined,
        categoryId: parsedCategoryId ?? undefined,
        q: skuQueryKeyword.trim() || undefined,
      });
      setSkuItems(result);
      setSuccessMessage(`已加载物料 ${result.length} 行。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载物料失败。"));
    } finally {
      setIsLoadingSkus(false);
    }
  }, [skuQueryCategoryId, skuQueryKeyword, skuQuerySkuId, token]);

  useEffect(() => {
    void loadCategories();
    void loadSkus();
  }, [loadCategories, loadSkus]);

  async function handleCreateCategory(): Promise<void> {
    if (!newCategoryName.trim()) {
      setErrorMessage("分类名称不能为空。");
      return;
    }

    const normalizedParentId = newCategoryParentId.trim();
    const parsedParentId = normalizedParentId ? parsePositiveInteger(normalizedParentId) : null;
    if (normalizedParentId && parsedParentId === null) {
      setErrorMessage("父级分类编号必须为正整数。");
      return;
    }

    setIsCreatingCategory(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createAdminCategory(token, {
        name: newCategoryName.trim(),
        parentId: parsedParentId,
      });
      setNewCategoryName("");
      setNewCategoryParentId("");
      await loadCategories();
      setSuccessMessage("分类创建成功。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建分类失败。"));
    } finally {
      setIsCreatingCategory(false);
    }
  }

  function handleStartEditCategory(option: FlatCategoryOption): void {
    setEditingCategoryId(option.id);
    setEditCategoryName(option.name);
    setEditCategoryParentId(option.parentId ? String(option.parentId) : "");
  }

  function handleCancelEditCategory(): void {
    setEditingCategoryId(null);
    setEditCategoryName("");
    setEditCategoryParentId("");
  }

  async function handleUpdateCategory(): Promise<void> {
    if (!editingCategoryId) {
      return;
    }
    if (!editCategoryName.trim()) {
      setErrorMessage("分类名称不能为空。");
      return;
    }

    const normalizedParentId = editCategoryParentId.trim();
    const parsedParentId = normalizedParentId ? parsePositiveInteger(normalizedParentId) : null;
    if (normalizedParentId && parsedParentId === null) {
      setErrorMessage("父级分类编号必须为正整数。");
      return;
    }

    setIsUpdatingCategory(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminCategory(token, editingCategoryId, {
        name: editCategoryName.trim(),
        parentId: parsedParentId,
      });
      handleCancelEditCategory();
      await loadCategories();
      setSuccessMessage("分类更新成功。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "更新分类失败。"));
    } finally {
      setIsUpdatingCategory(false);
    }
  }

  async function handleDeleteCategory(categoryId: number): Promise<void> {
    if (!window.confirm(`确认删除分类 #${categoryId}？\n提示：有子分类或被物料引用将无法删除。`)) {
      return;
    }

    setDeletingCategoryId(categoryId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAdminCategory(token, categoryId);
      await loadCategories();
      setSuccessMessage(`分类 #${categoryId} 已删除。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除分类失败。"));
    } finally {
      setDeletingCategoryId(null);
    }
  }

  async function handleUploadNewSkuCover(file: File): Promise<void> {
    setIsUploadingNewSkuCover(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await uploadSkuImage(token, file);
      setNewSkuCoverUrl(result.url);
      setSuccessMessage("SKU 封面上传成功。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "上传 SKU 封面失败。"));
    } finally {
      setIsUploadingNewSkuCover(false);
    }
  }

  async function handleCreateSku(): Promise<void> {
    const parsedCategoryId = parsePositiveInteger(newSkuCategoryId);
    if (!parsedCategoryId) {
      setErrorMessage("分类不能为空。");
      return;
    }

    const parsedThreshold = Number(newSkuSafetyStockThreshold);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      setErrorMessage("安全库存阈值必须大于等于 0。");
      return;
    }

    if (
      !newSkuBrand.trim() ||
      !newSkuModel.trim() ||
      !newSkuSpec.trim() ||
      !newSkuReferencePrice.trim()
    ) {
      setErrorMessage("品牌/型号/规格/参考价格不能为空。");
      return;
    }

    setIsCreatingSku(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await createAdminSku(token, {
        categoryId: parsedCategoryId,
        brand: newSkuBrand.trim(),
        model: newSkuModel.trim(),
        spec: newSkuSpec.trim(),
        referencePrice: newSkuReferencePrice.trim(),
        coverUrl: newSkuCoverUrl,
        stockMode: newSkuStockMode,
        safetyStockThreshold: Math.trunc(parsedThreshold),
      });
      setSuccessMessage(`物料创建成功：#${created.id} ${created.brand} ${created.model}。`);
      setNewSkuBrand("");
      setNewSkuModel("");
      setNewSkuSpec("");
      setNewSkuReferencePrice("");
      setNewSkuSafetyStockThreshold("0");
      setNewSkuCoverUrl(null);
      await loadSkus();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建物料失败。"));
    } finally {
      setIsCreatingSku(false);
    }
  }

  function handleStartEditSku(item: AdminSkuItem): void {
    setEditingSkuId(item.id);
    setEditSkuCategoryId(String(item.categoryId));
    setEditSkuStockMode(item.stockMode);
    setEditSkuBrand(item.brand);
    setEditSkuModel(item.model);
    setEditSkuSpec(item.spec);
    setEditSkuReferencePrice(item.referencePrice);
    setEditSkuSafetyStockThreshold(String(item.safetyStockThreshold));
    setEditSkuCoverUrl(item.coverUrl);
  }

  function handleCancelEditSku(): void {
    setEditingSkuId(null);
    setEditSkuCategoryId("");
    setEditSkuStockMode("SERIALIZED");
    setEditSkuBrand("");
    setEditSkuModel("");
    setEditSkuSpec("");
    setEditSkuReferencePrice("");
    setEditSkuSafetyStockThreshold("0");
    setEditSkuCoverUrl(null);
  }

  async function handleUploadEditSkuCover(file: File): Promise<void> {
    setIsUploadingEditSkuCover(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await uploadSkuImage(token, file);
      setEditSkuCoverUrl(result.url);
      setSuccessMessage("SKU 封面上传成功。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "上传 SKU 封面失败。"));
    } finally {
      setIsUploadingEditSkuCover(false);
    }
  }

  async function handleUpdateSku(): Promise<void> {
    if (!editingSkuId) {
      return;
    }
    const parsedCategoryId = parsePositiveInteger(editSkuCategoryId);
    if (!parsedCategoryId) {
      setErrorMessage("分类不能为空。");
      return;
    }

    const parsedThreshold = Number(editSkuSafetyStockThreshold);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      setErrorMessage("安全库存阈值必须大于等于 0。");
      return;
    }

    if (
      !editSkuBrand.trim() ||
      !editSkuModel.trim() ||
      !editSkuSpec.trim() ||
      !editSkuReferencePrice.trim()
    ) {
      setErrorMessage("品牌/型号/规格/参考价格不能为空。");
      return;
    }

    setIsUpdatingSku(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateAdminSku(token, editingSkuId, {
        categoryId: parsedCategoryId,
        brand: editSkuBrand.trim(),
        model: editSkuModel.trim(),
        spec: editSkuSpec.trim(),
        referencePrice: editSkuReferencePrice.trim(),
        coverUrl: editSkuCoverUrl,
        stockMode: editSkuStockMode,
        safetyStockThreshold: Math.trunc(parsedThreshold),
      });
      setSuccessMessage(`物料 #${updated.id} 已更新。`);
      handleCancelEditSku();
      await loadSkus();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "更新物料失败。"));
    } finally {
      setIsUpdatingSku(false);
    }
  }

  async function handleDeleteSku(skuId: number): Promise<void> {
    if (!window.confirm(`确认删除物料 #${skuId}？\n提示：已被资产/库存/申请引用将无法删除。`)) {
      return;
    }

    setDeletingSkuId(skuId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAdminSku(token, skuId);
      setSuccessMessage(`物料 #${skuId} 已删除。`);
      await loadSkus();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除物料失败。"));
    } finally {
      setDeletingSkuId(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="物料管理说明">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M06 物料管理</p>
          <h2 className="app-shell__panel-title">分类与物料（SKU）管理</h2>
          <p className="app-shell__panel-copy">
            `/materials` 负责主数据维护：分类（大类/小类）与物料（SKU）CRUD，不包含库存数量。库存数量请在“库存管理”页维护。
          </p>
          <div className="page-actions">
            <Link className="app-shell__header-action" to="/inventory">
              库存管理
            </Link>
            <Link className="app-shell__header-action" to="/inbound">
              入库执行
            </Link>
          </div>
        </div>
      </section>

      {errorMessage || successMessage ? (
        <div className="page-stack__messages">
          {errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="store-success" aria-live="polite">
              {successMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="app-shell__grid inbound-grid" aria-label="物料管理面板">
        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">分类维护</p>
            <h3 className="app-shell__card-title">分类树 CRUD（支持大类/小类）</h3>
            <p className="app-shell__card-copy">
              提示：分类存在子分类或已被物料引用时无法删除；移动分类时不允许形成环。
            </p>
          </div>

          <div className="outbound-action-grid page-form-grid">
            <div className="page-actions">
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingCategories}
                onClick={() => {
                  void loadCategories();
                }}
              >
                {isLoadingCategories ? "加载中..." : "刷新分类树"}
              </button>
              <span className="inbound-import-meta">
                {isLoadingCategories ? "分类加载中..." : `分类：${categoryOptions.length}`}
              </span>
            </div>

            <details className="inbound-crud-panel">
              <summary>新增分类</summary>
              <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                <label className="store-field">
                  分类名称
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="例如：鼠标 / 打印机耗材"
                  />
                </label>
                <label className="store-field">
                  父级分类（可选）
                  <select
                    value={newCategoryParentId}
                    onChange={(event) => setNewCategoryParentId(event.target.value)}
                  >
                    <option value="">（作为顶级分类）</option>
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {toCategoryOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="auth-submit"
                  type="button"
                  disabled={isCreatingCategory}
                  onClick={() => {
                    void handleCreateCategory();
                  }}
                >
                  {isCreatingCategory ? "提交中..." : "创建分类"}
                </button>
              </div>
            </details>

            {editingCategoryId ? (
              <section className="inbound-crud-panel inbound-crud-panel--editor" aria-label="编辑分类">
                <div className="inbound-crud-panel__head">
                  <p className="app-shell__section-label">编辑分类</p>
                  <p className="inbound-import-meta">分类 #{editingCategoryId}</p>
                </div>

                <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                  <label className="store-field">
                    分类名称
                    <input
                      value={editCategoryName}
                      onChange={(event) => setEditCategoryName(event.target.value)}
                    />
                  </label>
                  <label className="store-field">
                    父级分类（可选）
                    <select
                      value={editCategoryParentId}
                      onChange={(event) => setEditCategoryParentId(event.target.value)}
                    >
                      <option value="">（作为顶级分类）</option>
                      {categoryOptions
                        .filter((option) => option.id !== editingCategoryId)
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {toCategoryOptionLabel(option)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="page-actions">
                    <button
                      className="auth-submit"
                      type="button"
                      disabled={isUpdatingCategory}
                      onClick={() => {
                        void handleUpdateCategory();
                      }}
                    >
                      {isUpdatingCategory ? "保存中..." : "保存修改"}
                    </button>
                    <button
                      className="app-shell__header-action"
                      type="button"
                      disabled={isUpdatingCategory}
                      onClick={() => {
                        handleCancelEditCategory();
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {categoryOptions.length ? (
              <div className="page-table-wrap" aria-label="分类表格容器">
                <table className="analytics-table" aria-label="分类表格">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>名称</th>
                      <th>父级</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryOptions.map((option) => (
                      <tr key={option.id}>
                        <td>{option.id}</td>
                        <td>
                          <span style={{ paddingLeft: `${option.depth * 12}px` }}>
                            {option.name}
                          </span>
                        </td>
                        <td>{option.parentId ?? "-"}</td>
                        <td>
                          <div className="inbound-table-actions">
                            <button
                              className="app-shell__header-action"
                              type="button"
                              onClick={() => {
                                handleStartEditCategory(option);
                              }}
                            >
                              编辑
                            </button>
                            <button
                              className="app-shell__header-action inbound-action-danger"
                              type="button"
                              disabled={deletingCategoryId === option.id}
                              onClick={() => {
                                void handleDeleteCategory(option.id);
                              }}
                            >
                              {deletingCategoryId === option.id ? "删除中..." : "删除"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="app-shell__card-copy">
                {isLoadingCategories ? "分类加载中..." : "暂无分类，请先创建。"}
              </p>
            )}
          </div>
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">物料维护</p>
            <h3 className="app-shell__card-title">物料（SKU）CRUD（不含库存数量）</h3>
            <p className="app-shell__card-copy">
              `stock_mode` 决定库存方式：{toStockModeLabel("SERIALIZED")} /{" "}
              {toStockModeLabel("QUANTITY")}。
            </p>
          </div>
          <div className="outbound-action-grid page-form-grid">
            <div className="inbound-inline-fields">
              <label className="store-field">
                SKU 编号（可选）
                <input
                  value={skuQuerySkuId}
                  onChange={(event) => setSkuQuerySkuId(event.target.value)}
                  placeholder="例如：8001"
                />
              </label>
              <label className="store-field">
                分类（可选）
                <select
                  value={skuQueryCategoryId}
                  onChange={(event) => setSkuQueryCategoryId(event.target.value)}
                >
                  <option value="">（不限制）</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {toCategoryOptionLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="store-field">
              关键字（品牌/型号/规格，可选）
              <input
                value={skuQueryKeyword}
                onChange={(event) => setSkuQueryKeyword(event.target.value)}
                placeholder="例如：联想 / ThinkPad / 4K"
              />
            </label>

            <div className="page-actions">
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingSkus}
                onClick={() => {
                  void loadSkus();
                }}
              >
                {isLoadingSkus ? "加载中..." : "查询物料"}
              </button>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingSkus}
                onClick={() => {
                  setSkuQuerySkuId("");
                  setSkuQueryCategoryId("");
                  setSkuQueryKeyword("");
                }}
              >
                重置
              </button>
            </div>

            {skuItems.length ? (
              <div className="page-table-wrap" aria-label="后台物料表格容器">
                <table className="analytics-table" aria-label="后台物料表格">
                  <thead>
                    <tr>
                      <th>封面</th>
                      <th>ID</th>
                      <th>分类</th>
                      <th>库存模式</th>
                      <th>品牌</th>
                      <th>型号</th>
                      <th>规格</th>
                      <th>参考价</th>
                      <th>安全阈值</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.coverUrl ? (
                            <img
                              className="inbound-sku-thumb"
                              src={item.coverUrl}
                              alt={`${item.brand} ${item.model}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="inbound-sku-thumb is-empty" aria-label="无封面" />
                          )}
                        </td>
                        <td>{item.id}</td>
                        <td>{item.categoryId}</td>
                        <td>{item.stockMode}</td>
                        <td>{item.brand}</td>
                        <td>{item.model}</td>
                        <td>{item.spec}</td>
                        <td>{item.referencePrice}</td>
                        <td>{item.safetyStockThreshold}</td>
                        <td>
                          <div className="inbound-table-actions">
                            <button
                              className="app-shell__header-action"
                              type="button"
                              onClick={() => {
                                handleStartEditSku(item);
                              }}
                            >
                              编辑
                            </button>
                            <button
                              className="app-shell__header-action inbound-action-danger"
                              type="button"
                              disabled={deletingSkuId === item.id}
                              onClick={() => {
                                void handleDeleteSku(item.id);
                              }}
                            >
                              {deletingSkuId === item.id ? "删除中..." : "删除"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="app-shell__card-copy">
                {isLoadingSkus ? "物料加载中..." : "暂无物料数据，可调整筛选条件并点击“查询物料”。"}
              </p>
            )}

            <details className="inbound-crud-panel">
              <summary>新增物料</summary>
              <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                <div className="inbound-inline-fields">
                  <label className="store-field">
                    分类
                    <select
                      value={newSkuCategoryId}
                      onChange={(event) => setNewSkuCategoryId(event.target.value)}
                      disabled={!categoryOptions.length}
                    >
                      {categoryOptions.length ? (
                        categoryOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {toCategoryOptionLabel(option)}
                          </option>
                        ))
                      ) : (
                        <option value="">（请先创建分类）</option>
                      )}
                    </select>
                  </label>
                  <label className="store-field">
                    库存模式
                    <select
                      value={newSkuStockMode}
                      onChange={(event) =>
                        setNewSkuStockMode(event.target.value === "QUANTITY" ? "QUANTITY" : "SERIALIZED")
                      }
                    >
                      <option value="SERIALIZED">SERIALIZED</option>
                      <option value="QUANTITY">QUANTITY</option>
                    </select>
                  </label>
                </div>

                <label className="store-field">
                  安全库存阈值
                  <input
                    value={newSkuSafetyStockThreshold}
                    onChange={(event) => setNewSkuSafetyStockThreshold(event.target.value)}
                  />
                </label>

                <label className="store-field">
                  品牌
                  <input value={newSkuBrand} onChange={(event) => setNewSkuBrand(event.target.value)} />
                </label>
                <label className="store-field">
                  型号
                  <input value={newSkuModel} onChange={(event) => setNewSkuModel(event.target.value)} />
                </label>
                <label className="store-field">
                  规格
                  <input value={newSkuSpec} onChange={(event) => setNewSkuSpec(event.target.value)} />
                </label>
                <label className="store-field">
                  参考价格
                  <input
                    value={newSkuReferencePrice}
                    onChange={(event) => setNewSkuReferencePrice(event.target.value)}
                  />
                </label>

                <div className="inbound-cover inbound-field-wide" aria-label="新建 SKU 封面上传">
                  <p className="inbound-cover__label">SKU 封面（可选）</p>
                  <div className="inbound-cover__row">
                    <input
                      className="inbound-file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={isUploadingNewSkuCover}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (file) {
                          void handleUploadNewSkuCover(file);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                    <span className="inbound-import-meta">
                      {isUploadingNewSkuCover ? "上传中..." : newSkuCoverUrl ? "已上传" : "未上传"}
                    </span>
                  </div>
                  {newSkuCoverUrl ? (
                    <>
                      <p className="inbound-cover__url">{newSkuCoverUrl}</p>
                      <div className="inbound-cover__preview">
                        <img src={newSkuCoverUrl} alt="SKU 封面预览" loading="lazy" />
                      </div>
                    </>
                  ) : null}
                </div>

                <button
                  className="auth-submit"
                  type="button"
                  disabled={isCreatingSku || !categoryOptions.length}
                  onClick={() => {
                    void handleCreateSku();
                  }}
                >
                  {isCreatingSku ? "提交中..." : "创建物料"}
                </button>
              </div>
            </details>

            {editingSkuId ? (
              <section className="inbound-crud-panel inbound-crud-panel--editor" aria-label="编辑物料">
                <div className="inbound-crud-panel__head">
                  <p className="app-shell__section-label">编辑物料</p>
                  <p className="inbound-import-meta">物料 #{editingSkuId}</p>
                </div>

                <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                  <div className="inbound-inline-fields">
                    <label className="store-field">
                      分类
                      <select
                        value={editSkuCategoryId}
                        onChange={(event) => setEditSkuCategoryId(event.target.value)}
                        disabled={!categoryOptions.length}
                      >
                        {categoryOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {toCategoryOptionLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="store-field">
                      库存模式
                      <select
                        value={editSkuStockMode}
                        onChange={(event) =>
                          setEditSkuStockMode(event.target.value === "QUANTITY" ? "QUANTITY" : "SERIALIZED")
                        }
                      >
                        <option value="SERIALIZED">SERIALIZED</option>
                        <option value="QUANTITY">QUANTITY</option>
                      </select>
                    </label>
                  </div>

                  <label className="store-field">
                    安全库存阈值
                    <input
                      value={editSkuSafetyStockThreshold}
                      onChange={(event) => setEditSkuSafetyStockThreshold(event.target.value)}
                    />
                  </label>

                  <label className="store-field">
                    品牌
                    <input value={editSkuBrand} onChange={(event) => setEditSkuBrand(event.target.value)} />
                  </label>
                  <label className="store-field">
                    型号
                    <input value={editSkuModel} onChange={(event) => setEditSkuModel(event.target.value)} />
                  </label>
                  <label className="store-field">
                    规格
                    <input value={editSkuSpec} onChange={(event) => setEditSkuSpec(event.target.value)} />
                  </label>
                  <label className="store-field">
                    参考价格
                    <input
                      value={editSkuReferencePrice}
                      onChange={(event) => setEditSkuReferencePrice(event.target.value)}
                    />
                  </label>

                  <div className="inbound-cover inbound-field-wide" aria-label="编辑 SKU 封面上传">
                    <p className="inbound-cover__label">SKU 封面（可选）</p>
                    <div className="inbound-cover__row">
                      <input
                        className="inbound-file-input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={isUploadingEditSkuCover}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file) {
                            void handleUploadEditSkuCover(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                      <span className="inbound-import-meta">
                        {isUploadingEditSkuCover ? "上传中..." : editSkuCoverUrl ? "已设置封面" : "未设置"}
                      </span>
                    </div>
                    {editSkuCoverUrl ? (
                      <>
                        <p className="inbound-cover__url">{editSkuCoverUrl}</p>
                        <div className="inbound-cover__preview">
                          <img src={editSkuCoverUrl} alt="SKU 封面预览" loading="lazy" />
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="page-actions">
                    <button
                      className="auth-submit"
                      type="button"
                      disabled={isUpdatingSku}
                      onClick={() => {
                        void handleUpdateSku();
                      }}
                    >
                      {isUpdatingSku ? "保存中..." : "保存修改"}
                    </button>
                    <button
                      className="app-shell__header-action"
                      type="button"
                      disabled={isUpdatingSku}
                      onClick={() => {
                        handleCancelEditSku();
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
