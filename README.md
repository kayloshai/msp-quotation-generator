# msp-quotation-generator
msp modular react components design system

## GraphQL + SQLite Backend

This project now includes a lightweight backend using SQLite, Apollo Server, and GraphQL.

### Scripts

- `yarn dev`: start Vite frontend
- `yarn dev:api`: start GraphQL API on `http://localhost:4000/`
- `yarn dev:all`: start both frontend and GraphQL API together
- `yarn db:pack`: encrypt `server/data.sqlite` into `server/data.sqlite.enc`
- `yarn db:unpack`: decrypt `server/data.sqlite.enc` into `server/data.sqlite`

### Backend files

- `server/index.js`: Apollo server bootstrap
- `server/db.js`: SQLite connection and table initialization
- `server/schema.js`: GraphQL schema and resolvers
- `server/seed-data.js`: built-in seed data used when the database is empty

### Default database location

- `./server/data.sqlite`

Set a custom path with:

- `SQLITE_DB_PATH=./path/to/your.sqlite`

Set API port with:

- `GRAPHQL_PORT=4000`

### Encrypted DB sharing

You can commit only the encrypted DB blob and keep the decryption key local.

1. Create `.env.local` from `.env.example`
2. Set `DB_ENCRYPTION_KEY` in `.env.local`
3. Run `yarn db:pack` to generate `server/data.sqlite.enc`
4. Commit `server/data.sqlite.enc` to your repo
5. On another machine, put the same `DB_ENCRYPTION_KEY` in `.env.local`
6. Run `yarn dev:api` and it will auto-decrypt if `server/data.sqlite` is missing

Notes:

- `server/data.sqlite` remains gitignored.
- `server/data.sqlite.enc` can be committed and shared.

### Included GraphQL operations

Queries:

- `employees`
- `employeeHours`
- `currentProjectHours`
- `plannedProjectHours`

Mutations:

- Employee: `addEmployee`, `updateEmployee`, `deleteEmployee`
- Employee hours: `addEmployeeHour`, `updateEmployeeHour`, `deleteEmployeeHour`
- Current project hours: `addCurrentProjectHour`, `updateCurrentProjectHour`, `deleteCurrentProjectHour`
- Planned project hours: `addPlannedProjectHour`, `updatePlannedProjectHour`, `deletePlannedProjectHour`
