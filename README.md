# ReachInbox

ReachInbox is an email scheduling and automation platform built with React, TypeScript, Express.js, BullMQ, Redis and PostgreSQL.

## Features

- Google OAuth authentication
- Email scheduling
- Persistent scheduled emails
- BullMQ background workers
- Redis-backed queue
- Configurable worker concurrency
- Configurable email delay
- Configurable hourly email limit
- Ethereal email integration
- Scheduled Emails dashboard
- Sent Emails dashboard
- CSV/TXT email upload
- Automatic email address detection
- Bulk email scheduling
- PostgreSQL persistence
- React + TypeScript frontend
- Tailwind CSS UI

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Axios

### Backend
- Node.js
- Express.js
- TypeScript
- Prisma
- PostgreSQL
- BullMQ
- Redis
- Nodemailer
- Ethereal Email
- Google OAuth

## Project Structure

```text
ReachInbox_Assignment/
├── backend/
│   ├── src/
│   ├── prisma/
│   └── package.json
│
├── frontend/
│   ├── src/
│   └── package.json
│
├── docker-compose.yml
└── README.md