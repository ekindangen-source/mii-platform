# MII Sales CRM Workflow

## Purpose

MII is a sales CRM for developing marine customer accounts. It records ownership,
PICs, commercial interactions, opportunities, planned activities, and sales outcomes.
It is not intended to dispatch or operate customer fleets.

## Core flow

1. Create a Lead with its initial PIC and responsible salesperson.
2. Record product interest, expected value, next action, and qualification progress.
3. Mark the Lead Qualified when the commercial requirement is credible.
4. Confirm the sale only after customer commitment is secured.
5. The system transactionally creates the Customer, primary PIC, ownership history,
   and Won Opportunity while preserving the converted Lead as audit history.
6. Manage later interactions, Agenda activities, installed base, and repeat
   Opportunities from the Customer account.

## Opportunity stages

- **Prospecting (10%)**: possible need identified but not yet validated.
- **Qualified (25%)**: need, customer fit, and buying relevance confirmed.
- **Proposal (50%)**: commercial or technical proposal submitted.
- **Negotiation (75%)**: price, specification, delivery, or terms under discussion.
- **Won (100%)**: customer commitment secured.
- **Lost (0%)**: opportunity closed without a sale; loss reason is mandatory.

The default probability is a guide and can be adjusted when evidence supports a
different forecast.

## Access

- Administrators and managers see the complete company pipeline.
- Sales users see opportunities they own for customers currently assigned to them.
- Viewers have read-only access.
- Technicians can read opportunities for customers linked to their assigned activities.

## Customer intelligence

Vessels, engines, and service records remain valuable as customer intelligence. They
describe the installed base and help identify repower, replacement, service, parts,
and upgrade opportunities. Trip data is retained for compatibility but is not a core
sales workflow.
