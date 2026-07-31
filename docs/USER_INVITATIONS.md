# MII v1.1.1 Secure User Invitations

- Admin enters User ID, full name, email and role.
- Account is created inactive.
- MII emails a one-time 24-hour invitation link.
- Raw tokens are never stored; PostgreSQL stores a SHA-256 hash.
- User creates a password with at least 12 characters, uppercase, lowercase and a number.
- Password is bcrypt hashed with cost 12.
- Account activates only after acceptance.
- Resending revokes earlier pending links.
- Existing active users are unchanged.
