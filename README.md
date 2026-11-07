# Pangolin

Built for people who occasionally need to request payment, but are not interested in running a business. Pangolin is deliberately small. It will not send invoices on your behalf, nor automatically mark received payment. It _will_ consistently format and sum documents, and apply configured taxes[^taxes]. It works with any (decimal) currency, address, locale, or time zone.

<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/486e8e8b-fa5e-4688-b70a-d402dca2380c">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/b1715e0f-7dbf-40ce-b7a1-998d44b6bfa8">
    <img width="671" alt="Comparison graphic of eased and uneased gradient" src="https://github.com/user-attachments/assets/b1715e0f-7dbf-40ce-b7a1-998d44b6bfa8" />
  </picture>
</p>

[^taxes]: We do not support compound taxes. Each tax is calculated from the base item price, without any taxes applied.


## Things to know

- **Arithmetic in the database.** Postgres views calculate line items, taxes and totals.
- **Immutable history.** [SCD type 2](https://en.wikipedia.org/wiki/Slowly_changing_dimension#Type_2:_add_new_row) tables maintain stable historical records.
- **Tenant isolation.** Row-level security on every table. Access the database through `withRLS()`.
- **Field-level encryption.** Sensitive columns use envelope encryption. Cryptographic handles exposed through `withVault()`.
- **Gapless numbering.** Sequence numbers are allocated inside a document transaction, through the `sequencer` watermark table.

The application takes a database-first approach, so reading the schema will get you far. Learn more about these decisions, and their consequences, in [this article](https://liam.macann.xyz/dev/pangolin).

Built with: Next.js, Drizzle, PostgreSQL (Neon), Better Auth, Hono, and pdfmake.


## Setup

Requires Node 24. [Nub](https://github.com/nubjs/nub) is used as package manager and runner. The codebase assumes a connected [Neon](https://neon.com) project. API fuzz testing additionally requires [uv](https://docs.astral.sh/uv/).

> [!TIP]
> On checkout, each git branch gets a dedicated Neon branch, with credentials written to the `.env.local` file. To use another Postgres source, skip the Neon steps and set the database variables yourself. 

1. Create `.env.local` with the variables [below](#environment). On Neon, ignore the three database variables: the post-checkout hook writes them.
2. Install, link and migrate:

   ```bash
   nub install
   nub exec neon link
   git checkout HEAD # Writes the database variables
   nub run db:migrate
   ```

3. The migrations create an `authenticated` role, used for application connections. You will need to set a password as a superuser, then run `git checkout HEAD` to write the secrets.

   ```sql
   ALTER ROLE authenticated WITH LOGIN PASSWORD '<password>';
   ```

4. Run `nub run db:seed` if you want sample data, then start the development server.


### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Superuser connection, for migrations and Better Auth |
| `DATABASE_URL_UNPOOLED` | Direct (unpooled) connection |
| `PGPASSWORD_AUTHENTICATED` | Password for the `authenticated` role that the app connects as |
| `NEON_PROJECT_ID` | Neon project to branch from (Neon only) |
| `DB_ENCRYPTION_SECRET` | Key-encryption key (KEK), hex-encoded |
| `BETTER_AUTH_URL` | Public base URL of the app |
| `BETTER_AUTH_SECRET` | Better Auth signing secret |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth credentials |


## Development

```bash
nub run typecheck
nub run check         # Lint and format
nub run test:run      # Unit and integration tests
nub run test:fuzz     # API fuzzing (requires uv)
nub run db:generate   # Generate SQL migration from schema changes
nub run db:migrate    # Apply pending migrations to connected database
nub run openapi:lint  # Spectral lint against OpenAPI contract
```
