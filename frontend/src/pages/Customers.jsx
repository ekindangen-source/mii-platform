import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputAdornment, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  CustomerID: "", Company: "", Industry: "", ContactPerson: "",
  Position: "", Province: "", HomePort: "", FleetSize: "",
  AnnualOperatingHours: "", DecisionMaker: "", CurrentSupplier: "",
  Email: "", Telephone: "", Address: "", Notes: ""
};

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
    Notes: row.notes || ""
  };
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/customers");
      if (!Array.isArray(response.data)) throw new Error("Unexpected customers response");
      setCustomers(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCustomers(); }, []);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) =>
      [
        customer.customer_id, customer.company, customer.contact_person,
        customer.email, customer.telephone, customer.province, customer.industry
      ].some((value) => String(value ?? "").toLowerCase().includes(q))
    );
  }, [customers, search]);

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
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.CustomerID.trim()) return setError("Customer ID is required");
    if (!form.Company.trim()) return setError("Company is required");

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = {
        ...form,
        FleetSize: form.FleetSize === "" ? null : Number(form.FleetSize),
        AnnualOperatingHours: form.AnnualOperatingHours === "" ? null : Number(form.AnnualOperatingHours)
      };

      if (editingId) {
        await api.put(`/customers/${encodeURIComponent(editingId)}`, payload);
        setSuccess("Customer updated successfully");
      } else {
        await api.post("/customers", payload);
        setSuccess("Customer created successfully");
      }

      closeFormDialog();
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save customer");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setError("");
      await api.delete(`/customers/${encodeURIComponent(deleteTarget.customer_id)}`);
      setSuccess("Customer deleted successfully");
      setDeleteTarget(null);
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to delete customer");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Customers</Typography>
          <Typography color="text.secondary">Manage customer companies, contacts, and fleet information.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>Add customer</Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, email, telephone..."
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <Tooltip title="Refresh">
            <span><IconButton onClick={loadCustomers} disabled={loading} color="primary"><RefreshIcon /></IconButton></span>
          </Tooltip>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer ID</TableCell><TableCell>Company</TableCell>
                <TableCell>Contact</TableCell><TableCell>Telephone</TableCell>
                <TableCell>Email</TableCell><TableCell>Province</TableCell>
                <TableCell align="right">Fleet</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.customer_id} hover>
                  <TableCell>{customer.customer_id}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{customer.company}</Typography>
                    <Typography variant="caption" color="text.secondary">{customer.industry || "—"}</Typography>
                  </TableCell>
                  <TableCell>{customer.contact_person || "—"}</TableCell>
                  <TableCell>{customer.telephone || "—"}</TableCell>
                  <TableCell>{customer.email || "—"}</TableCell>
                  <TableCell>{customer.province || "—"}</TableCell>
                  <TableCell align="right">{customer.fleet_size ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit"><IconButton onClick={() => openEditDialog(customer)} color="primary"><EditIcon /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton onClick={() => setDeleteTarget(customer)} color="error"><DeleteIcon /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredCustomers.length && <TableRow><TableCell colSpan={8} align="center">No customers found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <Dialog open={formOpen} onClose={closeFormDialog} fullWidth maxWidth="md">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
              {[
                ["CustomerID","Customer ID","text"],["Company","Company","text"],["Industry","Industry","text"],
                ["ContactPerson","Contact person","text"],["Position","Position","text"],["Province","Province","text"],
                ["HomePort","Home port","text"],["FleetSize","Fleet size","number"],
                ["AnnualOperatingHours","Annual operating hours","number"],["DecisionMaker","Decision maker","text"],
                ["CurrentSupplier","Current supplier","text"],["Email","Email","email"],["Telephone","Telephone","text"]
              ].map(([name,label,type]) => (
                <TextField key={name} label={label} name={name} type={type} value={form[name]}
                  onChange={handleChange} required={name==="CustomerID" || name==="Company"}
                  disabled={name==="CustomerID" && Boolean(editingId)} />
              ))}
              <TextField label="Address" name="Address" value={form.Address} onChange={handleChange}
                multiline minRows={3} sx={{ gridColumn: { sm: "1 / -1" } }} />
              <TextField label="Notes" name="Notes" value={form.Notes} onChange={handleChange}
                multiline minRows={3} sx={{ gridColumn: { sm: "1 / -1" } }} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeFormDialog} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update customer" : "Create customer"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete customer"
        message={deleteTarget ? `Delete ${deleteTarget.company} (${deleteTarget.customer_id})? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
