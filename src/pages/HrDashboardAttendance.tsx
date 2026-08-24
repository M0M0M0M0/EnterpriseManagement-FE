import {
  Badge,
  Button,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  Input,
  Option,
  OverlayDrawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  TableCellLayout,
  Textarea,
  createTableColumn,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { LineChart } from "@fluentui/react-charts";
import {
  ArrowRightRegular,
  CheckmarkRegular,
  ClockRegular,
  DismissRegular,
  DocumentBulletListRegular,
  EyeRegular,
  PeopleTeamRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { format, subDays } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AttendanceBadge,
  EmployeeAvatar,
  EmptyState,
  MetricRail,
  PageHeader,
  SectionPanel,
} from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useAppStore } from "../store/useAppStore";
import type { AttendanceRecord, AttendanceStatus } from "../types/domain";
import {
  formatDate,
  formatDateTime,
  formatTime,
  isoDate,
} from "../utils/format";

export function HrDashboardPage() {
  const employees = useAppStore((state) => state.employees);
  const departments = useAppStore((state) => state.departments);
  const records = useAppStore((state) => state.attendanceRecords);
  const leaveRequests = useAppStore((state) => state.leaveRequests);
  const adjustments = useAppStore((state) => state.adjustmentRequests);
  const demoDate = useAppStore((state) => state.demo.simulatedDate);
  const navigate = useNavigate();
  const date = demoDate || isoDate();
  const activeEmployees = employees.filter((item) => item.status === "active");
  const today = records.filter(
    (item) =>
      item.date === date &&
      activeEmployees.some((employee) => employee.id === item.employeeId),
  );
  const checked = today.filter((item) => item.checkIn).length;
  const late = today.filter((item) => item.status === "late").length;
  const absent = today.filter((item) => item.status === "absent").length;
  const pending =
    leaveRequests.filter((item) => item.status === "pending").length +
    adjustments.filter((item) => item.status === "pending").length;
  const exceptions = today
    .filter((item) => item.status !== "on-time")
    .slice(0, 6);

  const lineData = Array.from({ length: 7 }, (_, reverseIndex) => {
    const itemDate = format(
      subDays(new Date(`${date}T12:00:00`), 6 - reverseIndex),
      "yyyy-MM-dd",
    );
    return {
      x: formatDate(itemDate, "dd/MM"),
      y: records.filter((item) => item.date === itemDate && item.checkIn)
        .length,
      xAxisCalloutData: formatDate(itemDate),
      yAxisCalloutData: `${records.filter((item) => item.date === itemDate && item.checkIn).length} người`,
    };
  });

  return (
    <div className="page-stack">
      <PageHeader
        title="Tổng quan nhân sự"
        description={`Dữ liệu minh họa ngày ${formatDate(date)}. Theo dõi tình hình làm việc trong một màn hình.`}
      />
      <MetricRail
        items={[
          {
            label: "Đã chấm công",
            value: `${checked}/${activeEmployees.length}`,
            detail: "Nhân viên hoạt động",
            tone: "brand",
          },
          {
            label: "Đi muộn",
            value: late,
            detail: late ? "Cần đối chiếu" : "Không có bất thường",
            tone: late ? "warning" : "success",
          },
          {
            label: "Vắng mặt",
            value: absent,
            detail: "Theo lịch hôm nay",
            tone: absent ? "danger" : "success",
          },
          {
            label: "Đơn chờ duyệt",
            value: pending,
            detail: "Nghỉ phép và điều chỉnh",
            tone: pending ? "warning" : "success",
          },
        ]}
      />

      <div className="dashboard-grid">
        <SectionPanel title="Xu hướng chấm công 7 ngày" className="chart-panel">
          <div
            className="chart-container"
            role="img"
            aria-label="Biểu đồ số người chấm công trong 7 ngày"
          >
            <LineChart
              data={{
                lineChartData: [
                  {
                    legend: "Đã chấm công",
                    color: "#2563EB",
                    data: lineData,
                    lineOptions: { strokeWidth: 3 },
                  },
                ],
              }}
              enableReflow
              height={260}
              yMinValue={0}
              yMaxValue={activeEmployees.length}
              hideLegend
            />
          </div>
        </SectionPanel>
        <SectionPanel title="Cơ cấu nhân sự">
          <div className="department-breakdown">
            {departments.map((department) => {
              const count = activeEmployees.filter(
                (employee) => employee.departmentId === department.id,
              ).length;
              return (
                <div key={department.id}>
                  <div>
                    <strong>{department.name}</strong>
                    <span>{count} người</span>
                  </div>
                  <span className="department-share">
                    {Math.round((count / activeEmployees.length) * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </SectionPanel>
      </div>

      <div className="two-column-grid wide-left">
        <SectionPanel
          title="Bất thường hôm nay"
          action={
            <Button
              appearance="subtle"
              icon={<ArrowRightRegular />}
              iconPosition="after"
              onClick={() => navigate("/hr/attendance")}
            >
              Xem tất cả
            </Button>
          }
        >
          <div className="compact-list">
            {exceptions.map((record) => {
              const employee = employees.find(
                (item) => item.id === record.employeeId,
              );
              return employee ? (
                <div className="compact-row" key={record.id}>
                  <div className="person-line">
                    <EmployeeAvatar
                      name={employee.fullName}
                      color={employee.avatarColor}
                    />
                    <div>
                      <strong>{employee.fullName}</strong>
                      <span>
                        {employee.employeeCode} · {formatTime(record.checkIn)}
                      </span>
                    </div>
                  </div>
                  <AttendanceBadge status={record.status} />
                </div>
              ) : null;
            })}
          </div>
        </SectionPanel>
        <SectionPanel title="Thao tác nhanh">
          <div className="quick-actions">
            <Button
              appearance="secondary"
              icon={<PeopleTeamRegular />}
              onClick={() => navigate("/hr/employees")}
            >
              Thêm nhân viên
            </Button>
            <Button
              appearance="secondary"
              icon={<ClockRegular />}
              onClick={() => navigate("/hr/attendance")}
            >
              Kiểm tra chấm công
            </Button>
            <Button
              appearance="secondary"
              icon={<DocumentBulletListRegular />}
              onClick={() => navigate("/hr/leave")}
            >
              Duyệt đơn nghỉ
            </Button>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

export function HrAttendancePage() {
  const records = useAppStore((state) => state.attendanceRecords);
  const employees = useAppStore((state) => state.employees);
  const departments = useAppStore((state) => state.departments);
  const shifts = useAppStore((state) => state.shifts);
  const adjustments = useAppStore((state) => state.adjustmentRequests);
  const reviewRequest = useAppStore((state) => state.reviewRequest);
  const demoDate = useAppStore((state) => state.demo.simulatedDate);
  const notify = useNotify();
  const [date, setDate] = useState(demoDate || isoDate());
  const [department, setDepartment] = useState("all");
  const [shift, setShift] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");

    return records.filter((record) => {
      const employee = employees.find((item) => item.id === record.employeeId);
      const searchableEmployee = employee
        ? `${employee.employeeCode} ${employee.fullName} ${employee.email}`.toLocaleLowerCase(
            "vi-VN",
          )
        : "";

      return (
        record.date === date &&
        (!normalizedSearch || searchableEmployee.includes(normalizedSearch)) &&
        (department === "all" || employee?.departmentId === department) &&
        (shift === "all" || record.shiftId === shift) &&
        (status === "all" || record.status === status)
      );
    });
  }, [records, employees, date, search, department, shift, status]);

  const columns: TableColumnDefinition<AttendanceRecord>[] = [
    createTableColumn({
      columnId: "employee",
      compare: (a, b) => {
        const aName =
          employees.find((item) => item.id === a.employeeId)?.fullName ?? "";
        const bName =
          employees.find((item) => item.id === b.employeeId)?.fullName ?? "";
        return aName.localeCompare(bName);
      },
      renderHeaderCell: () => "Nhân viên",
      renderCell: (item) => {
        const employee = employees.find(
          (value) => value.id === item.employeeId,
        );
        return employee ? (
          <TableCellLayout
            media={
              <EmployeeAvatar
                name={employee.fullName}
                color={employee.avatarColor}
                size={32}
              />
            }
          >
            <strong>{employee.fullName}</strong>
            <small>{employee.employeeCode}</small>
          </TableCellLayout>
        ) : (
          "--"
        );
      },
    }),
    createTableColumn({
      columnId: "shift",
      renderHeaderCell: () => "Ca làm",
      renderCell: (item) =>
        shifts.find((value) => value.id === item.shiftId)?.name ?? "--",
    }),
    createTableColumn({
      columnId: "checkIn",
      renderHeaderCell: () => "Check-in",
      renderCell: (item) => formatTime(item.checkIn),
    }),
    createTableColumn({
      columnId: "checkOut",
      renderHeaderCell: () => "Check-out",
      renderCell: (item) => formatTime(item.checkOut),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Trạng thái",
      renderCell: (item) => <AttendanceBadge status={item.status} />,
    }),
    createTableColumn({
      columnId: "action",
      renderHeaderCell: () => "",
      renderCell: (item) => (
        <Button
          appearance="subtle"
          icon={<EyeRegular />}
          aria-label="Xem chi tiết"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(item);
          }}
        />
      ),
    }),
  ];

  const pendingAdjustments = adjustments.filter(
    (item) => item.status === "pending",
  );
  const review = (id: string, decision: "approved" | "rejected") => {
    notify(
      reviewRequest(
        "adjustment",
        id,
        decision,
        reviewNote ||
          (decision === "approved"
            ? "Đã đối chiếu thông tin."
            : "Thông tin chưa đủ để xác minh."),
      ),
    );
    setReviewNote("");
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý chấm công"
        description="Lọc bản ghi theo ngày, phòng ban và xử lý các trường hợp bất thường."
      />
      <div className="toolbar filter-grid attendance-filters">
        <Field label="Tìm nhân viên">
          <Input
            value={search}
            contentBefore={<SearchRegular />}
            placeholder="Mã, tên hoặc email"
            onChange={(_, data) => setSearch(data.value)}
          />
        </Field>
        <Field label="Ngày">
          <Input
            type="date"
            value={date}
            onChange={(_, data) => setDate(data.value)}
          />
        </Field>
        <Field label="Phòng ban">
          <Dropdown
            value={
              department === "all"
                ? "Tất cả phòng ban"
                : departments.find((item) => item.id === department)?.name
            }
            selectedOptions={[department]}
            onOptionSelect={(_, data) =>
              setDepartment(data.optionValue ?? "all")
            }
          >
            <Option value="all">Tất cả phòng ban</Option>
            {departments.map((item) => (
              <Option key={item.id} value={item.id}>
                {item.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Ca làm">
          <Dropdown
            value={
              shift === "all"
                ? "Tất cả ca làm"
                : shifts.find((item) => item.id === shift)?.name
            }
            selectedOptions={[shift]}
            onOptionSelect={(_, data) => setShift(data.optionValue ?? "all")}
          >
            <Option value="all">Tất cả ca làm</Option>
            {shifts.map((item) => (
              <Option key={item.id} value={item.id}>
                {item.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Trạng thái">
          <Dropdown
            value={
              status === "all"
                ? "Tất cả trạng thái"
                : attendanceLabel(status as AttendanceStatus)
            }
            selectedOptions={[status]}
            onOptionSelect={(_, data) => setStatus(data.optionValue ?? "all")}
          >
            <Option value="all">Tất cả trạng thái</Option>
            {(
              [
                "on-time",
                "late",
                "early-leave",
                "absent",
                "missing-checkout",
              ] as AttendanceStatus[]
            ).map((item) => (
              <Option key={item} value={item}>
                {attendanceLabel(item)}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>

      <SectionPanel
        title={`Bản ghi ngày ${formatDate(date)}`}
        action={
          <Badge appearance="tint" color="informative">
            {filtered.length} bản ghi
          </Badge>
        }
      >
        {filtered.length ? (
          <>
            <div className="data-grid-wrap">
              <DataGrid
                items={filtered}
                columns={columns}
                sortable
                getRowId={(item) => item.id}
              >
                <DataGridHeader>
                  <DataGridRow>
                    {({ renderHeaderCell }) => (
                      <DataGridHeaderCell>
                        {renderHeaderCell()}
                      </DataGridHeaderCell>
                    )}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<AttendanceRecord>>
                  {({ item, rowId }) => (
                    <DataGridRow<AttendanceRecord>
                      key={rowId}
                      onClick={() => setSelected(item)}
                    >
                      {({ renderCell }) => (
                        <DataGridCell>{renderCell(item)}</DataGridCell>
                      )}
                    </DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
            </div>
            <div className="mobile-record-list">
              {filtered.map((record) => {
                const employee = employees.find(
                  (item) => item.id === record.employeeId,
                );
                return employee ? (
                  <button
                    type="button"
                    key={record.id}
                    onClick={() => setSelected(record)}
                  >
                    <div className="person-line">
                      <EmployeeAvatar
                        name={employee.fullName}
                        color={employee.avatarColor}
                      />
                      <div>
                        <strong>{employee.fullName}</strong>
                        <span>
                          {formatTime(record.checkIn)} -{" "}
                          {formatTime(record.checkOut)}
                        </span>
                      </div>
                    </div>
                    <AttendanceBadge status={record.status} />
                  </button>
                ) : null;
              })}
            </div>
          </>
        ) : (
          <EmptyState
            title="Không có bản ghi phù hợp"
            description="Thử thay đổi mã nhân viên hoặc các bộ lọc đang chọn."
          />
        )}
      </SectionPanel>

      <SectionPanel
        title="Yêu cầu điều chỉnh chờ xử lý"
        action={
          <Badge
            appearance="tint"
            color={pendingAdjustments.length ? "warning" : "success"}
          >
            {pendingAdjustments.length}
          </Badge>
        }
      >
        {pendingAdjustments.length ? (
          <div className="review-list">
            {pendingAdjustments.map((request) => {
              const employee = employees.find(
                (item) => item.id === request.employeeId,
              );
              return (
                <article key={request.id}>
                  <div className="review-content">
                    <div className="person-line">
                      <EmployeeAvatar
                        name={employee?.fullName ?? ""}
                        color={employee?.avatarColor ?? "#2563EB"}
                      />
                      <div>
                        <strong>{employee?.fullName}</strong>
                        <span>
                          {formatDate(request.date)} · Gửi{" "}
                          {formatDateTime(request.createdAt)}
                        </span>
                      </div>
                    </div>
                    <p>{request.reason}</p>
                    <div className="requested-time">
                      <span>Giờ đề xuất</span>
                      <strong>
                        {formatTime(request.requestedCheckIn)} -{" "}
                        {formatTime(request.requestedCheckOut)}
                      </strong>
                    </div>
                    <Field label="Ghi chú xử lý">
                      <Textarea
                        resize="vertical"
                        value={reviewNote}
                        onChange={(_, data) => setReviewNote(data.value)}
                      />
                    </Field>
                  </div>
                  <div className="review-actions">
                    <Button
                      appearance="primary"
                      icon={<CheckmarkRegular />}
                      onClick={() => review(request.id, "approved")}
                    >
                      Duyệt
                    </Button>
                    <Button
                      appearance="secondary"
                      icon={<DismissRegular />}
                      onClick={() => review(request.id, "rejected")}
                    >
                      Từ chối
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="all-clear">
            <CheckmarkRegular />
            <div>
              <strong>Không có yêu cầu chờ xử lý</strong>
              <p>Mọi yêu cầu điều chỉnh đã được phản hồi.</p>
            </div>
          </div>
        )}
      </SectionPanel>

      <OverlayDrawer
        open={Boolean(selected)}
        onOpenChange={(_, data) => !data.open && setSelected(null)}
        position="end"
        size="medium"
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                aria-label="Đóng"
                onClick={() => setSelected(null)}
              />
            }
          >
            Chi tiết chấm công
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
          {selected ? (
            <AttendanceDetail
              record={selected}
              employees={employees}
              shifts={shifts}
              departments={departments}
            />
          ) : null}
        </DrawerBody>
      </OverlayDrawer>
    </div>
  );
}

function attendanceLabel(status: AttendanceStatus) {
  const labels: Record<AttendanceStatus, string> = {
    "on-time": "Đúng giờ",
    late: "Đi muộn",
    "early-leave": "Về sớm",
    absent: "Vắng mặt",
    "missing-checkout": "Thiếu check-out",
  };
  return labels[status];
}

function AttendanceDetail({
  record,
  employees,
  shifts,
  departments,
}: {
  record: AttendanceRecord;
  employees: ReturnType<typeof useAppStore.getState>["employees"];
  shifts: ReturnType<typeof useAppStore.getState>["shifts"];
  departments: ReturnType<typeof useAppStore.getState>["departments"];
}) {
  const employee = employees.find((item) => item.id === record.employeeId);
  const shift = shifts.find((item) => item.id === record.shiftId);
  const department = departments.find(
    (item) => item.id === employee?.departmentId,
  );
  return (
    <div className="drawer-detail">
      <div className="drawer-person">
        <EmployeeAvatar
          name={employee?.fullName ?? ""}
          color={employee?.avatarColor ?? "#2563EB"}
          size={48}
        />
        <div>
          <h3>{employee?.fullName}</h3>
          <p>
            {employee?.employeeCode} · {department?.name}
          </p>
        </div>
      </div>
      <AttendanceBadge status={record.status} />
      <dl className="detail-list">
        <div>
          <dt>Ngày</dt>
          <dd>{formatDate(record.date)}</dd>
        </div>
        <div>
          <dt>Ca làm</dt>
          <dd>
            {shift?.name} ({shift?.startTime} - {shift?.endTime})
          </dd>
        </div>
        <div>
          <dt>Check-in</dt>
          <dd>{formatDateTime(record.checkIn)}</dd>
        </div>
        <div>
          <dt>Check-out</dt>
          <dd>{formatDateTime(record.checkOut)}</dd>
        </div>
        <div>
          <dt>Phương thức</dt>
          <dd>
            {record.capture?.method === "geolocation" ? "Vị trí" : "Mã QR"}
          </dd>
        </div>
        <div>
          <dt>Địa điểm</dt>
          <dd>{record.capture?.locationLabel ?? "--"}</dd>
        </div>
        <div>
          <dt>Độ chính xác</dt>
          <dd>
            {record.capture?.accuracy ? `${record.capture.accuracy} m` : "--"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
