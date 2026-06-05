# Zoom Meeting Management

Next.js admin platform for managing departments, employees, and Zoom meeting workflows.

## Current status

- App shell, sidebar navigation, and dashboard are working
- Employee, department, and meeting list screens are scaffolded
- Meeting detail view is available
- Seed data powers the UI while MongoDB and auth are wired in
- MongoDB helper exists in `src/lib/mongodb.js`

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Available routes

- `/dashboard`
- `/employees`
- `/departments`
- `/meetings`
- `/meetings/[id]`

## Next recommended milestone

- Replace seed data with MongoDB-backed collections
- Add CRUD API routes under `src/app/api`
- Add authentication and protected route handling
- Add create/edit forms for employees, departments, and meetings
