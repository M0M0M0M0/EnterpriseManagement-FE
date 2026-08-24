import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Tab,
  TabList,
  Textarea,
  type SelectTabData,
  type SelectTabEvent,
} from "@fluentui/react-components";
import {
  AddRegular,
  CheckmarkRegular,
  DismissRegular,
  MoneyRegular,
  PlayRegular,
} from "@fluentui/react-icons";
import { useState, type ReactNode } from "react";
import {
  EmptyState,
  EmployeeAvatar,
  MetricRail,
  PageHeader,
  SectionPanel,
} from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useAppStore } from "../store/useAppStore";
import type {
  Customer,
  CustomerStatus,
  Kpi,
  Payroll,
  SaleStatus,
} from "../types/domain";
import { formatCurrency, formatDate, formatNumber } from "../utils/format";

function statusColor(status: string) {
  if (["approved", "active", "completed", "paid", "healthy"].includes(status))
    return "success" as const;
  if (["pending", "expiring", "in-progress", "draft"].includes(status))
    return "warning" as const;
  return "danger" as const;
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | number | ReactNode>>;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="Không có dữ liệu"
        description="Thử đổi bộ lọc hoặc tạo bản ghi mới."
      />
    );
  return (
    <div className="data-grid-wrap enterprise-table-wrap">
      <table className="enterprise-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonCell({ employeeId }: { employeeId: string }) {
  const employees = useAppStore((state) => state.employees);
  const employee = employees.find((item) => item.id === employeeId);
  return employee ? (
    <div className="person-line">
      <EmployeeAvatar
        name={employee.fullName}
        color={employee.avatarColor}
        size={30}
      />
      <div>
        <strong>{employee.fullName}</strong>
        <span>{employee.employeeCode}</span>
      </div>
    </div>
  ) : (
    <span>--</span>
  );
}

export function CustomersPage() {
  const customers = useAppStore((state) => state.customers);
  const addCustomer = useAppStore((state) => state.addCustomer);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  const notify = useNotify();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [draft, setDraft] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    status: "active" as CustomerStatus,
    contractEndDate: "2026-12-31",
  });
  const filtered = customers.filter((item) =>
    `${item.customerCode} ${item.customerName} ${item.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const save = () => {
    const result = editing
      ? updateCustomer(editing.id, draft)
      : addCustomer(draft);
    notify(result);
    if (result.ok) setOpen(false);
  };
  return (
    <div className="page-stack">
      <PageHeader
        title="Khách hàng"
        description="Quản lý hồ sơ khách hàng và trạng thái hợp đồng."
        action={
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => {
              setEditing(null);
              setDraft({
                customerName: "",
                email: "",
                phone: "",
                address: "",
                status: "active",
                contractEndDate: "2026-12-31",
              });
              setOpen(true);
            }}
          >
            Thêm khách hàng
          </Button>
        }
      />
      <MetricRail
        items={[
          { label: "Tổng khách hàng", value: customers.length },
          {
            label: "Đang sử dụng",
            value: customers.filter((item) => item.status === "active").length,
            tone: "success",
          },
          {
            label: "Sắp hết hợp đồng",
            value: customers.filter((item) => item.status === "expiring").length,
            tone: "warning",
          },
        ]}
      />
      <div className="toolbar">
        <Field label="Tìm kiếm">
          <Input
            value={search}
            onChange={(_, data) => setSearch(data.value)}
            placeholder="Mã, tên hoặc email"
          />
        </Field>
      </div>
      <SectionPanel title="Danh sách khách hàng">
        <DataTable
          columns={["Mã", "Tên khách hàng", "Email", "Điện thoại", "Trạng thái", "Hành động"]}
          rows={filtered.map((item) => [
            item.customerCode,
            item.customerName,
            item.email,
            item.phone,
            <Badge key="status" appearance="tint" color={statusColor(item.status)}>
              {item.status}
            </Badge>,
            <Button
              key="edit"
              size="small"
              onClick={() => {
                setEditing(item);
                setDraft({
                  customerName: item.customerName,
                  email: item.email,
                  phone: item.phone,
                  address: item.address,
                  status: item.status,
                  contractEndDate: item.contractEndDate ?? "",
                });
                setOpen(true);
              }}
            >
              Sửa
            </Button>,
          ])}
        />
      </SectionPanel>
      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {editing ? "Cập nhật khách hàng" : "Thêm khách hàng"}
            </DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Tên khách hàng" required>
                <Input
                  value={draft.customerName}
                  onChange={(_, data) =>
                    setDraft((value) => ({
                      ...value,
                      customerName: data.value,
                    }))
                  }
                />
              </Field>
              <div className="form-grid">
                <Field label="Email">
                  <Input
                    value={draft.email}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, email: data.value }))
                    }
                  />
                </Field>
                <Field label="Điện thoại">
                  <Input
                    value={draft.phone}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, phone: data.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="Địa chỉ">
                <Textarea
                  value={draft.address}
                  onChange={(_, data) =>
                    setDraft((value) => ({ ...value, address: data.value }))
                  }
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={save}>
                Lưu
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function SalesRecordsPage() {
  const sales = useAppStore((state) => state.salesRecords);
  const customers = useAppStore((state) => state.customers);
  const reviewSale = useAppStore((state) => state.reviewSale);
  const cancelSale = useAppStore((state) => state.cancelSale);
  const addSale = useAppStore((state) => state.addSale);
  const notify = useNotify();
  const [status, setStatus] = useState<SaleStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    employeeId: "emp-004",
    customerId: customers[0]?.id ?? "",
    contractValue: 50000000,
    saleDate: "2026-08-23",
    note: "",
  });
  const filtered = status === "all" ? sales : sales.filter((item) => item.status === status);
  const revenue = sales
    .filter((item) => item.status === "approved")
    .reduce((sum, item) => sum + item.contractValue, 0);
  return (
    <div className="page-stack">
      <PageHeader
        title="Sales"
        description="Theo dõi doanh số, duyệt hợp đồng và xử lý điều chỉnh."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setOpen(true)}>
            Tạo sale
          </Button>
        }
      />
      <MetricRail
        items={[
          { label: "Tổng sale", value: sales.length },
          { label: "Chờ duyệt", value: sales.filter((item) => item.status === "pending").length, tone: "warning" },
          { label: "Doanh thu duyệt", value: formatCurrency(revenue), tone: "success" },
        ]}
      />
      <TabList
        selectedValue={status}
        onTabSelect={(_: SelectTabEvent, data: SelectTabData) =>
          setStatus(String(data.value) as SaleStatus | "all")
        }
      >
        <Tab value="all">Tất cả</Tab>
        <Tab value="pending">Chờ duyệt</Tab>
        <Tab value="approved">Đã duyệt</Tab>
        <Tab value="rejected">Từ chối</Tab>
        <Tab value="cancelled">Đã hủy</Tab>
      </TabList>
      <SectionPanel title="Danh sách sale">
        <DataTable
          columns={["Mã", "Nhân viên", "Khách hàng", "Giá trị", "Ngày", "Trạng thái", "Hành động"]}
          rows={filtered.map((item) => [
            item.saleCode,
            <PersonCell key="employee" employeeId={item.employeeId} />,
            customers.find((customer) => customer.id === item.customerId)
              ?.customerName ?? "--",
            formatCurrency(item.contractValue),
            formatDate(item.saleDate),
            <Badge key="status" appearance="tint" color={statusColor(item.status)}>
              {item.status}
            </Badge>,
            <div key="actions" className="row-actions">
              <Button
                size="small"
                icon={<CheckmarkRegular />}
                disabled={item.status !== "pending"}
                onClick={() => notify(reviewSale(item.id, "approved", "Đã xác minh hợp đồng."))}
              />
              <Button
                size="small"
                icon={<DismissRegular />}
                disabled={item.status !== "pending"}
                onClick={() => notify(reviewSale(item.id, "rejected", "Thông tin chưa khớp."))}
              />
              <Button
                size="small"
                onClick={() => notify(cancelSale(item.id, "Khách hàng hủy hợp đồng."))}
              >
                Hủy
              </Button>
            </div>,
          ])}
        />
      </SectionPanel>
      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tạo sale</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Nhân viên">
                <Input
                  value={draft.employeeId}
                  onChange={(_, data) =>
                    setDraft((value) => ({ ...value, employeeId: data.value }))
                  }
                />
              </Field>
              <Field label="Khách hàng">
                <Input
                  value={draft.customerId}
                  onChange={(_, data) =>
                    setDraft((value) => ({ ...value, customerId: data.value }))
                  }
                />
              </Field>
              <Field label="Giá trị hợp đồng">
                <Input
                  type="number"
                  value={String(draft.contractValue)}
                  onChange={(_, data) =>
                    setDraft((value) => ({
                      ...value,
                      contractValue: Number(data.value),
                    }))
                  }
                />
              </Field>
              <Field label="Ghi chú">
                <Textarea
                  value={draft.note}
                  onChange={(_, data) =>
                    setDraft((value) => ({ ...value, note: data.value }))
                  }
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button
                appearance="primary"
                onClick={() => {
                  const result = addSale(draft);
                  notify(result);
                  if (result.ok) setOpen(false);
                }}
              >
                Lưu
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function KpiPage() {
  const kpis = useAppStore((state) => state.kpis);
  const calculateKpi = useAppStore((state) => state.calculateKpi);
  const notify = useNotify();
  return (
    <div className="page-stack">
      <PageHeader
        title="KPI"
        description="Theo dõi target, doanh thu thực tế và tỷ lệ hoàn thành."
      />
      <MetricRail
        items={[
          { label: "Tổng KPI", value: kpis.length },
          {
            label: "Hoàn thành",
            value: kpis.filter((item) => item.status === "completed").length,
            tone: "success",
          },
          {
            label: "Tỷ lệ TB",
            value: `${formatNumber(
              kpis.reduce((sum, item) => sum + item.achievementRate, 0) /
                Math.max(1, kpis.length),
            )}%`,
          },
        ]}
      />
      <SectionPanel title="Danh sách KPI">
        <DataTable
          columns={["Nhân viên", "Kỳ", "Target", "Thực tế", "Hoàn thành", "Trạng thái", "Hành động"]}
          rows={kpis.map((item: Kpi) => [
            <PersonCell key="employee" employeeId={item.employeeId} />,
            item.period,
            formatCurrency(item.targetValue),
            formatCurrency(item.actualValue),
            `${item.achievementRate}%`,
            <Badge key="status" appearance="tint" color={statusColor(item.status)}>
              {item.status}
            </Badge>,
            <Button
              key="calculate"
              size="small"
              icon={<PlayRegular />}
              onClick={() => notify(calculateKpi(item.id))}
            >
              Tính
            </Button>,
          ])}
        />
      </SectionPanel>
    </div>
  );
}

export function PayrollPage() {
  const payrolls = useAppStore((state) => state.payrolls);
  const approvePayroll = useAppStore((state) => state.approvePayroll);
  const payPayroll = useAppStore((state) => state.payPayroll);
  const calculatePayroll = useAppStore((state) => state.calculatePayroll);
  const notify = useNotify();
  const totalPayroll = payrolls.reduce((sum, item) => sum + item.netSalary, 0);
  return (
    <div className="page-stack">
      <PageHeader
        title="Bảng lương"
        description="Tính lương theo ngày công, nghỉ phép, hoa hồng và khấu trừ."
      />
      <MetricRail
        items={[
          { label: "Kỳ lương", value: "08/2026" },
          { label: "Tổng thực trả", value: formatCurrency(totalPayroll), tone: "success" },
          { label: "Chờ duyệt", value: payrolls.filter((item) => item.status === "draft").length, tone: "warning" },
        ]}
      />
      <SectionPanel title="Danh sách bảng lương">
        <DataTable
          columns={["Nhân viên", "Kỳ", "Ngày công", "Hoa hồng", "Khấu trừ", "Net", "Trạng thái", "Hành động"]}
          rows={payrolls.map((item: Payroll) => [
            <PersonCell key="employee" employeeId={item.employeeId} />,
            item.period,
            item.workingDays,
            formatCurrency(item.commission),
            formatCurrency(item.deduction),
            formatCurrency(item.netSalary),
            <Badge key="status" appearance="tint" color={statusColor(item.status)}>
              {item.status}
            </Badge>,
            <div key="actions" className="row-actions">
              <Button size="small" onClick={() => notify(calculatePayroll(item.id))}>
                Tính
              </Button>
              <Button
                size="small"
                disabled={item.status !== "draft"}
                onClick={() => notify(approvePayroll(item.id, "Payroll verified"))}
              >
                Duyệt
              </Button>
              <Button
                size="small"
                disabled={item.status === "paid"}
                icon={<MoneyRegular />}
                onClick={() =>
                  notify(payPayroll(item.id, "BANK_TRANSFER", `PAY-${item.id}`))
                }
              >
                Trả
              </Button>
            </div>,
          ])}
        />
      </SectionPanel>
    </div>
  );
}

export function AdminUsersPage() {
  const users = useAppStore((state) => state.users);
  const roles = useAppStore((state) => state.roles);
  const permissions = useAppStore((state) => state.permissions);
  return (
    <div className="page-stack">
      <PageHeader
        title="Tài khoản và phân quyền"
        description="Quản lý user, role, permission và menu theo API Excel."
      />
      <MetricRail
        items={[
          { label: "Users", value: users.length },
          { label: "Roles", value: roles.length },
          { label: "Permissions", value: permissions.length },
        ]}
      />
      <SectionPanel title="Danh sách user">
        <DataTable
          columns={["Username", "Email", "Roles", "Trạng thái"]}
          rows={users.map((user) => [
            user.username,
            user.email,
            user.roleIds
              .map((id) => roles.find((role) => role.id === id)?.roleName)
              .filter(Boolean)
              .join(", "),
            <Badge
              key="status"
              appearance="tint"
              color={user.isActive ? "success" : "danger"}
            >
              {user.isActive ? "active" : "inactive"}
            </Badge>,
          ])}
        />
      </SectionPanel>
      <SectionPanel title="Vai trò">
        <DataTable
          columns={["Mã role", "Tên role", "Số quyền", "Trạng thái"]}
          rows={roles.map((role) => [
            role.roleCode,
            role.roleName,
            role.permissions.length,
            <Badge
              key="status"
              appearance="tint"
              color={role.isActive ? "success" : "danger"}
            >
              {role.isActive ? "active" : "inactive"}
            </Badge>,
          ])}
        />
      </SectionPanel>
    </div>
  );
}

export function AuditLogPage() {
  const auditLogs = useAppStore((state) => state.auditLogs);
  const users = useAppStore((state) => state.users);
  const [module, setModule] = useState("all");
  const modules = Array.from(new Set(auditLogs.map((item) => item.module)));
  const filtered = module === "all" ? auditLogs : auditLogs.filter((item) => item.module === module);
  return (
    <div className="page-stack">
      <PageHeader
        title="Audit log"
        description="Theo dõi lịch sử thao tác quan trọng trong hệ thống."
      />
      <div className="toolbar">
        <Field label="Module">
          <Input value={module} onChange={(_, data) => setModule(data.value || "all")} list="audit-modules" />
          <datalist id="audit-modules">
            <option value="all" />
            {modules.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </Field>
      </div>
      <SectionPanel title="Nhật ký thao tác">
        <DataTable
          columns={["Thời gian", "User", "Module", "Action", "Target", "IP"]}
          rows={filtered.map((item) => [
            formatDate(item.createdAt),
            users.find((user) => user.id === item.userId)?.username ?? item.userId,
            item.module,
            item.action,
            item.target,
            item.ipAddress,
          ])}
        />
      </SectionPanel>
    </div>
  );
}
