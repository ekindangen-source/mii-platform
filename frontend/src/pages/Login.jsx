import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
} from "@mui/material";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to sign in"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        background:
          "linear-gradient(135deg, #0f766e 0%, #164e63 100%)",
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={12}>
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ fontWeight: 700 }}
            >
              MII CRM
            </Typography>

            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Sign in to Marine Intelligence Indonesia.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                fullWidth
                required
                margin="normal"
                autoComplete="username"
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
                required
                margin="normal"
                autoComplete="current-password"
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submitting}
                sx={{ mt: 3 }}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
