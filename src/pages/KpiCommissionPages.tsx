import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Spinner,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { ConfirmDialog, EmptyState, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { commissionApi, employeeApi, kpiPlanApi } from "../services/api";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";
import type { CommissionDto, EmployeeDto, KpiLevelInput, KpiPlanDto } from "../types/domain";
import { formatAmountInput, formatCurrency, formatDate, isoDate, parseAmountInput } from "../utils/format";

function useManagerCode() {
  return useAuthStore((state) => state.session?.employeeCode);
}

function formatRate(rate: number) {
  return `${(rate * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
}

const emptyLevelForm = { levelOrder: "1", minimumRevenue: "", commissionRatePercent: "" };

export function ManagerKpiCommissionPage() {
  const managerCode = useManagerCode();
  const notify = useNotify();

  const [plans, setPlans] = useState<KpiPlanDto[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<KpiPlanDto | null>(null);
  const [planForm, setPlanForm] = useState({ planName: "", description: "" });
  const [levelRows, setLevelRows] = useState([{ ...emptyLevelForm }]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [lockTarget, setLockTarget] = useState<KpiPlanDto | null>(null);
  const [lockingTarget, setLockingTarget] = useState(false);

  const [team, setTeam] = useState<EmployeeDto[]>([]);
  const [membersPlan, setMembersPlan] = useState<KpiPlanDto | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [savingMembers, setSavingMembers] = useState(false);

  const [pending, setPending] = useState<CommissionDto[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [calcForm, setCalcForm] = useState({
    employeeCode: "",
    periodStartDate: isoDate(new Date(new Date().setDate(1))),
    periodEndDate: isoDate(),
  });
  const [calculating, setCalculating] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const loadPlans = () => {
    setLoadingPlans(true);
    kpiPlanApi
      .getAll()
      .then(setPlans)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoadingPlans(false));
  };

  const loadPending = () => {
    setLoadingPending(true);
    commissionApi
      .getPending()
      .then(setPending)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoadingPending(false));
  };

  useEffect(loadPlans, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadPending, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!managerCode) return;
    employeeApi
      .getTeam(managerCode)
      .then((list) => {
        setTeam(list);
        setCalcForm((v) => ({ ...v, employeeCode: v.employeeCode || list[0]?.employeeCode || "" }));
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }));
  }, [managerCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({ planName: "", description: "" });
    setLevelRows([{ ...emptyLevelForm }]);
    setPlanOpen(true);
  };

  const openEditPlan = (plan: KpiPlanDto) => {
    setEditingPlan(plan);
    setPlanForm({ planName: plan.planName, description: plan.description ?? "" });
    setLevelRows(
      plan.levels
        .slice()
        .sort((a, b) => a.levelOrder - b.levelOrder)
        .map((l) => ({
          levelOrder: String(l.levelOrder),
          minimumRevenue: formatAmountInput(String(l.minimumRevenue)),
          commissionRatePercent: String(l.commissionRate * 100),
        })),
    );
    setPlanOpen(true);
  };

  const addLevelRow = () => {
    setLevelRows((rows) => [...rows, { ...emptyLevelForm, levelOrder: String(rows.length + 1) }]);
  };

  const removeLevelRow = (index: number) => {
    setLevelRows((rows) => rows.filter((_, i) => i !== index));
  };

  const updateLevelRow = (index: number, patch: Partial<(typeof levelRows)[number]>) => {
    setLevelRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const submitPlan = async () => {
    if (!planForm.planName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập tên KPI Plan." });
      return;
    }
    if (!levelRows.length) {
      notify({ ok: false, message: "Vui lòng thêm ít nhất 1 mức KPI." });
      return;
    }

    const levels: KpiLevelInput[] = [];
    for (const row of levelRows) {
      const levelOrder = Number(row.levelOrder);
      const minimumRevenue = parseAmountInput(row.minimumRevenue);
      const commissionRatePercent = Number(row.commissionRatePercent);
      if (!Number.isFinite(levelOrder) || levelOrder <= 0) {
        notify({ ok: false, message: "Thứ tự mức KPI phải là số nguyên dương." });
        return;
      }
      if (!Number.isFinite(minimumRevenue) || minimumRevenue < 0) {
        notify({ ok: false, message: "Doanh số tối thiểu phải là một số hợp lệ." });
        return;
      }
      if (!Number.isFinite(commissionRatePercent) || commissionRatePercent <= 0) {
        notify({ ok: false, message: "Tỷ lệ hoa hồng phải là một số lớn hơn 0." });
        return;
      }
      levels.push({ levelOrder, minimumRevenue, commissionRate: commissionRatePercent / 100 });
    }

    const payload = { planName: planForm.planName, description: planForm.description || undefined, levels };
    setSavingPlan(true);
    try {
      if (editingPlan) {
        await kpiPlanApi.update(editingPlan.id, payload);
        notify({ ok: true, message: "Đã cập nhật KPI Plan." });
      } else {
        await kpiPlanApi.create(payload);
        notify({ ok: true, message: "Đã tạo KPI Plan." });
      }
      setPlanOpen(false);
      setEditingPlan(null);
      loadPlans();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleTarget = async (plan: KpiPlanDto) => {
    try {
      await kpiPlanApi.setActive(plan.id, !plan.isActive);
      notify({ ok: true, message: "Đã cập nhật trạng thái KPI Plan." });
      loadPlans();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const confirmLockTarget = async () => {
    if (!lockTarget) return;
    setLockingTarget(true);
    try {
      await toggleTarget(lockTarget);
      setLockTarget(null);
    } finally {
      setLockingTarget(false);
    }
  };

  const openMembers = (plan: KpiPlanDto) => {
    setMembersPlan(plan);
    setSelectedMembers(new Set(plan.assignedEmployees.map((e) => e.employeeCode)));
  };

  const toggleMember = (employeeCode: string, checked: boolean) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(employeeCode);
      else next.delete(employeeCode);
      return next;
    });
  };

  const submitMembers = async () => {
    if (!membersPlan) return;
    setSavingMembers(true);
    try {
      await kpiPlanApi.assignEmployees(membersPlan.id, { employeeCodes: Array.from(selectedMembers) });
      notify({ ok: true, message: "Đã cập nhật danh sách nhân viên thuộc KPI Plan." });
      setMembersPlan(null);
      loadPlans();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSavingMembers(false);
    }
  };

  const submitCalculate = async () => {
    if (!calcForm.employeeCode) {
      notify({ ok: false, message: "Vui lòng chọn nhân viên." });
      return;
    }
    if (calcForm.periodEndDate < calcForm.periodStartDate) {
      notify({ ok: false, message: "Ngày kết thúc kỳ phải sau hoặc bằng ngày bắt đầu." });
      return;
    }
    setCalculating(true);
    try {
      const result = await commissionApi.calculate(calcForm);
      notify({
        ok: true,
        message: `Đã tính hoa hồng ${formatCurrency(result.commissionAmount)} cho kỳ ${formatDate(result.periodStartDate)} - ${formatDate(result.periodEndDate)}.`,
      });
      loadPending();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setCalculating(false);
    }
  };

  const approve = async (commission: CommissionDto) => {
    setApprovingId(commission.id);
    try {
      await commissionApi.approve(commission.id);
      notify({ ok: true, message: "Đã duyệt hoa hồng." });
      loadPending();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="KPI & Hoa hồng"
        description="Cấu hình KPI Plan (nhiều mức doanh số), gán nhân viên vào từng Plan, tính và duyệt hoa hồng theo kỳ."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={openCreatePlan}>
            Thêm KPI Plan
          </Button>
        }
      />

      {loadingPlans ? (
        <Spinner label="Đang tải..." />
      ) : plans.length ? (
        <SectionPanel title="KPI Plan">
          <div className="compact-list">
            {plans.map((plan) => (
              <div className="compact-row" key={plan.id}>
                <div>
                  <strong>{plan.planName}</strong>
                  <span>
                    {plan.levels.length} mức · {plan.assignedEmployees.length} nhân viên
                    {plan.description ? ` · ${plan.description}` : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <Badge appearance="tint" color={plan.isActive ? "success" : "subtle"}>
                    {plan.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                  <Button size="small" onClick={() => openMembers(plan)}>
                    Nhân viên
                  </Button>
                  <Button size="small" onClick={() => openEditPlan(plan)}>
                    Sửa
                  </Button>
                  <Button size="small" onClick={() => (plan.isActive ? setLockTarget(plan) : toggleTarget(plan))}>
                    {plan.isActive ? "Ngừng" : "Bật lại"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      ) : (
        <EmptyState title="Chưa có KPI Plan" description="Thêm KPI Plan đầu tiên để làm căn cứ tính hoa hồng." />
      )}

      <SectionPanel title="Tính hoa hồng">
        <div className="form-grid">
          <Field label="Nhân viên" required>
            <Dropdown
              value={team.find((e) => e.employeeCode === calcForm.employeeCode)?.fullName ?? ""}
              selectedOptions={[calcForm.employeeCode]}
              onOptionSelect={(_, data) => setCalcForm((v) => ({ ...v, employeeCode: data.optionValue ?? "" }))}
            >
              {team.map((e) => (
                <Option key={e.employeeCode} value={e.employeeCode} text={e.fullName}>
                  {e.fullName}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Từ ngày" required>
            <Input
              type="date"
              value={calcForm.periodStartDate}
              onChange={(_, data) => setCalcForm((v) => ({ ...v, periodStartDate: data.value }))}
            />
          </Field>
          <Field label="Đến ngày" required>
            <Input
              type="date"
              value={calcForm.periodEndDate}
              onChange={(_, data) => setCalcForm((v) => ({ ...v, periodEndDate: data.value }))}
            />
          </Field>
        </div>
        <p className="field-hint">KPI Plan được tự động suy ra theo Plan đã gán cho nhân viên — không cần chọn tay.</p>
        <Button appearance="primary" onClick={submitCalculate} disabled={calculating || !team.length}>
          {calculating ? <Spinner size="tiny" /> : "Tính hoa hồng"}
        </Button>
        {!team.length ? <p>Bạn chưa quản lý trực tiếp nhân viên nào.</p> : null}
      </SectionPanel>

      {loadingPending ? (
        <Spinner label="Đang tải..." />
      ) : pending.length ? (
        <SectionPanel title="Hoa hồng chờ duyệt">
          <div className="compact-list">
            {pending.map((commission) => (
              <div className="compact-row" key={commission.id}>
                <div>
                  <strong>{commission.employeeName}</strong>
                  <span>
                    Kỳ {formatDate(commission.periodStartDate)} - {formatDate(commission.periodEndDate)} · Doanh số{" "}
                    {formatCurrency(commission.totalRevenue)} · {commission.kpiPlanName} - Mức {commission.levelOrder} (
                    {formatRate(commission.commissionRate)}) · Hoa hồng {formatCurrency(commission.commissionAmount)}
                  </span>
                </div>
                <div className="row-actions">
                  <Button
                    appearance="primary"
                    size="small"
                    disabled={approvingId === commission.id}
                    onClick={() => approve(commission)}
                  >
                    {approvingId === commission.id ? <Spinner size="tiny" /> : "Duyệt"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      ) : (
        <EmptyState title="Không có hoa hồng chờ duyệt" description="Mọi hoa hồng đã tính đều đã được duyệt." />
      )}

      <Dialog
        open={planOpen}
        onOpenChange={(_, data) => {
          setPlanOpen(data.open);
          if (!data.open) setEditingPlan(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingPlan ? "Sửa KPI Plan" : "Thêm KPI Plan"}</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Tên KPI Plan" required hint='Ví dụ "KPI nhân viên chính thức", "KPI Intern".'>
                <Input
                  value={planForm.planName}
                  onChange={(_, data) => setPlanForm((v) => ({ ...v, planName: data.value }))}
                />
              </Field>
              <Field label="Mô tả">
                <Input
                  value={planForm.description}
                  onChange={(_, data) => setPlanForm((v) => ({ ...v, description: data.value }))}
                />
              </Field>

              <p>
                <strong>Các mức KPI</strong>
              </p>
              {levelRows.map((row, index) => (
                <div className="form-grid" key={index}>
                  <Field label={`Mức ${index + 1} — Thứ tự`} required>
                    <Input
                      type="number"
                      value={row.levelOrder}
                      onChange={(_, data) => updateLevelRow(index, { levelOrder: data.value })}
                    />
                  </Field>
                  <Field label="Doanh số tối thiểu (VND)" required>
                    <Input
                      value={row.minimumRevenue}
                      onChange={(_, data) => updateLevelRow(index, { minimumRevenue: formatAmountInput(data.value) })}
                    />
                  </Field>
                  <Field label="Tỷ lệ hoa hồng (%)" required>
                    <Input
                      type="number"
                      value={row.commissionRatePercent}
                      onChange={(_, data) => updateLevelRow(index, { commissionRatePercent: data.value })}
                    />
                  </Field>
                  <Button
                    icon={<DeleteRegular />}
                    disabled={levelRows.length <= 1}
                    onClick={() => removeLevelRow(index)}
                  >
                    Xoá mức
                  </Button>
                </div>
              ))}
              <Button icon={<AddRegular />} onClick={addLevelRow}>
                Thêm mức
              </Button>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPlanOpen(false)} disabled={savingPlan}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={submitPlan} disabled={savingPlan}>
                {savingPlan ? <Spinner size="tiny" /> : editingPlan ? "Lưu thay đổi" : "Thêm mới"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={membersPlan !== null} onOpenChange={(_, data) => !data.open && setMembersPlan(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Nhân viên thuộc "{membersPlan?.planName}"</DialogTitle>
            <DialogContent className="form-stack">
              {team.length ? (
                team.map((e) => (
                  <Checkbox
                    key={e.employeeCode}
                    label={`${e.fullName} (${e.employeeCode})`}
                    checked={selectedMembers.has(e.employeeCode)}
                    onChange={(_, data) => toggleMember(e.employeeCode, !!data.checked)}
                  />
                ))
              ) : (
                <p>Bạn chưa quản lý trực tiếp nhân viên nào.</p>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setMembersPlan(null)} disabled={savingMembers}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={submitMembers} disabled={savingMembers}>
                {savingMembers ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={lockTarget !== null}
        title="Ngừng KPI Plan?"
        description={`Plan "${lockTarget?.planName}" sẽ ngừng áp dụng cho các lần tính hoa hồng tiếp theo.`}
        confirmLabel="Ngừng Plan"
        confirming={lockingTarget}
        onConfirm={confirmLockTarget}
        onCancel={() => setLockTarget(null)}
      />
    </div>
  );
}

export function EmployeeCommissionPage() {
  const notify = useNotify();
  const [commissions, setCommissions] = useState<CommissionDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    commissionApi
      .getMine()
      .then(setCommissions)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-stack">
      <PageHeader title="Hoa hồng của tôi" description="Lịch sử hoa hồng đã được tính theo từng kỳ." />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : commissions.length ? (
        <div className="enterprise-table-wrap">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Kỳ</th>
                <th>Doanh số</th>
                <th>KPI Plan</th>
                <th>Mức</th>
                <th>Tỷ lệ</th>
                <th>Hoa hồng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td>
                    {formatDate(c.periodStartDate)} - {formatDate(c.periodEndDate)}
                  </td>
                  <td>{formatCurrency(c.totalRevenue)}</td>
                  <td>{c.kpiPlanName}</td>
                  <td>{c.levelOrder}</td>
                  <td>{formatRate(c.commissionRate)}</td>
                  <td>{formatCurrency(c.commissionAmount)}</td>
                  <td>
                    <Badge appearance="tint" color={c.status === "Approved" ? "success" : "informative"}>
                      {c.status === "Approved" ? "Đã duyệt" : "Chờ duyệt"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có hoa hồng" description="Hoa hồng sẽ xuất hiện ở đây sau khi quản lý tính cho bạn." />
      )}
    </div>
  );
}
