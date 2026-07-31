import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Container, LinearProgress, TextField, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { APP_VERSION_LABEL } from "../config/appVersion";

const checksFor = p => [
  ["At least 12 characters",p.length>=12],["One uppercase letter",/[A-Z]/.test(p)],
  ["One lowercase letter",/[a-z]/.test(p)],["One number",/[0-9]/.test(p)],
];
export default function AcceptInvitation(){
  const navigate=useNavigate(); const [params]=useSearchParams(); const token=params.get("token")||"";
  const [invite,setInvite]=useState(null),[loading,setLoading]=useState(true),[submitting,setSubmitting]=useState(false);
  const [error,setError]=useState(""),[success,setSuccess]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
  const checks=useMemo(()=>checksFor(password),[password]); const valid=checks.every(([,ok])=>ok);
  useEffect(()=>{let live=true;(async()=>{try{if(!token)throw new Error("The invitation link is incomplete.");const r=await api.get(`/invitations/${encodeURIComponent(token)}`);if(live)setInvite(r.data.invitation);}catch(e){if(live)setError(e.response?.data?.message||e.message||"This invitation is invalid or has expired.");}finally{if(live)setLoading(false);}})();return()=>{live=false};},[token]);
  async function submit(e){e.preventDefault();setError("");if(!valid)return setError("The password does not meet the requirements.");if(password!==confirm)return setError("The password confirmation does not match.");try{setSubmitting(true);const r=await api.post(`/invitations/${encodeURIComponent(token)}/accept`,{Password:password});setSuccess(r.data.message||"Password created.");setPassword("");setConfirm("");}catch(x){setError(x.response?.data?.message||"Unable to accept the invitation.");}finally{setSubmitting(false);}}
  return <Box sx={{minHeight:"100vh",display:"flex",alignItems:"center",background:"linear-gradient(135deg,#0f766e 0%,#164e63 100%)",py:4}}><Container maxWidth="sm"><Card elevation={12}><CardContent sx={{p:4}}>
    <Box sx={{display:"flex",justifyContent:"space-between",mb:2}}><Typography variant="h4" sx={{fontWeight:700}}>MII Platform</Typography><Typography variant="caption" color="text.secondary" sx={{fontWeight:700}}>{APP_VERSION_LABEL}</Typography></Box>
    {loading&&<LinearProgress/>}{!loading&&error&&<Alert severity="error">{error}</Alert>}
    {!loading&&invite&&!success&&<><Typography color="text.secondary" sx={{mb:2}}>Create your password to activate <strong>{invite.email}</strong>.</Typography><Alert severity="info" sx={{mb:2}}>Welcome {invite.fullName}. Assigned role: {invite.role}.</Alert>
      <Box component="form" onSubmit={submit}><TextField label="New password" type="password" fullWidth required margin="normal" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><TextField label="Confirm password" type="password" fullWidth required margin="normal" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/>
      <Box sx={{my:2,display:"grid",gap:.5}}>{checks.map(([label,ok])=><Typography key={label} variant="caption" color={ok?"success.main":"text.secondary"}>{ok?"✓":"○"} {label}</Typography>)}</Box>
      <Button type="submit" fullWidth size="large" variant="contained" disabled={submitting}>{submitting?<CircularProgress size={22} color="inherit"/>:"Create password"}</Button></Box></>}
    {success&&<><Alert severity="success" sx={{mb:3}}>{success}</Alert><Button fullWidth variant="contained" onClick={()=>navigate("/login")}>Continue to sign in</Button></>}
  </CardContent></Card></Container></Box>;
}
