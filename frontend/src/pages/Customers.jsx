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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  CustomerID: "",
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
};

const sortableColumns = [
  { id: "customer_id", label: "Customer ID" },
  { id: "company", label: "Company" },
  { id: "contact_person", label: "Contact" },
  { id: "province", label: "Province" },
  { id: "fleet_size", label: "Fleet", numeric: true },
];

function mapRowToForm(row) {
  return {
    CustomerID: row.customer_id || "",
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
  };
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
  const [customers, setCustomers] = useState([]);
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

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionCustomer, setActionCustomer] = useState(null);

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

  useEffect(() => {
    loadCustomers();
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
        customer.contact_person,
        customer.email,
        customer.telephone,
        customer.province,
        customer.industry,
        customer.home_port,
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
    setForm(emptyForm);
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

    if (!form.CustomerID.trim()) {
      setError("Customer ID is required");
      return;
    }

    if (!form.Company.trim()) {
      setError("Company is required");
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
        await api.post("/customers", payload);
        setSuccess("Customer created successfully");
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
    setActionAnchor(event.currentTarget);
    setActionCustomer(customer);
  }

  function closeActionMenu() {
    setActionAnchor(null);
    setActionCustomer(null);
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
            Manage customer companies, contacts, and fleet
            information.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Add customer
        </Button>
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
            <Table size="small">
              <TableHead>
                <TableRow>
                  {sortableColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.numeric ? "right" : "left"}
                      sx={{
                        display:
                          column.id === "contact_person"
                            ? {
                                xs: "none",
                                md: "table-cell",
                              }
                            : column.id === "province"
                              ? {
                                  xs: "none",
                                  sm: "table-cell",
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

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        lg: "table-cell",
                      },
                    }}
                  >
                    Telephone
                  </TableCell>

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        lg: "table-cell",
                      },
                    }}
                  >
                    Email
                  </TableCell>

                  <TableCell align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleCustomers.map((customer) => (
                  <TableRow
                    key={customer.customer_id}
                    hover
                  >
                    <TableCell>
                      {customer.customer_id}
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {customer.company}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {customer.industry || "—"}
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
                      {customer.contact_person || "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          sm: "table-cell",
                        },
                      }}
                    >
                      {customer.province || "—"}
                    </TableCell>

                    <TableCell align="right">
                      {customer.fleet_size ?? "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          lg: "table-cell",
                        },
                      }}
                    >
                      {customer.telephone || "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          lg: "table-cell",
                        },
                      }}
                    >
                      {customer.email || "—"}
                    </TableCell>

                    <TableCell align="right">
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
                      colSpan={8}
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
        <MenuItem onClick={handleEditFromMenu}>
          <EditIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Edit
        </MenuItem>

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
      </Menu>

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
              {[
                ["CustomerID", "Customer ID", "text"],
                ["Company", "Company", "text"],
                ["Industry", "Industry", "text"],
                [
                  "ContactPerson",
                  "Contact person",
                  "text",
                ],
                ["Position", "Position", "text"],
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
                ["Email", "Email", "email"],
                ["Telephone", "Telephone", "text"],
              ].map(([name, label, type]) => (
                <TextField
                  key={name}
                  label={label}
                  name={name}
                  type={type}
                  value={form[name]}
                  onChange={handleChange}
                  required={
                    name === "CustomerID" ||
                    name === "Company"
                  }
                  disabled={
                    name === "CustomerID" &&
                    Boolean(editingId)
                  }
                />
              ))}

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
