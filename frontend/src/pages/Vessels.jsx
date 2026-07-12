import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  VesselID:"", CustomerID:"", BoatName:"", Builder:"", YearBuilt:"",
  LengthM:"", BeamM:"", HullMaterial:"", HullType:"",
  PassengerCapacity:"", FuelTankL:"", HomePort:"", TypicalRoute:""
};

const hullMaterials = ["Fiberglass","Aluminum","Wood","Steel","HDPE","Other"];
const hullTypes = ["Monohull","Catamaran","Trimaran","RIB","Other"];

function mapRow(row) {
  return {
    VesselID: row.vessel_id || "",
    CustomerID: row.customer_id || "",
    BoatName: row.boat_name || "",
    Builder: row.builder || "",
    YearBuilt: row.year_built ?? "",
    LengthM: row.length_m ?? "",
    BeamM: row.beam_m ?? "",
    HullMaterial: row.hull_material || "",
    HullType: row.hull_type || "",
    PassengerCapacity: row.passenger_capacity ?? "",
    FuelTankL: row.fuel_tank_l ?? "",
    HomePort: row.home_port || "",
    TypicalRoute: row.typical_route || ""
  };
}

export default function Vessels() {
  const [vessels,setVessels] = useState([]);
  const [customers,setCustomers] = useState([]);
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const [formOpen,setFormOpen] = useState(false);
  const [editingId,setEditingId] = useState(null);
  const [form,setForm] = useState(emptyForm);
  const [deleteTarget,setDeleteTarget] = useState(null);
  const [deleting,setDeleting] = useState(false);

  async function loadData() {
    try {
      setLoading(true); setError("");
      const [v,c] = await Promise.all([api.get("/vessels"), api.get("/customers")]);
      if (!Array.isArray(v.data) || !Array.isArray(c.data)) throw new Error("Unexpected API response");
      setVessels(v.data); setCustomers(c.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load vessel data");
    } finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  const customerMap = useMemo(() => {
    const m = new Map();
    customers.forEach(c => m.set(c.customer_id, c.company || c.customer_id));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vessels;
    return vessels.filter(v => [
      v.vessel_id,v.boat_name,v.builder,v.company,v.customer_id,
      v.home_port,v.hull_material,v.hull_type
    ].some(x => String(x ?? "").toLowerCase().includes(q)));
  }, [vessels,search]);

  function openCreate() { setEditingId(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(v) { setEditingId(v.vessel_id); setForm(mapRow(v)); setFormOpen(true); }
  function closeForm() { if (saving) return; setFormOpen(false); setEditingId(null); setForm(emptyForm); }
  function change(e) { const {name,value}=e.target; setForm(f=>({...f,[name]:value})); }

  async function submit(e) {
    e.preventDefault();
    if (!form.VesselID.trim()) return setError("Vessel ID is required");
    if (!form.CustomerID.trim()) return setError("Customer is required");

    const payload = {
      ...form,
      YearBuilt: form.YearBuilt === "" ? null : Number(form.YearBuilt),
      LengthM: form.LengthM === "" ? null : Number(form.LengthM),
      BeamM: form.BeamM === "" ? null : Number(form.BeamM),
      PassengerCapacity: form.PassengerCapacity === "" ? null : Number(form.PassengerCapacity),
      FuelTankL: form.FuelTankL === "" ? null : Number(form.FuelTankL)
    };

    try {
      setSaving(true); setError(""); setSuccess("");
      if (editingId) {
        await api.put(`/vessels/${encodeURIComponent(editingId)}`, payload);
        setSuccess("Vessel updated successfully");
      } else {
        await api.post("/vessels", payload);
        setSuccess("Vessel created successfully");
      }
      closeForm(); await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save vessel");
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true); setError("");
      await api.delete(`/vessels/${encodeURIComponent(deleteTarget.vessel_id)}`);
      setSuccess("Vessel deleted successfully");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to delete vessel");
    } finally { setDeleting(false); }
  }

  return (
    <Box>
      <Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" spacing={2} sx={{mb:3}}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Vessels</Typography>
          <Typography color="text.secondary">Manage vessels and customer fleet assignments.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon/>} onClick={openCreate}>Add vessel</Button>
      </Stack>

      {error && <Alert severity="error" onClose={()=>setError("")} sx={{mb:2}}>{error}</Alert>}
      {success && <Alert severity="success" onClose={()=>setSuccess("")} sx={{mb:2}}>{success}</Alert>}

      <Paper sx={{p:2,mb:2}}>
        <Stack direction={{xs:"column",sm:"row"}} spacing={2}>
          <TextField fullWidth value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search vessel, customer, builder, port..."
            InputProps={{startAdornment:<InputAdornment position="start"><SearchIcon/></InputAdornment>}}/>
          <Tooltip title="Refresh"><span><IconButton onClick={loadData} disabled={loading} color="primary"><RefreshIcon/></IconButton></span></Tooltip>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        {loading ? <Box sx={{minHeight:260,display:"grid",placeItems:"center"}}><CircularProgress/></Box> :
        <Table>
          <TableHead><TableRow>
            <TableCell>Vessel ID</TableCell><TableCell>Boat name</TableCell><TableCell>Customer</TableCell>
            <TableCell>Builder</TableCell><TableCell>Year</TableCell><TableCell>Hull</TableCell>
            <TableCell>Home port</TableCell><TableCell align="right">Length (m)</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {filtered.map(v => <TableRow key={v.vessel_id} hover>
              <TableCell>{v.vessel_id}</TableCell>
              <TableCell><Typography fontWeight={600}>{v.boat_name || "Unnamed vessel"}</Typography>
                <Typography variant="caption" color="text.secondary">{v.hull_type || "—"}</Typography></TableCell>
              <TableCell>{v.company || customerMap.get(v.customer_id) || v.customer_id || "—"}</TableCell>
              <TableCell>{v.builder || "—"}</TableCell><TableCell>{v.year_built ?? "—"}</TableCell>
              <TableCell>{[v.hull_material,v.hull_type].filter(Boolean).join(" / ") || "—"}</TableCell>
              <TableCell>{v.home_port || "—"}</TableCell><TableCell align="right">{v.length_m ?? "—"}</TableCell>
              <TableCell align="right">
                <Tooltip title="Edit"><IconButton color="primary" onClick={()=>openEdit(v)}><EditIcon/></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton color="error" onClick={()=>setDeleteTarget(v)}><DeleteIcon/></IconButton></Tooltip>
              </TableCell>
            </TableRow>)}
            {!filtered.length && <TableRow><TableCell colSpan={9} align="center">No vessels found.</TableCell></TableRow>}
          </TableBody>
        </Table>}
      </TableContainer>

      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="md">
        <Box component="form" onSubmit={submit}>
          <DialogTitle>{editingId ? "Edit vessel" : "Add vessel"}</DialogTitle>
          <DialogContent dividers>
            <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:2,pt:1}}>
              <TextField label="Vessel ID" name="VesselID" value={form.VesselID} onChange={change} required disabled={Boolean(editingId)}/>
              <TextField select label="Customer" name="CustomerID" value={form.CustomerID} onChange={change} required>
                {customers.map(c=><MenuItem key={c.customer_id} value={c.customer_id}>{c.company || c.customer_id} — {c.customer_id}</MenuItem>)}
              </TextField>
              <TextField label="Boat name" name="BoatName" value={form.BoatName} onChange={change}/>
              <TextField label="Builder" name="Builder" value={form.Builder} onChange={change}/>
              <TextField label="Year built" name="YearBuilt" type="number" value={form.YearBuilt} onChange={change}/>
              <TextField label="Length (m)" name="LengthM" type="number" value={form.LengthM} onChange={change} inputProps={{min:0,step:"any"}}/>
              <TextField label="Beam (m)" name="BeamM" type="number" value={form.BeamM} onChange={change} inputProps={{min:0,step:"any"}}/>
              <TextField select label="Hull material" name="HullMaterial" value={form.HullMaterial} onChange={change}>
                <MenuItem value=""><em>None</em></MenuItem>{hullMaterials.map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}
              </TextField>
              <TextField select label="Hull type" name="HullType" value={form.HullType} onChange={change}>
                <MenuItem value=""><em>None</em></MenuItem>{hullTypes.map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}
              </TextField>
              <TextField label="Passenger capacity" name="PassengerCapacity" type="number" value={form.PassengerCapacity} onChange={change}/>
              <TextField label="Fuel tank (L)" name="FuelTankL" type="number" value={form.FuelTankL} onChange={change}/>
              <TextField label="Home port" name="HomePort" value={form.HomePort} onChange={change}/>
              <TextField label="Typical route" name="TypicalRoute" value={form.TypicalRoute} onChange={change} multiline minRows={3} sx={{gridColumn:{sm:"1 / -1"}}}/>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update vessel" : "Create vessel"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete vessel"
        message={deleteTarget ? `Delete ${deleteTarget.boat_name || deleteTarget.vessel_id} (${deleteTarget.vessel_id})? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={()=>setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
