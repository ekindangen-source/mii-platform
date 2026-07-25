import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    value === ""
  );
}

function formatValue(field) {
  const { value, type, suffix } = field;

  if (isEmpty(value)) {
    return "—";
  }

  if (type === "boolean") {
    return value ? "Yes" : "No";
  }

  if (type === "date") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }
  }

  if (type === "dateTime") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
  }

  if (type === "currency") {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(number);
    }
  }

  if (type === "number") {
    const number = Number(value);

    if (Number.isFinite(number)) {
      const formatted = new Intl.NumberFormat(
        "en-US",
        {
          maximumFractionDigits: 2,
        }
      ).format(number);

      return suffix
        ? `${formatted} ${suffix}`
        : formatted;
    }
  }

  const formatted = String(value);

  return suffix
    ? `${formatted} ${suffix}`
    : formatted;
}

export default function RecordDetailsDialog({
  open,
  onClose,
  title,
  subtitle,
  imageSrc,
  imageAlt,
  sections = [],
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(
    theme.breakpoints.down("sm")
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={fullScreen}
      scroll="paper"
    >
      <DialogTitle
        sx={{
          pr: 7,
          pb: 1.5,
        }}
      >
        <Typography
          variant="h5"
          sx={{ fontWeight: 700 }}
        >
          {title || "Record details"}
        </Typography>

        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            {subtitle}
          </Typography>
        )}

        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 12,
            top: 12,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack sx={{ gap: 3 }}>
          {imageSrc && (
            <Box
              component="img"
              src={imageSrc}
              alt={imageAlt || title || "Record photo"}
              sx={{
                width: "100%",
                maxHeight: {
                  xs: 260,
                  sm: 420,
                },
                objectFit: "contain",
                borderRadius: 2,
                bgcolor: "grey.100",
              }}
            />
          )}
          {sections.map((section, index) => (
            <Box
              key={
                section.title ||
                `section-${index}`
              }
            >
              {section.title && (
                <>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      mb: 1.25,
                    }}
                  >
                    {section.title}
                  </Typography>

                  <Divider sx={{ mb: 2 }} />
                </>
              )}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {section.fields.map(
                  (field, fieldIndex) => (
                    <Box
                      key={
                        field.key ||
                        `${field.label}-${fieldIndex}`
                      }
                      sx={{
                        minWidth: 0,
                        gridColumn:
                          field.fullWidth
                            ? "1 / -1"
                            : undefined,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "block",
                          mb: 0.35,
                        }}
                      >
                        {field.label}
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight:
                            field.emphasize
                              ? 700
                              : 500,
                          whiteSpace:
                            field.multiline
                              ? "pre-wrap"
                              : "normal",
                          overflowWrap:
                            "anywhere",
                        }}
                      >
                        {formatValue(field)}
                      </Typography>
                    </Box>
                  )
                )}
              </Box>
            </Box>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          justifyContent: "space-between",
          px: 3,
          py: 2,
        }}
      >
        <Box>
          {canDelete && onDelete && (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
        </Box>

        <Stack
          sx={{
            flexDirection: "row",
            gap: 1,
          }}
        >
          <Button onClick={onClose}>
            Close
          </Button>

          {canEdit && onEdit && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
