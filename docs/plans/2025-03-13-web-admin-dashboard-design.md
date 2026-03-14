# Web Admin Dashboard Design

**Date:** 2025-03-13
**Project:** Dot Tournament Bot
**Author:** Design Document

## Overview

A web-based admin dashboard for the Dot Discord tournament bot, providing tournament organizers with a graphical interface to manage tournaments, participants, schedules, and rounds. The dashboard runs as an Express server within the same Node.js process as the Discord bot, sharing database connections and service logic.

## Architecture

### Process Model

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser       │────▶│  Express Server  │────▶│  TypeORM Models │
│  (Dashboard)    │◀────│   (Same Process) │◀────│  (PostgreSQL)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Challonge API   │
                        │  (via util)      │
                        └──────────────────┘
```

### Key Architectural Decisions

- **Same Process:** Express server runs alongside Discord bot in single Node.js process
- **Shared Resources:** Direct access to TypeORM models and existing utilities
- **Port Configuration:** `WEB_PORT` environment variable (default: 3000)
- **No Authentication:** MVP approach - open access (future: Discord OAuth)
- **Tech Stack:** Express + EJS + Vanilla CSS/JS (no frontend frameworks)

### File Structure

```
src/
├── web/
│   ├── server.ts              # Express server setup
│   ├── services/              # Shared business logic
│   │   ├── tournamentService.ts
│   │   ├── participantService.ts
│   │   ├── scheduleService.ts
│   │   └── roundService.ts
│   ├── routes/                # API route handlers
│   │   ├── index.ts
│   │   ├── tournaments.ts
│   │   ├── participants.ts
│   │   ├── schedules.ts
│   │   ├── rounds.ts
│   │   ├── organizers.ts
│   │   └── system.ts
│   ├── views/                 # EJS templates
│   │   ├── layout.ejs
│   │   ├── index.ejs
│   │   ├── tournaments/
│   │   │   ├── list.ejs
│   │   │   └── detail.ejs
│   │   ├── organizers.ejs
│   │   └── system.ejs
│   └── public/                # Static assets
│       ├── css/
│       │   ├── reset.css
│       │   ├── variables.css
│       │   ├── layout.css
│       │   ├── components.css
│       │   └── pages.css
│       └── js/
│           ├── app.js
│           ├── api.js
│           ├── tournaments.js
│           └── utils.js
```

## Features

### 1. Tournament Management (Full CRUD + Import)

**Create/Import Tournament:**
- Form with Challonge URL input and custom name
- Server selection dropdown
- Immediate sync option after creation
- Reuses `addTournament()` utility function

**View Tournaments:**
- List page with filters (All/Active/Upcoming/Completed)
- Search functionality
- Detail page with participant count, current round, bracket embed

**Update Tournament:**
- Edit name, status, participant role name
- Add/remove hosts
- Sync with Challonge button

**Delete Tournament:**
- Delete with confirmation warning

### 2. Participant Management (Full CRUD + CSV Import)

**CSV Import:**
- Drag & drop CSV file upload
- Expected columns: `teamName`, `name`, `email`, `discord` (optional)
- Preview parsed data before importing
- "Register to Challonge" option
- Handles duplicates (skip or update)
- Reuses enrollment logic from `dot!enroll`

**Individual CRUD:**
- Manual add form
- View all participants in table
- Edit inline or via modal
- Remove with confirmation

### 3. Match Schedule Management (Full CRUD + CSV Import)

**CSV Import:**
- Drag & drop CSV file upload
- Expected columns: `match_id`, `scheduled_time`, `timezone` (optional)
- Preview before importing
- Updates existing schedules by match_id
- Reuses schedule parsing from `dot!schedule`

**Individual CRUD:**
- Manual add with match ID lookup
- View schedules grouped by round
- Date/time picker with timezone
- Edit and delete individual schedules

### 4. Round Management

**Start Round:**
- Round number input
- Discord channel dropdown (fetches server channels)
- Preview: shows matches, enrolled participants, scheduled times
- Create threads button with progress indicator
- Reuses round logic from `dot!round`

**Round Status:**
- List of created threads
- Thread links
- Activity indicators

### 5. Organizer Management

- List all tournament organizers
- Add/remove organizers
- View permissions and managed servers

### 6. System Status

- Bot status (Online/Offline, Uptime, Gateway status)
- Database stats (Connection pool, query performance)
- Recent errors/warnings
- Environment info
- Challonge API status

## API Endpoints

### Tournaments
```
GET    /api/tournaments              // List all
GET    /api/tournaments/:id          // Get one
POST   /api/tournaments              // Create
PUT    /api/tournaments/:id          // Update
DELETE /api/tournaments/:id          // Delete
POST   /api/tournaments/:id/sync     // Sync with Challonge
```

### Participants
```
GET    /api/tournaments/:id/participants           // List
POST   /api/tournaments/:id/participants           // Create
POST   /api/tournaments/:id/participants/import    // CSV import
PUT    /api/tournaments/:id/participants/:pid      // Update
DELETE /api/tournaments/:id/participants/:pid      // Delete
```

### Schedules
```
GET    /api/tournaments/:id/schedules              // List
POST   /api/tournaments/:id/schedules              // Create
POST   /api/tournaments/:id/schedules/import       // CSV import
PUT    /api/tournaments/:id/schedules/:sid         // Update
DELETE /api/tournaments/:id/schedules/:sid         // Delete
```

### Rounds
```
GET    /api/tournaments/:id/rounds                 // List
GET    /api/tournaments/:id/rounds/:num/preview    // Preview
POST   /api/tournaments/:id/rounds/:num/start      // Start
GET    /api/servers/:serverId/channels             // Get channels
```

### Organizers & System
```
GET    /api/organizers                             // List
POST   /api/organizers                             // Add
DELETE /api/organizers/:id                         // Remove
GET    /api/system/stats                           // Stats
GET    /api/system/health                          // Health check
```

## UI Design

### Design Principles

- Dark theme (matches Discord aesthetic)
- Clean, admin-focused interface
- Responsive design (mobile/tablet)
- Vanilla CSS - no frameworks

### Layout

```
┌─────────────────────────────────────────────────┐
│  Header: Logo | Tournament Name | Server Status │
├─────────────────────────────────────────────────┤
│  Sidebar Nav                                      │
│  ├─ Dashboard                                     │
│  ├─ Tournaments                                   │
│  ├─ Organizers                                   │
│  └─ System Status                                │
├─────────────────────────────────────────────────┤
│                                                   │
│  Main Content Area (Tabs/Tables/Forms)           │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Color Scheme

```css
:root {
  --bg-primary: #202225;      /* Discord dark */
  --bg-secondary: #2f3136;    /* Discord secondary */
  --bg-tertiary: #36393f;     /* Discord tertiary */
  --text-primary: #ffffff;
  --text-secondary: #b9bbbe;
  --accent: #5865F2;          /* Discord blurple */
  --accent-hover: #4752C4;
  --success: #3ba55c;
  --danger: #ed4245;
  --warning: #faa61a;
}
```

### Key Components

1. **Stats Cards:** Quick metrics on dashboard
2. **Data Tables:** Sortable, filterable, pagination
3. **Tab Navigation:** Overview | Participants | Schedule | Rounds
4. **CSV Upload:** Drag & drop with format instructions
5. **Round Start:** Preview + confirmation workflow
6. **Toast Notifications:** Error/success feedback

## Error Handling

### Frontend

- Toast notifications for API errors
- Inline form validation
- Error banners for page-level issues
- Loading spinners for async operations

### Backend

- Consistent error response format:
```typescript
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE" // optional
}
```
- Proper HTTP status codes (400, 404, 500)
- Try-catch in all route handlers

### Edge Cases

- Challonge API failures → Allow retry
- Invalid CSV → Specific error messages
- Duplicate data → Skip or update options
- Partial failures → Show what succeeded/failed
- No enrolled players → Link to enroll page

## Environment Variables

Add to `.env`:
```
WEB_PORT=3000
```

## Deployment

Since Express runs in the same process:

1. Update `Dockerfile` to expose web port
2. Update `docker-compose.yaml` to map web port
3. No additional containers needed

## Future Enhancements

- Discord OAuth authentication
- Real-time updates via WebSocket
- More advanced filtering and search
- Export tournament data
- Analytics dashboard
- Multi-language support

## Implementation Estimate

**MVP:** 15-20 hours
- Server setup and routing: 3-4 hours
- Tournament CRUD: 3-4 hours
- Participant CRUD + CSV: 3-4 hours
- Schedule CRUD + CSV: 2-3 hours
- Round management: 2-3 hours
- UI/CSS: 2-2 hours

## Related Files

- [README.md](../README.md) - Project overview
- [USER_FLOWS.md](../USER_FLOWS.md) - Complete user flows
- [FLOW_DIAGRAMS.md](../FLOW_DIAGRAMS.md) - Visual diagrams
- [usage-organiser.md](../usage-organiser.md) - TO commands reference
