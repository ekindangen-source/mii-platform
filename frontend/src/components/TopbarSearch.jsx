import {
  Autocomplete,
  Box,
  TextField,
  Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

const modules = [
  {
    title: "Dashboard",
    path: "/",
  },
  {
    title: "Customers",
    path: "/customers",
  },
  {
    title: "Vessels",
    path: "/vessels",
  },
  {
    title: "Engines",
    path: "/engines",
  },
  {
    title: "Trips",
    path: "/trips",
  },
  {
    title: "Maintenance",
    path: "/maintenance",
  },
];

export default function TopbarSearch() {
  const navigate = useNavigate();

  function handleSelect(_event, selectedModule) {
    if (!selectedModule) {
      return;
    }

    navigate(selectedModule.path);
  }

  return (
    <Autocomplete
      options={modules}
      onChange={handleSelect}
      getOptionLabel={(option) => option?.title || ""}
      isOptionEqualToValue={(option, value) =>
        option.path === value.path
      }
      autoHighlight
      clearOnEscape
      sx={{
        width: 300,
        display: {
          xs: "none",
          md: "block",
        },
      }}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;

        return (
          <Box
            component="li"
            key={key}
            {...optionProps}
          >
            <Typography variant="body2">
              {option.title}
            </Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search modules"
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              color: "white",
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 2,

              "& fieldset": {
                borderColor:
                  "rgba(255,255,255,0.2)",
              },

              "&:hover fieldset": {
                borderColor:
                  "rgba(255,255,255,0.4)",
              },

              "&.Mui-focused fieldset": {
                borderColor: "white",
              },
            },

            "& input::placeholder": {
              color: "rgba(255,255,255,0.7)",
              opacity: 1,
            },

            "& .MuiAutocomplete-clearIndicator": {
              color: "white",
            },

            "& .MuiAutocomplete-popupIndicator": {
              color: "white",
            },
          }}
        />
      )}
    />
  );
}