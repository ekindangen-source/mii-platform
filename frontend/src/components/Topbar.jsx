import {
  Box,
  Button,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Typography variant="h6">
        Marine Intelligence Indonesia
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="body2" fontWeight={700}>
            {user?.fullName || user?.email || "User"}
          </Typography>

          <Typography variant="caption">
            {user?.role || ""}
          </Typography>
        </Box>

        <Button
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={logout}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
}
