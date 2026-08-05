# msp-quotation-generator
msp modular react components design system

## GraphQL + SQLite Backend

This project now includes a lightweight backend using SQLite, Apollo Server, and GraphQL.

### Scripts

- `yarn dev`: start Vite frontend
- `yarn dev:api`: start GraphQL API on `http://localhost:4000/`
- `yarn dev:all`: start both frontend and GraphQL API together

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
