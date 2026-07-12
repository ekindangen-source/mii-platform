import { useEffect, useState } from "react";
import {
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from "@mui/material";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const endpoints = [
  { label: "Customers", endpoint: "/customers" },
  { label: "Vessels", endpoint: "/vessels" },
  { label: "Engines", endpoint: "/engines" },
  { label: "Trips", endpoint: "/trips" },
  { label: "Maintenance", endpoint: "/maintenance" },
];

export default function Dashboard() {
  const { user } = useAuth();

  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const responses = await Promise.all(
          endpoints.map((item) => api.get(item.endpoint))
        );

        const nextCounts = {};

        responses.forEach((response, index) => {
          const label = endpoints[index].label;

          nextCounts[label] = Array.isArray(response.data)
            ? response.data.length
            : response.data?.data?.length || 0;
        });

        setCounts(nextCounts);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Unable to load dashboard data"
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Welcome, {user?.fullName || user?.email || "User"}
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Marine Intelligence Indonesia management dashboard.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <CircularProgress />
      ) : (
        <Grid container spacing={3}>
          {endpoints.map((item) => (
            <Grid key={item.label} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper sx={{ p: 3 }}>
                <Typography color="text.secondary">
                  {item.label}
                </Typography>

                <Typography variant="h4" fontWeight={700}>
                  {counts[item.label] ?? 0}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}
