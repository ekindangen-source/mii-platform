import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, IconButton,
  InputAdornment, Menu, MenuItem, Paper, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, TextField,
  Tooltip, Typography
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  EngineID: "", ServiceDate: "",
  EngineHours: "", ServiceType: "", Technician: "",
  PartsReplaced: "", LaborHours: "", LaborCost: "",
  PartsCost: "", DowntimeHours: "", WarrantyClaim: "No",
  Status: "Completed", NextServiceDate: "",
  NextServiceHours: "", Remarks: ""
};

const serviceTypes = [
  "Inspection", "Routine Service", "250 Hour Service",
  "500 Hour Service", "1000 Hour Service", "Annual Service",
  "Repair", "Emergency Repair", "Warranty Work",
  "Repowering", "Other"
];

const statuses = ["Open", "In Progress", "Completed", "Cancelled"];
const warrantyOptions = ["No", "Yes", "Pending"];

const sortableColumns = [
  { id: "maintenance_id", label: "Maintenance ID" },
  { id: "service_date", label: "Date" },
  { id: "engine_name", label: "Engine" },
  { id: "status", label: "Status" },
  { id: "engine_hours", label: "Engine hours", numeric: true },
  { id: "total_cost", label: "Total cost", numeric: true },
];

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function numberOrNull(value) {
  return value === "" ? null : Number(value);
}

function currency(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number);
}

function statusColor(status) {
  switch (status) {
    case "Completed": return "success";
    case "In Progress": return "warning";
    case "Cancelled": return "default";
    case "Open":
    default: return "info";
  }
}

function mapRowToForm(row) {
  return {
    EngineID: row.engine_id || "",
    ServiceDate: formatDate(row.service_date),
    EngineHours: row.engine_hours ?? "",
    ServiceType: row.service_type || "",
    Technician: row.technician || "",
    PartsReplaced: row.parts_replaced || "",
    LaborHours: row.labor_hours ?? "",
    LaborCost: row.labor_cost ?? "",
    PartsCost: row.parts_cost ?? "",
    DowntimeHours: row.downtime_hours ?? "",
    WarrantyClaim: row.warranty_claim || "No",
    Status: row.status || "Completed",
    NextServiceDate: formatDate(row.next_service_date),
    NextServiceHours: row.next_service_hours ?? "",
    Remarks: row.remarks || "",
  };
}

function compareValues(left, right, numeric = false) {
  if (numeric) return Number(left ?? 0) - Number(right ?? 0);
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function Maintenance() {
  const [records, setRecords] = useState([]);
  const [engines, setEngines] = useState([]);
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState("service_date");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionRecord, setActionRecord] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [maintenanceResponse, enginesResponse] = await Promise.all([
        api.get("/maintenance"),
        api.get("/engines"),
      ]);

      if (!Array.isArray(maintenanceResponse.data)) {
        throw new Error("Unexpected maintenance response");
      }

      if (!Array.isArray(enginesResponse.data)) {
        throw new Error("Unexpected engines response");
      }

      setRecords(maintenanceResponse.data);
      setEngines(enginesResponse.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to load maintenance data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setPage(0); }, [search, rowsPerPage]);

  const engineById = useMemo(() => {
    const map = new Map();
    engines.forEach((engine) => map.set(engine.engine_id, engine));
    return map;
  }, [engines]);

  const enrichedRecords = useMemo(
    () => records.map((record) => {
      const engine = engineById.get(record.engine_id);
      return {
        ...record,
        engine_name:
          [record.brand, record.model].filter(Boolean).join(" ") ||
          [engine?.brand, engine?.model].filter(Boolean).join(" ") ||
          record.engine_id ||
          "",
        vessel_name: record.boat_name || engine?.boat_name || "",
        customer_name: record.company || engine?.company || "",
        serial_value:
          record.serial_number ||
          engine?.serial_number ||
          record.engine_id ||
          "",
        total_cost:
          Number(record.labor_cost || 0) +
          Number(record.parts_cost || 0),
      };
    }),
    [records, engineById]
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enrichedRecords;

    return enrichedRecords.filter((record) =>
      [
        record.maintenance_id, record.engine_id, record.engine_name,
        record.serial_value, record.vessel_name, record.customer_name,
        record.service_type, record.technician, record.status,
        record.warranty_claim, record.parts_replaced, record.remarks,
        formatDate(record.service_date)
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [enrichedRecords, search]);

  const sortedRecords = useMemo(() => {
    const selected = sortableColumns.find((column) => column.id === orderBy);
    return [...filteredRecords].sort((left, right) => {
      const comparison = compareValues(
        left[orderBy],
        right[orderBy],
        selected?.numeric
      );
      return order === "asc" ? comparison : -comparison;
    });
  }, [filteredRecords, order, orderBy]);

  const visibleRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedRecords.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedRecords]);

  function handleSort(columnId) {
    const isAscending = orderBy === columnId && order === "asc";
    setOrder(isAscending ? "desc" : "asc");
    setOrderBy(columnId);
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEditDialog(record) {
    setEditingId(record.maintenance_id);
    setForm(mapRowToForm(record));
    setError("");
    setFormOpen(true);
  }

  function closeFormDialog() {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validateForm() {
    if (!form.EngineID.trim()) return "Engine is required";
    if (!form.ServiceDate) return "Service date is required";

    const nonNegativeFields = [
      ["EngineHours", "Engine hours"],
      ["LaborHours", "Labor hours"],
      ["LaborCost", "Labor cost"],
      ["PartsCost", "Parts cost"],
      ["DowntimeHours", "Downtime hours"],
      ["NextServiceHours", "Next service hours"],
    ];

    for (const [field, label] of nonNegativeFields) {
      if (form[field] !== "" && Number(form[field]) < 0) {
        return `${label} cannot be negative`;
      }
    }

    if (
      form.NextServiceHours !== "" &&
      form.EngineHours !== "" &&
      Number(form.NextServiceHours) < Number(form.EngineHours)
    ) {
      return "Next service hours cannot be below current engine hours";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      ...form,
      EngineHours: numberOrNull(form.EngineHours),
      LaborHours: numberOrNull(form.LaborHours),
      LaborCost: numberOrNull(form.LaborCost),
      PartsCost: numberOrNull(form.PartsCost),
      DowntimeHours: numberOrNull(form.DowntimeHours),
      NextServiceHours: numberOrNull(form.NextServiceHours),
      NextServiceDate: form.NextServiceDate || null,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingId) {
        await api.put(
          `/maintenance/${encodeURIComponent(editingId)}`,
          payload
        );
        setSuccess("Maintenance record updated successfully");
      } else {
        const response = await api.post(
          "/maintenance",
          payload
        );
        const generatedId =
          response.data?.maintenance?.maintenance_id;

        setSuccess(
          generatedId
            ? `Maintenance ${generatedId} created successfully`
            : "Maintenance record created successfully"
        );
      }

      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save maintenance record"
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setError("");
      setSuccess("");
      await api.delete(
        `/maintenance/${encodeURIComponent(deleteTarget.maintenance_id)}`
      );
      setSuccess("Maintenance record deleted successfully");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to delete maintenance record"
      );
    } finally {
      setDeleting(false);
    }
  }

  function openActionMenu(event, record) {
    setActionAnchor(event.currentTarget);
    setActionRecord(record);
  }

  function closeActionMenu() {
    setActionAnchor(null);
    setActionRecord(null);
  }

  function handleEditFromMenu() {
    if (actionRecord) openEditDialog(actionRecord);
    closeActionMenu();
  }

  function handleDeleteFromMenu() {
    if (actionRecord) setDeleteTarget(actionRecord);
    closeActionMenu();
  }

  return (
    <Box>
      <Stack sx={{
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: { xs: "stretch", sm: "center" },
        gap: 2,
        mb: 3,
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Maintenance
          </Typography>
          <Typography color="text.secondary">
            Record service work, costs, downtime, and the next service due.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Add maintenance
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack sx={{
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          gap: 2,
        }}>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search service, engine, vessel, customer, technician..."
            fullWidth
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={loadData} disabled={loading} color="primary">
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1.25 }}
        >
          Showing {filteredRecords.length} of {records.length} records
        </Typography>
      </Paper>

      <Paper>
        <TableContainer>
          {loading ? (
            <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  {sortableColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.numeric ? "right" : "left"}
                      sx={{
                        display:
                          column.id === "status"
                            ? { xs: "none", sm: "table-cell" }
                            : column.id === "engine_hours"
                              ? { xs: "none", md: "table-cell" }
                              : "table-cell",
                      }}
                    >
                      <TableSortLabel
                        active={orderBy === column.id}
                        direction={orderBy === column.id ? order : "asc"}
                        onClick={() => handleSort(column.id)}
                      >
                        {column.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}

                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    Vessel / Customer
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                    Service
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                    Technician
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleRecords.map((record) => (
                  <TableRow key={record.maintenance_id} hover>
                    <TableCell>{record.maintenance_id}</TableCell>
                    <TableCell>{formatDate(record.service_date) || "—"}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {record.engine_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {record.serial_value}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      <Chip
                        size="small"
                        label={record.status || "Open"}
                        color={statusColor(record.status)}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ display: { xs: "none", md: "table-cell" } }}
                    >
                      {record.engine_hours ?? "—"}
                    </TableCell>
                    <TableCell align="right">
                      {currency(record.total_cost)}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Typography variant="body2">
                        {record.vessel_name || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {record.customer_name || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                      {record.service_type || "—"}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                      {record.technician || "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Maintenance actions">
                        <IconButton
                          size="small"
                          onClick={(event) => openActionMenu(event, record)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {!visibleRecords.length && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                      No maintenance records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {!loading && (
          <TablePagination
            component="div"
            count={sortedRecords.length}
            page={page}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        )}
      </Paper>

      <Menu
        anchorEl={actionAnchor}
        open={Boolean(actionAnchor)}
        onClose={closeActionMenu}
      >
        <MenuItem onClick={handleEditFromMenu}>
          <EditIcon fontSize="small" sx={{ mr: 1.25 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteFromMenu} sx={{ color: "error.main" }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.25 }} />
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={formOpen} onClose={closeFormDialog} fullWidth maxWidth="md">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>
            {editingId ? "Edit maintenance record" : "Add maintenance record"}
          </DialogTitle>

          <DialogContent dividers>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              pt: 1,
            }}>

              <TextField
                select
                label="Engine"
                name="EngineID"
                value={form.EngineID}
                onChange={handleChange}
                required
              >
                {engines.map((engine) => (
                  <MenuItem key={engine.engine_id} value={engine.engine_id}>
                    {[engine.brand, engine.model].filter(Boolean).join(" ") ||
                      engine.engine_id}
                    {" — "}
                    {engine.engine_id}
                    {engine.boat_name ? ` — ${engine.boat_name}` : ""}
                    {engine.company ? ` — ${engine.company}` : ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Service date"
                name="ServiceDate"
                type="date"
                value={form.ServiceDate}
                onChange={handleChange}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />

              {[
                ["EngineHours", "Engine hours"],
                ["LaborHours", "Labor hours"],
                ["LaborCost", "Labor cost"],
                ["PartsCost", "Parts cost"],
                ["DowntimeHours", "Downtime hours"],
                ["NextServiceHours", "Next service hours"],
              ].map(([name, label]) => (
                <TextField
                  key={name}
                  label={label}
                  name={name}
                  type="number"
                  value={form[name]}
                  onChange={handleChange}
                  slotProps={{ htmlInput: { min: 0, step: "any" } }}
                />
              ))}

              <TextField
                select
                label="Service type"
                name="ServiceType"
                value={form.ServiceType}
                onChange={handleChange}
              >
                <MenuItem value=""><em>Select service type</em></MenuItem>
                {serviceTypes.map((serviceType) => (
                  <MenuItem key={serviceType} value={serviceType}>
                    {serviceType}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Technician"
                name="Technician"
                value={form.Technician}
                onChange={handleChange}
              />

              <TextField
                select
                label="Warranty claim"
                name="WarrantyClaim"
                value={form.WarrantyClaim}
                onChange={handleChange}
              >
                {warrantyOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Status"
                name="Status"
                value={form.Status}
                onChange={handleChange}
              >
                {statuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Next service date"
                name="NextServiceDate"
                type="date"
                value={form.NextServiceDate}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Parts replaced"
                name="PartsReplaced"
                value={form.PartsReplaced}
                onChange={handleChange}
                multiline
                minRows={3}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />

              <TextField
                label="Remarks"
                name="Remarks"
                value={form.Remarks}
                onChange={handleChange}
                multiline
                minRows={3}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={closeFormDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Update maintenance"
                  : "Create maintenance"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete maintenance record"
        message={
          deleteTarget
            ? `Delete maintenance record ${deleteTarget.maintenance_id}? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
