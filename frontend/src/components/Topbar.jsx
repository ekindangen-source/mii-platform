import {
  Avatar,
  Box,
  Button,
  Typography,
} from "@mui/material";

import LogoutIcon from "@mui/icons-material/Logout";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import TopbarSearch from "./TopbarSearch";

const pageTitles = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/vessels": "Vessels",
  "/engines": "Engines",
  "/trips": "Trips",
  "/maintenance": "Maintenance",
};

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const pageTitle =
    pageTitles[location.pathname] ||
    "Marine Intelligence Indonesia";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box>
        <Typography
          variant="h6"
          fontWeight={700}
          noWrap
        >
          {pageTitle}
        </Typography>

        <Typography
          variant="caption"
          sx={{
            display: {
              xs: "none",
              sm: "block",
            },
            opacity: 0.75,
          }}
        >
          Marine Intelligence Indonesia
        </Typography>
      </Box>

<TopbarSearch />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: "secondary.main",
          }}
        >
          {(user?.fullName ||
            user?.email ||
            "U")
            .charAt(0)
            .toUpperCase()}
        </Avatar>

        <Box
          sx={{
            display: {
              xs: "none",
              sm: "block",
            },
          }}
        >
          <Typography
            variant="body2"
            fontWeight={700}
          >
            {user?.fullName ||
              user?.email ||
              "User"}
          </Typography>

          <Typography
            variant="caption"
            sx={{ opacity: 0.8 }}
          >
            {user?.role || ""}
          </Typography>
        </Box>

        <Button
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
}