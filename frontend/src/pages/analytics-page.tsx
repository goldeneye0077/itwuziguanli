import { useState } from "react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchApplicationsTrendReport,
  fetchAssetStatusDistributionReport,
  fetchCostByDepartmentReport,
  fetchTopDepartmentsWithTopSkus,
  fetchTopSkusByApplications,
  queryCopilot,
  type ApplicationsTrendPoint,
  type AssetStatusDistributionRow,
  type CopilotQueryResult,
  type CostByDepartmentRow,
  type ReportGranularity,
  type TopDepartmentRow,
  type TopSkuRow,
} from "../api";
import { hasActionPermission } from "../permissions";
import { useAuthSession } from "../stores";
import { parsePositiveInteger, toAssetStatusLabel, toErrorMessage } from "./page-helpers";

type AnalyticsRoute = "/analytics" | "/copilot";

type CopilotMetric = CopilotQueryResult["queryPlan"]["metric"];
type CopilotDimension = CopilotQueryResult["queryPlan"]["dimensions"][number];
type CopilotFilterOp = CopilotQueryResult["queryPlan"]["filters"][number]["op"];
type CopilotSortDirection = CopilotQueryResult["queryPlan"]["orderBy"][number]["direction"];

const COPILOT_METRIC_LABELS: Record<CopilotMetric, string> = {
  TOTAL_COST: "总成本",
  MAX_COST: "最高成本",
  COUNT_APPLICATIONS: "申请数量",
  COUNT_ASSETS: "资产数量",
};

const COPILOT_DIMENSION_LABELS: Record<CopilotDimension, string> = {
  USER: "用户",
  DEPARTMENT: "部门",
  SKU: "物料",
  CATEGORY: "分类",
  STATUS: "状态",
  MONTH: "月份",
};

const COPILOT_FILTER_OP_LABELS: Record<CopilotFilterOp, string> = {
  EQ: "等于",
  IN: "包含",
  GTE: "大于等于",
  LTE: "小于等于",
  BETWEEN: "区间",
  CONTAINS: "模糊包含",
};

const COPILOT_SORT_DIRECTION_LABELS: Record<CopilotSortDirection, string> = {
  ASC: "升序",
  DESC: "降序",
};

function toCopilotMetricLabel(value: CopilotMetric): string {
  return COPILOT_METRIC_LABELS[value] ?? value;
}

function toCopilotDimensionLabel(value: CopilotDimension): string {
  return COPILOT_DIMENSION_LABELS[value] ?? value;
}

function toCopilotFilterOpLabel(value: CopilotFilterOp): string {
  return COPILOT_FILTER_OP_LABELS[value] ?? value;
}

function toCopilotSortDirectionLabel(value: CopilotSortDirection): string {
  return COPILOT_SORT_DIRECTION_LABELS[value] ?? value;
}

function toCopilotColumnLabel(column: string): string {
  const normalized = column.trim().toLowerCase();
  const mapping: Record<string, string> = {
    department_id: "部门编号",
    department_name: "部门",
    user_id: "用户编号",
    user_name: "用户姓名",
    sku_id: "物料编号",
    category_id: "分类编号",
    category_name: "分类",
    status: "状态",
    month: "月份",
    total_cost: "总成本",
    max_cost: "最高成本",
    count_applications: "申请数量",
    count_assets: "资产数量",
    application_count: "申请数量",
  };
  return mapping[normalized] ?? column;
}

function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return rows
    .map((columns) =>
      columns
        .map((value) => {
          const raw = String(value ?? "");
          const escaped = raw.replace(/"/g, '""');
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\n");
}

interface AnalyticsPageProps {
  readonly routePath: AnalyticsRoute;
}

export function AnalyticsPage({ routePath }: AnalyticsPageProps): JSX.Element {
  const { state, userRoles, userPermissions } = useAuthSession();
  const accessToken = state.accessToken;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [granularity, setGranularity] = useState<ReportGranularity>("DAY");
  const [startDate, setStartDate] = useState("2026-02-01");
  const [endDate, setEndDate] = useState("2026-02-28");
  const [trendRows, setTrendRows] = useState<ApplicationsTrendPoint[]>([]);
  const [costRows, setCostRows] = useState<CostByDepartmentRow[]>([]);
  const [statusRows, setStatusRows] = useState<AssetStatusDistributionRow[]>([]);
  const [topSkuRows, setTopSkuRows] = useState<TopSkuRow[]>([]);
  const [topDeptRows, setTopDeptRows] = useState<TopDepartmentRow[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  const [copilotQuestion, setCopilotQuestion] = useState("按部门统计总成本");
  const [copilotStartDate, setCopilotStartDate] = useState("2026-02-01");
  const [copilotEndDate, setCopilotEndDate] = useState("2026-02-28");
  const [copilotLimit, setCopilotLimit] = useState("20");
  const [copilotResult, setCopilotResult] = useState<CopilotQueryResult | null>(null);
  const [isRunningCopilot, setIsRunningCopilot] = useState(false);
  const canApplyFilter = hasActionPermission(
    "analytics.apply-filter",
    userRoles,
    userPermissions,
  );
  const canExportReport = hasActionPermission(
    "analytics.export-report",
    userRoles,
    userPermissions,
  );
  const canRunCopilot = hasActionPermission(
    "analytics.run-copilot",
    userRoles,
    userPermissions,
  );

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  const token = accessToken;
  const isAnalyticsRoute = routePath === "/analytics";

  async function handleLoadReports(): Promise<void> {
    if (!canApplyFilter) {
      setErrorMessage("当前账号缺少分析报表筛选权限。");
      return;
    }
    setIsLoadingReports(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const reportOptions = {
        granularity,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
      };
      const [trend, cost, status, topSkus, topDepts] = await Promise.all([
        fetchApplicationsTrendReport(token, reportOptions),
        fetchCostByDepartmentReport(token, {
          startDate: reportOptions.startDate,
          endDate: reportOptions.endDate,
        }),
        fetchAssetStatusDistributionReport(token),
        fetchTopSkusByApplications(token, {
          startDate: reportOptions.startDate,
          endDate: reportOptions.endDate,
          limit: 10,
        }),
        fetchTopDepartmentsWithTopSkus(token, {
          startDate: reportOptions.startDate,
          endDate: reportOptions.endDate,
          topDepartments: 10,
          topSkusPerDept: 3,
        }),
      ]);

      setTrendRows(trend);
      setCostRows(cost);
      setStatusRows(status);
      setTopSkuRows(topSkus);
      setTopDeptRows(topDepts);
      setSuccessMessage(
        `报表加载完成：趋势 ${trend.length} 条、部门成本 ${cost.length} 条、资产状态 ${status.length} 条、物料 Top10 ${topSkus.length} 条、部门 Top10 ${topDepts.length} 条。`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载分析报表失败。"));
    } finally {
      setIsLoadingReports(false);
    }
  }

  async function handleRunCopilot(): Promise<void> {
    if (!canRunCopilot) {
      setErrorMessage("当前账号缺少智能问答执行权限。");
      return;
    }
    const normalizedQuestion = copilotQuestion.trim();
    if (!normalizedQuestion) {
      setErrorMessage("智能问答提问内容不能为空。");
      return;
    }

    const parsedLimit = parsePositiveInteger(copilotLimit);
    if (copilotLimit.trim() && parsedLimit === null) {
      setErrorMessage("智能问答返回条数必须为正整数。");
      return;
    }

    setIsRunningCopilot(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const constraints: Record<string, unknown> = {};
    if (copilotStartDate.trim()) {
      constraints.start_date = copilotStartDate.trim();
    }
    if (copilotEndDate.trim()) {
      constraints.end_date = copilotEndDate.trim();
    }
    if (parsedLimit !== null) {
      constraints.limit = parsedLimit;
    }

    try {
      const result = await queryCopilot(token, {
        question: normalizedQuestion,
        constraints: Object.keys(constraints).length ? constraints : undefined,
      });

      setCopilotResult(result);
      setSuccessMessage(`智能问答返回 ${result.rows.length} 行数据。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "执行智能问答查询失败。"));
    } finally {
      setIsRunningCopilot(false);
    }
  }

  function handleExportReports(): void {
    if (!canExportReport) {
      setErrorMessage("当前账号缺少报表导出权限。");
      return;
    }
    if (
      !trendRows.length &&
      !costRows.length &&
      !statusRows.length &&
      !topSkuRows.length &&
      !topDeptRows.length
    ) {
      setErrorMessage("当前无可导出的报表数据，请先加载报表。");
      return;
    }

    const rows: Array<ReadonlyArray<string | number>> = [];
    rows.push(["section", "col1", "col2", "col3"]);
    rows.push(...trendRows.map((item) => ["applications_trend", item.bucket, item.count, ""]));
    rows.push(
      ...costRows.map((item) => [
        "cost_by_department",
        item.departmentName,
        item.totalCost,
        item.applicationCount,
      ]),
    );
    rows.push(
      ...statusRows.map((item) => ["asset_status_distribution", item.status, item.count, ""]),
    );
    rows.push(
      ...topSkuRows.map((item) => [
        "top_skus",
        item.skuName,
        item.totalQuantity,
        item.applicationCount,
      ]),
    );
    rows.push(
      ...topDeptRows.map((item) => [
        "top_departments",
        item.departmentName,
        item.totalQuantity,
        item.topSkus.map((s) => `${s.skuName}(${s.totalQuantity})`).join("; "),
      ]),
    );

    const blob = new Blob(["\ufeff" + toCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "analytics-reports.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setSuccessMessage("报表 CSV 导出成功。");
  }

  return (
      <div className="page-stack">
      <section className="app-shell__panel" aria-label="分析与智能问答说明">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">
            {isAnalyticsRoute ? "分析报表中心" : "智能问答查询控制台"}
          </h2>
          <p className="app-shell__panel-copy">
            当前功能：<strong>{isAnalyticsRoute ? "分析报表" : "智能问答"}</strong>，已连接到真实后台接口。
          </p>
        </div>
      </section>

      {errorMessage || successMessage ? (
        <div className="page-stack__messages">
          {errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? <p className="store-success" aria-live="polite">{successMessage}</p> : null}
        </div>
      ) : null}

      {isAnalyticsRoute ? (
        <>
          <section className="app-shell__card" aria-label="分析筛选器">
            <div className="page-card-head">
              <p className="app-shell__section-label">筛选栏</p>
              <h3 className="app-shell__card-title">报表筛选条件</h3>
            </div>
            <div className="analytics-filter-grid page-form-grid">
              <label className="store-field">
                粒度
                <select
                  value={granularity}
                  onChange={(event) => {
                    const value = event.target.value;
                    setGranularity(
                      value === "DAY" || value === "WEEK" || value === "MONTH"
                        ? value
                        : "DAY",
                    );
                  }}
                >
                  <option value="DAY">按日</option>
                  <option value="WEEK">按周</option>
                  <option value="MONTH">按月</option>
                </select>
              </label>

              <label className="store-field">
                开始日期（可选）
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>

              <label className="store-field">
                结束日期（可选）
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>

              <button
                className="auth-submit"
                type="button"
                disabled={isLoadingReports || !canApplyFilter}
                onClick={() => {
                  void handleLoadReports();
                }}
              >
                {isLoadingReports ? "加载中..." : "加载报表"}
              </button>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={
                  isLoadingReports ||
                  !canExportReport ||
                  (!trendRows.length &&
                    !costRows.length &&
                    !statusRows.length &&
                    !topSkuRows.length &&
                    !topDeptRows.length)
                }
                onClick={() => {
                  handleExportReports();
                }}
              >
                导出 CSV
              </button>
            </div>
          </section>

          <section className="app-shell__grid analytics-grid" aria-label="分析结果卡片">
            <article className="app-shell__card">
              <div className="page-card-head">
                <p className="app-shell__section-label">申请趋势</p>
                <h3 className="app-shell__card-title">申请趋势报表</h3>
              </div>
              {isLoadingReports ? (
                <p className="app-shell__card-copy">正在加载趋势数据...</p>
              ) : trendRows.length ? (
                <>
                  <div className="analytics-chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trendRows} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="bucket"
                          tick={{ fontSize: 12 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: number) => ["申请数量", value]}
                          labelStyle={{ color: "#374151", fontWeight: 600 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorCount)"
                          name="申请数量"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        按时间桶统计申请数量的趋势报表
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">时间桶</th>
                          <th scope="col">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendRows.map((item) => (
                          <tr key={item.bucket}>
                            <td>{item.bucket}</td>
                            <td>{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="app-shell__card-copy">暂无趋势数据，请调整日期范围后重试。</p>
              )}
            </article>

            <article className="app-shell__card">
              <div className="page-card-head">
                <p className="app-shell__section-label">部门成本</p>
                <h3 className="app-shell__card-title">部门成本报表</h3>
              </div>
              {isLoadingReports ? (
                <p className="app-shell__card-copy">正在加载部门成本...</p>
              ) : costRows.length ? (
                <>
                  <div className="analytics-chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={costRows} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="departmentName"
                          tick={{ fontSize: 11 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: number, name: string) => [
                            name === "totalCost" ? "总成本" : "申请数量",
                            name === "totalCost" ? `¥${value.toLocaleString()}` : value,
                          ]}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: "10px" }}
                          formatter={(value: string) => (value === "totalCost" ? "总成本" : "申请数量")}
                        />
                        <Bar dataKey="totalCost" fill="#10b981" name="totalCost" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="applicationCount" fill="#f59e0b" name="applicationCount" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        包含总成本与申请数的部门成本报表
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">部门</th>
                          <th scope="col">总成本</th>
                          <th scope="col">申请数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costRows.map((item) => (
                          <tr key={`${item.departmentId}-${item.departmentName}`}>
                            <td>{item.departmentName}</td>
                            <td>{item.totalCost}</td>
                            <td>{item.applicationCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                  <p className="app-shell__card-copy">暂无部门成本数据，请检查筛选条件后重试。</p>
              )}
            </article>

            <article className="app-shell__card">
              <div className="page-card-head">
                <p className="app-shell__section-label">资产状态分布</p>
                <h3 className="app-shell__card-title">资产状态分布报表</h3>
              </div>
              {isLoadingReports ? (
                <p className="app-shell__card-copy">正在加载状态分布...</p>
              ) : statusRows.length ? (
                <>
                  <div className="analytics-chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusRows}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ status, percent }) =>
                            `${toAssetStatusLabel(status)}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="status"
                        >
                          {statusRows.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={[
                                "#3b82f6",
                                "#10b981",
                                "#f59e0b",
                                "#ef4444",
                                "#8b5cf6",
                                "#ec4899",
                                "#14b8a6",
                                "#f97316",
                              ][index % 8]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: number, name: string) => [
                            name === "count" ? "资产数量" : toAssetStatusLabel(name),
                            value,
                          ]}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: "10px" }}
                          formatter={(value: string) => toAssetStatusLabel(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        按状态统计资产数量的分布报表
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">状态</th>
                          <th scope="col">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusRows.map((item) => (
                          <tr key={item.status}>
                            <td>{toAssetStatusLabel(item.status)}</td>
                            <td>{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="app-shell__card-copy">暂无资产状态分布数据。</p>
              )}
            </article>

            <article className="app-shell__card">
              <div className="page-card-head">
                <p className="app-shell__section-label">物料申请排行</p>
                <h3 className="app-shell__card-title">物料申请 Top 10</h3>
              </div>
              {isLoadingReports ? (
                <p className="app-shell__card-copy">正在加载物料排行...</p>
              ) : topSkuRows.length ? (
                <>
                  <div className="analytics-chart-container">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={topSkuRows}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="skuName"
                          tick={{ fontSize: 11 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                          width={110}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: number, name: string) => [
                            name === "totalQuantity" ? "申请数量" : "申请次数",
                            value,
                          ]}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: "10px" }}
                          formatter={(value: string) =>
                            value === "totalQuantity" ? "申请数量" : "申请次数"
                          }
                        />
                        <Bar
                          dataKey="totalQuantity"
                          fill="#3b82f6"
                          name="totalQuantity"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        申请次数最多的前 10 名物料
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">排名</th>
                          <th scope="col">物料名称</th>
                          <th scope="col">申请数量</th>
                          <th scope="col">申请次数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topSkuRows.map((item, index) => (
                          <tr key={item.skuId}>
                            <td>{index + 1}</td>
                            <td>{item.skuName}</td>
                            <td>{item.totalQuantity}</td>
                            <td>{item.applicationCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="app-shell__card-copy">暂无物料排行数据，请调整日期范围后重试。</p>
              )}
            </article>

            <article className="app-shell__card">
              <div className="page-card-head">
                <p className="app-shell__section-label">部门申请排行</p>
                <h3 className="app-shell__card-title">部门申请 Top 10 + 热门物料</h3>
              </div>
              {isLoadingReports ? (
                <p className="app-shell__card-copy">正在加载部门排行...</p>
              ) : topDeptRows.length ? (
                <>
                  <div className="analytics-chart-container">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={topDeptRows}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="departmentName"
                          tick={{ fontSize: 11 }}
                          tickLine={{ stroke: "#9ca3af" }}
                          axisLine={{ stroke: "#9ca3af" }}
                          width={100}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: number) => ["申请数量", value]}
                        />
                        <Bar
                          dataKey="totalQuantity"
                          fill="#10b981"
                          name="申请数量"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        申请次数最多的前 10 名部门及其热门物料
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">排名</th>
                          <th scope="col">部门</th>
                          <th scope="col">申请数量</th>
                          <th scope="col">热门物料 Top 3</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topDeptRows.map((item, index) => (
                          <tr key={item.departmentId}>
                            <td>{index + 1}</td>
                            <td>{item.departmentName}</td>
                            <td>{item.totalQuantity}</td>
                            <td>
                              {item.topSkus.length > 0
                                ? item.topSkus
                                    .map((sku) => `${sku.skuName}(${sku.totalQuantity})`)
                                    .join("、 ")
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="app-shell__card-copy">暂无部门排行数据，请调整日期范围后重试。</p>
              )}
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="app-shell__card" aria-label="智能问答查询输入">
            <div className="page-card-head">
              <p className="app-shell__section-label">智能问答查询</p>
              <h3 className="app-shell__card-title">自然语言分析提问</h3>
            </div>
            <div className="analytics-filter-grid page-form-grid">
              <label className="store-field analytics-field-wide">
                问题
                <textarea
                  rows={3}
                  value={copilotQuestion}
                  onChange={(event) => setCopilotQuestion(event.target.value)}
                  placeholder="例如：按部门统计总成本"
                />
              </label>

              <label className="store-field">
                开始日期（可选）
                <input
                  type="date"
                  value={copilotStartDate}
                  onChange={(event) => setCopilotStartDate(event.target.value)}
                />
              </label>

              <label className="store-field">
                结束日期（可选）
                <input
                  type="date"
                  value={copilotEndDate}
                  onChange={(event) => setCopilotEndDate(event.target.value)}
                />
              </label>

              <label className="store-field">
                返回条数（可选）
                <input
                  value={copilotLimit}
                  onChange={(event) => setCopilotLimit(event.target.value)}
                  placeholder="1-200"
                />
              </label>

              <button
                className="auth-submit"
                type="button"
                disabled={isRunningCopilot || !canRunCopilot}
                onClick={() => {
                  void handleRunCopilot();
                }}
              >
                {isRunningCopilot ? "执行中..." : "执行智能问答查询"}
              </button>
            </div>
          </section>

            <section className="app-shell__card" aria-label="智能问答查询结果">
              <div className="page-card-head">
                <p className="app-shell__section-label">智能问答结果</p>
                <h3 className="app-shell__card-title">查询计划 + 返回数据</h3>
              </div>
            {isRunningCopilot ? (
              <p className="app-shell__card-copy">正在执行智能问答查询...</p>
            ) : !copilotResult ? (
              <p className="app-shell__card-copy">暂无结果，请先输入问题并执行查询。</p>
            ) : (
              <div className="analytics-copilot-result">
                <div className="app-shell__panel">
                  <p className="app-shell__card-copy">
                    指标：<strong>{toCopilotMetricLabel(copilotResult.queryPlan.metric)}</strong>
                    {" · "}
                    维度：
                    <strong>
                      {copilotResult.queryPlan.dimensions.length
                        ? copilotResult.queryPlan.dimensions.map(toCopilotDimensionLabel).join("，")
                        : "无"}
                    </strong>
                    {" · "}
                    返回条数：<strong>{copilotResult.queryPlan.limit}</strong>
                  </p>
                  <p className="app-shell__card-copy">
                    过滤条件：
                    {copilotResult.queryPlan.filters.length
                      ? copilotResult.queryPlan.filters
                          .map((item) => `${item.field} ${toCopilotFilterOpLabel(item.op)} ${String(item.value)}`)
                          .join("；")
                      : "无"}
                  </p>
                  <p className="app-shell__card-copy">
                    排序：
                    {copilotResult.queryPlan.orderBy.length
                      ? copilotResult.queryPlan.orderBy
                          .map((item) => `${item.field} ${toCopilotSortDirectionLabel(item.direction)}`)
                          .join("，")
                      : "无"}
                  </p>
                </div>

                {copilotResult.rows.length ? (
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        按返回列结构渲染的查询结果表
                      </caption>
                      <thead>
                        <tr>
                          {copilotResult.columns.map((column) => (
                            <th key={column} scope="col">
                              {toCopilotColumnLabel(column)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {copilotResult.rows.map((row) => {
                          const rowKey = row
                            .map((value) => (value === null || value === undefined ? "-" : String(value)))
                            .join("|");
                          return (
                            <tr key={`copilot-row-${rowKey}`}>
                              {copilotResult.columns.map((column, columnIndex) => {
                                const value = row[columnIndex];
                                return (
                                  <td key={`copilot-cell-${rowKey}-${column}`}>
                                    {value === null || value === undefined ? "-" : String(value)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="app-shell__card-copy">
                    结果为空，请调整问题或约束条件后重试。
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

