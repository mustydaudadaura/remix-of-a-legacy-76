# Architecture rules

- Extend existing TanStack Start screens and PostgreSQL tables additively; preserve historical records and working school workflows during phased upgrades.
- Store school configuration, custom roles, permission assignments and audit records separately from user profiles; school affiliation never grants operational permissions.
- Enforce module activation and school-scoped permissions in database policies and authenticated server functions; navigation visibility is not authorization.
- Use authenticated RLS clients for ordinary operations; dynamically import privileged clients only inside authorized handlers for true administrative work.
- Keep audit records append-only and write them in database triggers so direct client mutations are covered.
- Preserve compatibility with existing assessment and report structures until a separately verified data migration replaces them.