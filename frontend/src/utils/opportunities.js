export const OPPORTUNITY_STAGES = [
  { value: "prospecting", label: "Prospecting", probability: 10, color: "default" },
  { value: "qualified", label: "Qualified", probability: 25, color: "info" },
  { value: "proposal", label: "Proposal", probability: 50, color: "primary" },
  { value: "negotiation", label: "Negotiation", probability: 75, color: "warning" },
  { value: "won", label: "Won", probability: 100, color: "success" },
  { value: "lost", label: "Lost", probability: 0, color: "error" },
];

export const STAGE_BY_VALUE = Object.fromEntries(
  OPPORTUNITY_STAGES.map((stage) => [stage.value, stage])
);

export function formatIdr(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatOpportunityDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
