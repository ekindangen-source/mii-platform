import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import LeadDialog from "../components/LeadDialog";
import ConvertLeadDialog from "../components/ConvertLeadDialog";
import { LEAD_STATUSES, LEAD_STATUS_BY_VALUE } from "../utils/leads";
import { formatIdr } from "../utils/opportunities";
import { formatDateTimeDisplay } from "../utils/dateTime";

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]); const [owners, setOwners] = useState([]);
  const [status, setStatus] = useState("all"); const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [success, setSuccess] = useState(""); const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false); const [convertTarget, setConvertTarget] = useState(null);
  const canWrite = ["admin", "manager", "sales"].includes(user?.role);
  const canDelete = ["admin", "manager"].includes(user?.role);
  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const [leadRows, ownerRows] = await Promise.all([api.get("/leads"), api.get("/leads/owners")]); setLeads(Array.isArray(leadRows.data) ? leadRows.data : []); setOwners(Array.isArray(ownerRows.data) ? ownerRows.data : []); }
    catch (err) { setError(err.response?.data?.message || err.message || "Unable to load leads"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => leads.filter((lead) => {
    if (status !== "all" && lead.status !== status) return false;
    const term = search.trim().toLowerCase();
    return !term || [lead.name, lead.contact_name, lead.product_interest, lead.owner_name].some((value) => String(value || "").toLowerCase().includes(term));
  }), [leads, search, status]);
  async function remove(lead) {
    if (!window.confirm(`Delete ${lead.lead_id} - ${lead.name}?`)) return;
    try { await api.delete(`/leads/${encodeURIComponent(lead.lead_id)}`); setSuccess("Lead deleted"); load(); }
    catch (err) { setError(err.response?.data?.message || err.message || "Unable to delete lead"); }
  }
  return <Box><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}><Box><Typography variant="h4" fontWeight={800}>Leads</Typography><Typography color="text.secondary">Manage prospects before they become customers.</Typography></Box><Stack direction="row" gap={1}><Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>{canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>Add lead</Button>}</Stack></Stack>
    {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}{success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>{success}</Alert>}
    <Paper sx={{ p: 2, mb: 2 }}><Stack direction={{ xs: "column", md: "row" }} gap={2}><TextField fullWidth size="small" label="Search leads" value={search} onChange={(event) => setSearch(event.target.value)} /><TextField select size="small" label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 180 }}><MenuItem value="all">All statuses</MenuItem>{LEAD_STATUSES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField></Stack></Paper>
    <TableContainer component={Paper}>{loading ? <Box sx={{ py: 8, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : <Table size="small"><TableHead><TableRow><TableCell>Lead / PIC</TableCell><TableCell>Status</TableCell><TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Interest / Next action</TableCell><TableCell align="right">Value</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{filtered.map((lead) => <TableRow key={lead.lead_id} hover><TableCell><Typography variant="body2" fontWeight={800}>{lead.name}</Typography><Typography variant="caption" color="text.secondary">{lead.contact_name} · {lead.contact_phone} · {lead.lead_id}</Typography></TableCell><TableCell><Chip size="small" label={LEAD_STATUS_BY_VALUE[lead.status]?.label || lead.status} color={LEAD_STATUS_BY_VALUE[lead.status]?.color} /><Typography variant="caption" display="block" color="text.secondary">{lead.owner_name}</Typography></TableCell><TableCell sx={{ display: { xs: "none", md: "table-cell" } }}><Typography variant="body2">{lead.product_interest || "Not specified"}</Typography><Typography variant="caption" color="text.secondary">{lead.next_action ? `${lead.next_action} · ${formatDateTimeDisplay(lead.next_action_at)}` : "No next action"}</Typography></TableCell><TableCell align="right">{formatIdr(lead.estimated_value)}</TableCell><TableCell align="right">{canWrite && !["converted"].includes(lead.status) && <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(lead); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>}{canWrite && lead.status === "qualified" && <Tooltip title="Convert to customer"><IconButton size="small" color="primary" onClick={() => setConvertTarget(lead)}><PersonAddAltIcon fontSize="small" /></IconButton></Tooltip>}{canDelete && lead.status !== "converted" && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(lead)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}</TableCell></TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>No leads found.</TableCell></TableRow>}</TableBody></Table>}</TableContainer>
    <LeadDialog open={dialogOpen} lead={editing} owners={owners} user={user} onClose={() => setDialogOpen(false)} onSaved={() => { setDialogOpen(false); setSuccess(editing ? "Lead updated" : "Lead created"); load(); }} />
    <ConvertLeadDialog open={Boolean(convertTarget)} lead={convertTarget} onClose={() => setConvertTarget(null)} onConverted={() => { setConvertTarget(null); setSuccess("Lead converted to customer"); load(); }} />
  </Box>;
}
