import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import HistoryIcon from "@mui/icons-material/History";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import api from "../services/api";
import useMasterData from "../hooks/useMasterData";
import ConfirmDialog from "../components/ConfirmDialog";
import CustomerContactsDialog from "../components/CustomerContactsDialog";
import CustomerInteractionsDialog from "../components/CustomerInteractionsDialog";
import CustomerScheduleDialog from "../components/CustomerScheduleDialog";
import RecordDetailsDialog from "../components/RecordDetailsDialog";
import { useAuth } from "../context/AuthContext";
import {
  canDeleteModule,
  canWriteModule,
} from "../utils/permissions";
import {
  primaryCellSx,
  responsiveTableSx,
  stickyActionCellSx,
  stickyActionHeaderSx,
  truncateTextSx,
} from "../utils/responsiveTable";

const emptyForm = {
  AccountType: "organization",
  Source: "",
  Company: "",
  Industry: "",
  ContactPerson: "",
  Position: "",
  Province: "",
  HomePort: "",
  FleetSize: "",
  AnnualOperatingHours: "",
  DecisionMaker: "",
  CurrentSupplier: "",
  Email: "",
  Telephone: "",
  Address: "",
  Notes: "",
  InitialPICName: "",
  InitialPICTitle: "",
  InitialPICPhone: "",
  AssignedTo: "",
};

const sortableColumns = [
  { id: "company", label: "Customer" },
  { id: "primary_contact_name", label: "Primary PIC" },
  { id: "assigned_to_name", label: "Salesperson" },
  { id: "province", label: "Province" },
];

function mapRowToForm(row) {
  return {
    AccountType:
      row.account_type || "organization",
    Source: row.lead_source || "",
    Company: row.company || "",
    Industry: row.industry || "",
    ContactPerson: row.contact_person || "",
    Position: row.position || "",
    Province: row.province || "",
    HomePort: row.home_port || "",
    FleetSize: row.fleet_size ?? "",
    AnnualOperatingHours: row.annual_operating_hours ?? "",
    DecisionMaker: row.decision_maker || "",
    CurrentSupplier: row.current_supplier || "",
    Email: row.email || "",
    Telephone: row.telephone || "",
    Address: row.address || "",
    Notes: row.notes || "",
    InitialPICName: "",
    InitialPICTitle: "",
    InitialPICPhone: "",
    AssignedTo: row.assigned_to || "",
  };
}

function formatAssignmentTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function compareValues(left, right, numeric = false) {
  if (numeric) {
    return Number(left ?? 0) - Number(right ?? 0);
  }

  return String(left ?? "").localeCompare(
    String(right ?? ""),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    }
  );
}

export default function Customers() {
  const { valuesByCategory } = useMasterData([
    "customer_source",
  ]);

  const { user } = useAuth();
  const canWrite = canWriteModule(
    user?.role,
    "customers"
  );
  const canDelete = canDeleteModule(
    user?.role,
    "customers"
  );
  const canAssign = ["admin", "manager"].includes(user?.role);

  const [customers, setCustomers] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState("company");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const customerSources = [
    ...new Set(
      [
        ...(valuesByCategory.customer_source || []),
        form.Source,
      ].filter(Boolean)
    ),
  ];

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionCustomer, setActionCustomer] = useState(null);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [contactsCustomer, setContactsCustomer] = useState(null);
  const [interactionsCustomer, setInteractionsCustomer] =
    useState(null);
  const [scheduleCustomer, setScheduleCustomer] = useState(null);
  const [assignmentTarget, setAssignmentTarget] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({
    AssignedTo: "",
    Reason: "",
  });
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/customers");

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected customers response");
      }

      setCustomers(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load customers"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignees() {
    try {
      const response = await api.get("/customers/assignees");
      setAssignees(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load customer assignees"
      );
    }
  }

  useEffect(() => {
    loadCustomers();
    loadAssignees();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, rowsPerPage]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        customer.customer_id,
        customer.company,
        customer.primary_contact_name,
        customer.primary_contact_email,
        customer.primary_contact_telephone,
        customer.contact_person,
        customer.email,
        customer.telephone,
        customer.province,
        customer.industry,
        customer.home_port,
        customer.lead_source,
        customer.assigned_to_name,
        customer.assigned_to_email,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [customers, search]);

  const sortedCustomers = useMemo(() => {
    const selectedColumn = sortableColumns.find(
      (column) => column.id === orderBy
    );

    return [...filteredCustomers].sort((left, right) => {
      const comparison = compareValues(
        left[orderBy],
        right[orderBy],
        selectedColumn?.numeric
      );

      return order === "asc" ? comparison : -comparison;
    });
  }, [filteredCustomers, order, orderBy]);

  const visibleCustomers = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedCustomers.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedCustomers]);

  function handleSort(columnId) {
    const isAscending =
      orderBy === columnId && order === "asc";

    setOrder(isAscending ? "desc" : "asc");
    setOrderBy(columnId);
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      AssignedTo: user?.userId || "",
    });
    setFormOpen(true);
  }

  function openEditDialog(customer) {
    setEditingId(customer.customer_id);
    setForm(mapRowToForm(customer));
    setFormOpen(true);
  }

  function closeFormDialog() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.Company.trim()) {
      setError("Company is required");
      return;
    }

    if (!editingId && !form.InitialPICName.trim()) {
      setError("Initial PIC name is required");
      return;
    }

    if (!editingId && !form.InitialPICPhone.trim()) {
      setError("Initial PIC phone number is required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...form,
        FleetSize:
          form.FleetSize === ""
            ? null
            : Number(form.FleetSize),
        AnnualOperatingHours:
          form.AnnualOperatingHours === ""
            ? null
            : Number(form.AnnualOperatingHours),
      };

      if (editingId) {
        await api.put(
          `/customers/${encodeURIComponent(editingId)}`,
          payload
        );
        setSuccess("Customer updated successfully");
      } else {
        const response = await api.post("/customers", payload);
        const generatedId =
          response.data?.customer?.customer_id;

        setSuccess(
          generatedId
            ? `Customer ${generatedId} created successfully`
            : "Customer created successfully"
        );
      }

      closeFormDialog();
      await loadCustomers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save customer"
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/customers/${encodeURIComponent(
          deleteTarget.customer_id
        )}`
      );

      setSuccess("Customer deleted successfully");
      setDeleteTarget(null);
      await loadCustomers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to delete customer"
      );
    } finally {
      setDeleting(false);
    }
  }

  function openActionMenu(event, customer) {
    event.stopPropagation();
    setActionAnchor(event.currentTarget);
    setActionCustomer(customer);
  }

  function closeActionMenu() {
    setActionAnchor(null);
    setActionCustomer(null);
  }

  function handleInteractionsFromMenu() {
    const customer = actionCustomer;
    closeActionMenu();

    if (customer) {
      setSelectedCustomer(null);
      setInteractionsCustomer(customer);
    }
  }

  function handleScheduleFromMenu() {
    const customer = actionCustomer;
    closeActionMenu();

    if (customer) {
      setSelectedCustomer(null);
      setScheduleCustomer(customer);
    }
  }

  function handleContactsFromMenu() {
    const customer = actionCustomer;
    closeActionMenu();

    if (customer) {
      setSelectedCustomer(null);
      setContactsCustomer(customer);
    }
  }

  function handleEditFromMenu() {
    if (actionCustomer) {
      openEditDialog(actionCustomer);
    }

    closeActionMenu();
  }

  function handleDeleteFromMenu() {
    if (actionCustomer) {
      setDeleteTarget(actionCustomer);
    }

    closeActionMenu();
  }

  function handleAssignFromMenu() {
    const customer = actionCustomer;
    closeActionMenu();

    if (customer) {
      setAssignmentTarget(customer);
      setAssignmentForm({
        AssignedTo: customer.assigned_to || "",
        Reason: "",
      });
    }
  }

  async function handleHistoryFromMenu() {
    const customer = actionCustomer;
    closeActionMenu();
    if (!customer) return;

    setHistoryCustomer(customer);
    setHistoryLoading(true);
    setAssignmentHistory([]);

    try {
      const response = await api.get(
        `/customers/${encodeURIComponent(customer.customer_id)}/assignment-history`
      );
      setAssignmentHistory(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load assignment history"
      );
      setHistoryCustomer(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveAssignment(event) {
    event.preventDefault();
    if (!assignmentTarget) return;

    try {
      setAssignmentSaving(true);
      setError("");
      await api.patch(
        `/customers/${encodeURIComponent(assignmentTarget.customer_id)}/assignment`,
        assignmentForm
      );
      setSuccess("Customer salesperson updated successfully");
      setAssignmentTarget(null);
      await loadCustomers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update customer salesperson"
      );
    } finally {
      setAssignmentSaving(false);
    }
  }

  function editSelectedCustomer() {
    if (!selectedCustomer) {
      return;
    }

    const customer = selectedCustomer;
    setSelectedCustomer(null);
    openEditDialog(customer);
  }

  function deleteSelectedCustomer() {
    if (!selectedCustomer) {
      return;
    }

    setDeleteTarget(selectedCustomer);
    setSelectedCustomer(null);
  }

  const customerDetailSections = selectedCustomer
    ? [
        {
          title: "Customer",
          fields: [
            {
              label: "Customer ID",
              value: selectedCustomer.customer_id,
              emphasize: true,
            },
            {
              label: "Company",
              value: selectedCustomer.company,
              emphasize: true,
            },
            {
              label: "Account type",
              value:
                selectedCustomer.account_type ===
                "individual"
                  ? "Individual"
                  : "Organization",
            },
            {
              label: "Source",
              value: selectedCustomer.lead_source,
            },
            {
              label: "Industry",
              value: selectedCustomer.industry,
            },
            {
              label: "Assigned salesperson",
              value:
                selectedCustomer.assigned_to_name ||
                "Unassigned",
            },
          ],
        },
        {
          title: "Primary contact",
          fields: [
            {
              label: "Contact person",
              value:
                selectedCustomer.primary_contact_name ||
                selectedCustomer.contact_person,
            },
            {
              label: "Position",
              value:
                selectedCustomer.primary_contact_job_title ||
                selectedCustomer.position,
            },
            {
              label: "Email",
              value:
                selectedCustomer.primary_contact_email ||
                selectedCustomer.email,
            },
            {
              label: "Telephone",
              value:
                selectedCustomer.primary_contact_telephone ||
                selectedCustomer.telephone,
            },
            {
              label: "Active contacts",
              value:
                selectedCustomer.active_contact_count,
              type: "number",
            },
          ],
        },
        {
          title: "Location and fleet",
          fields: [
            {
              label: "Province",
              value: selectedCustomer.province,
            },
            {
              label: "Home port",
              value: selectedCustomer.home_port,
            },
            {
              label: "Fleet size",
              value: selectedCustomer.fleet_size,
              type: "number",
            },
            {
              label: "Annual operating hours",
              value:
                selectedCustomer.annual_operating_hours,
              type: "number",
              suffix: "h",
            },
            {
              label: "Address",
              value: selectedCustomer.address,
              fullWidth: true,
              multiline: true,
            },
          ],
        },
        {
          title: "Commercial",
          fields: [
            {
              label: "Decision maker",
              value: selectedCustomer.decision_maker,
            },
            {
              label: "Current supplier",
              value: selectedCustomer.current_supplier,
            },
            {
              label: "Notes",
              value: selectedCustomer.notes,
              fullWidth: true,
              multiline: true,
            },
          ],
        },
        {
          title: "System",
          fields: [
            {
              label: "Created by",
              value: selectedCustomer.created_by_name,
            },
            {
              label: "Created",
              value: selectedCustomer.created_at,
              type: "dateTime",
            },
            {
              label: "Last updated",
              value: selectedCustomer.updated_at,
              type: "dateTime",
            },
          ],
        },
      ]
    : [];

  return (
    <Box>
      <Stack
        sx={{
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          justifyContent: "space-between",
          alignItems: {
            xs: "stretch",
            sm: "center",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700 }}
          >
            Customers
          </Typography>

          <Typography color="text.secondary">
            Manage customer accounts, PICs, and fleet
            information.
          </Typography>
        </Box>

        {canWrite && (
          <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={openCreateDialog}
                  >
                    Add customer
                  </Button>
        )}
      </Stack>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError("")}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          onClose={() => setSuccess("")}
          sx={{ mb: 2 }}
        >
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          sx={{
            flexDirection: {
              xs: "column",
              sm: "row",
            },
            alignItems: {
              xs: "stretch",
              sm: "center",
            },
            gap: 2,
          }}
        >
          <TextField
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search company, contact, email, telephone..."
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
              <IconButton
                onClick={loadCustomers}
                disabled={loading}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            mt: 1.25,
          }}
        >
          Showing {filteredCustomers.length} of{" "}
          {customers.length} customers
        </Typography>
      </Paper>

      <Paper>
        <TableContainer>
          {loading ? (
            <Box
              sx={{
                minHeight: 260,
                display: "grid",
                placeItems: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <Table size="small" sx={responsiveTableSx}>
              <TableHead>
                <TableRow>
                  {sortableColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.numeric ? "right" : "left"}
                      sx={{
                        display:
                          column.id === "primary_contact_name"
                            ? {
                                xs: "none",
                                md: "table-cell",
                              }
                            : column.id === "assigned_to_name"
                              ? "table-cell"
                            : column.id === "province"
                              ? {
                                  xs: "none",
                                  lg: "table-cell",
                                }
                              : "table-cell",
                      }}
                    >
                      <TableSortLabel
                        active={orderBy === column.id}
                        direction={
                          orderBy === column.id
                            ? order
                            : "asc"
                        }
                        onClick={() =>
                          handleSort(column.id)
                        }
                      >
                        {column.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}

                  <TableCell align="right" sx={stickyActionHeaderSx}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleCustomers.map((customer) => (
                  <TableRow
                    key={customer.customer_id}
                    hover
                    tabIndex={0}
                    onClick={() =>
                      setSelectedCustomer(customer)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        setSelectedCustomer(customer)
                      }
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={primaryCellSx}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, ...truncateTextSx }}
                      >
                        {customer.company}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={truncateTextSx}
                      >
                        {[customer.customer_id, customer.industry]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </Typography>
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          md: "table-cell",
                        },
                      }}
                    >
                      <Typography variant="body2" sx={truncateTextSx}>
                        {customer.primary_contact_name || customer.contact_person || "-"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={truncateTextSx}>
                        {customer.primary_contact_telephone || customer.telephone || "-"}
                      </Typography>
                    </TableCell>

                    <TableCell
                      sx={{
                        ...primaryCellSx,
                      }}
                    >
                      <Typography variant="body2" sx={truncateTextSx}>
                        {customer.assigned_to_name || "Unassigned"}
                      </Typography>
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          lg: "table-cell",
                        },
                        ...primaryCellSx,
                      }}
                    >
                      <Typography variant="body2" sx={truncateTextSx}>
                        {customer.province || "-"}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={stickyActionCellSx}>
                      <Tooltip title="Customer actions">
                        <IconButton
                          size="small"
                          onClick={(event) =>
                            openActionMenu(event, customer)
                          }
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {!visibleCustomers.length && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      No customers found.
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
            count={sortedCustomers.length}
            page={page}
            onPageChange={(_event, nextPage) =>
              setPage(nextPage)
            }
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(
                Number(event.target.value)
              );
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
        <MenuItem onClick={handleInteractionsFromMenu}>
          <HistoryIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Log unscheduled interaction
        </MenuItem>
        <MenuItem onClick={handleScheduleFromMenu}>
          <EventAvailableIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Schedule meeting / visit
        </MenuItem>
        <MenuItem onClick={handleContactsFromMenu}>
          <PeopleAltIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Contacts / PICs
        </MenuItem>

        <MenuItem onClick={handleHistoryFromMenu}>
          <HistoryIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Assignment history
        </MenuItem>

        {canAssign && (
          <MenuItem onClick={handleAssignFromMenu}>
            <AssignmentIndIcon
              fontSize="small"
              sx={{ mr: 1.25 }}
            />
            Assign salesperson
          </MenuItem>
        )}

        {canWrite && (
          <MenuItem onClick={handleEditFromMenu}>
            <EditIcon
              fontSize="small"
              sx={{ mr: 1.25 }}
            />
            Edit
          </MenuItem>
        )}

        {canDelete && (
          <MenuItem
            onClick={handleDeleteFromMenu}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon
              fontSize="small"
              sx={{ mr: 1.25 }}
            />
            Delete
          </MenuItem>
        )}
      </Menu>

      <RecordDetailsDialog
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={
          selectedCustomer?.company ||
          "Customer details"
        }
        subtitle={selectedCustomer?.customer_id}
        sections={customerDetailSections}
        canEdit={canWrite}
        canDelete={canDelete}
        onEdit={editSelectedCustomer}
        onDelete={deleteSelectedCustomer}
      />

      <CustomerInteractionsDialog
        open={Boolean(interactionsCustomer)}
        customer={interactionsCustomer}
        canWrite={canWrite}
        canDelete={canDelete}
        onClose={() => setInteractionsCustomer(null)}
      />
      <CustomerScheduleDialog
        open={Boolean(scheduleCustomer)}
        customer={scheduleCustomer}
        canWrite={canWrite}
        canDelete={canDelete}
        onClose={() => setScheduleCustomer(null)}
      />
      <CustomerContactsDialog
        open={Boolean(contactsCustomer)}
        customer={contactsCustomer}
        canWrite={canWrite}
        onClose={() => setContactsCustomer(null)}
        onChanged={loadCustomers}
      />

      <Dialog
        open={formOpen}
        onClose={closeFormDialog}
        fullWidth
        maxWidth="md"
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
        >
          <DialogTitle>
            {editingId
              ? "Edit customer"
              : "Add customer"}
          </DialogTitle>

          <DialogContent dividers>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "1fr 1fr",
                },
                gap: 2,
                pt: 1,
              }}
            >
              <TextField
                select
                label="Account type"
                name="AccountType"
                value={form.AccountType}
                onChange={handleChange}
                required
              >
                <MenuItem value="organization">
                  Organization
                </MenuItem>
                <MenuItem value="individual">
                  Individual
                </MenuItem>
              </TextField>

              <TextField
                select
                label="Source"
                name="Source"
                value={form.Source}
                onChange={handleChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>

                {customerSources.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </TextField>

              {!editingId && canAssign && (
                <TextField
                  select
                  label="Assigned salesperson"
                  name="AssignedTo"
                  value={form.AssignedTo}
                  onChange={handleChange}
                  required
                >
                  {assignees.map((assignee) => (
                    <MenuItem
                      key={assignee.user_id}
                      value={assignee.user_id}
                    >
                      {assignee.full_name} ({assignee.user_id})
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {[
                ["Company", "Company", "text"],
                ["Industry", "Industry", "text"],
                ["Province", "Province", "text"],
                ["HomePort", "Home port", "text"],
                ["FleetSize", "Fleet size", "number"],
                [
                  "AnnualOperatingHours",
                  "Annual operating hours",
                  "number",
                ],
                [
                  "DecisionMaker",
                  "Decision maker",
                  "text",
                ],
                [
                  "CurrentSupplier",
                  "Current supplier",
                  "text",
                ],
              ].map(([name, label, type]) => (
                <TextField
                  key={name}
                  label={label}
                  name={name}
                  type={type}
                  value={form[name]}
                  onChange={handleChange}
                  required={name === "Company"}
                />
              ))}

              {!editingId && (
                <>
                  <Typography
                    variant="subtitle1"
                    fontWeight={800}
                    sx={{ gridColumn: { sm: "1 / -1" }, mt: 1 }}
                  >
                    Initial primary PIC
                  </Typography>

                  <TextField
                    label="PIC name"
                    name="InitialPICName"
                    value={form.InitialPICName}
                    onChange={handleChange}
                    required
                  />

                  <TextField
                    label="Title / position"
                    name="InitialPICTitle"
                    value={form.InitialPICTitle}
                    onChange={handleChange}
                  />

                  <TextField
                    label="Phone number"
                    name="InitialPICPhone"
                    value={form.InitialPICPhone}
                    onChange={handleChange}
                    required
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ alignSelf: "center" }}
                  >
                    This PIC will be active and primary. Add future PICs from Contacts / PICs.
                  </Typography>
                </>
              )}

              <TextField
                label="Address"
                name="Address"
                value={form.Address}
                onChange={handleChange}
                multiline
                minRows={3}
                sx={{
                  gridColumn: {
                    sm: "1 / -1",
                  },
                }}
              />

              <TextField
                label="Notes"
                name="Notes"
                value={form.Notes}
                onChange={handleChange}
                multiline
                minRows={3}
                sx={{
                  gridColumn: {
                    sm: "1 / -1",
                  },
                }}
              />
            </Box>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={closeFormDialog}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update customer"
                  : "Create customer"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(assignmentTarget)}
        onClose={() => {
          if (!assignmentSaving) setAssignmentTarget(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={saveAssignment}>
          <DialogTitle>Assign salesperson</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {assignmentTarget?.company} ({assignmentTarget?.customer_id})
              </Typography>

              <TextField
                select
                label="Assigned salesperson"
                value={assignmentForm.AssignedTo}
                onChange={(event) =>
                  setAssignmentForm((current) => ({
                    ...current,
                    AssignedTo: event.target.value,
                  }))
                }
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {assignees.map((assignee) => (
                  <MenuItem
                    key={assignee.user_id}
                    value={assignee.user_id}
                  >
                    {assignee.full_name} ({assignee.user_id})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Reason for reassignment"
                value={assignmentForm.Reason}
                onChange={(event) =>
                  setAssignmentForm((current) => ({
                    ...current,
                    Reason: event.target.value,
                  }))
                }
                multiline
                minRows={2}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setAssignmentTarget(null)}
              disabled={assignmentSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={assignmentSaving}
            >
              {assignmentSaving ? "Saving..." : "Save assignment"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(historyCustomer)}
        onClose={() => setHistoryCustomer(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Customer assignment history</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {historyCustomer?.company} ({historyCustomer?.customer_id})
          </Typography>

          {historyLoading ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : assignmentHistory.length ? (
            <Stack spacing={1.5}>
              {assignmentHistory.map((entry) => (
                <Paper
                  key={entry.assignment_history_id}
                  variant="outlined"
                  sx={{ p: 1.5 }}
                >
                  <Typography fontWeight={700}>
                    {entry.previous_assigned_to_name || "Unassigned"}
                    {" -> "}
                    {entry.assigned_to_name || "Unassigned"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatAssignmentTime(entry.assigned_at)} by{" "}
                    {entry.changed_by_name || entry.changed_by || "System"}
                  </Typography>
                  {entry.reason && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {entry.reason}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">
              No assignment history is available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryCustomer(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete customer"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.company} (${deleteTarget.customer_id})? This action cannot be undone.`
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
