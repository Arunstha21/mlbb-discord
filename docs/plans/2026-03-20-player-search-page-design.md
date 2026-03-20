# Player Search Page Design

**Date**: 2026-03-20
**Status**: Approved

## Purpose

A centralized search page to find players across all tournaments by Email or Discord Username, with quick access to edit and delete operations without navigating to individual tournament pages.

## Requirements

- Search players by Email OR Discord Username across ALL tournaments
- Edit player details via modal dialog
- Delete players with confirmation
- Navigate to tournament detail page by clicking player row

---

## Architecture

### New Files

- **View**: `src/web/views/players/index.ejs` - Main search page template
- **Route**: `src/web/routes/players.ts` - Player search API and page route
- **Script**: `src/web/public/js/pages/players.js` - Page-specific JavaScript

### Modified Files

- `src/web/views/layout.ejs` - Add "Player Search" navigation item
- Main route registration file - Register players router

---

## API Design

### GET /api/players/search

Search for players across all tournaments.

**Query Parameters**:
- `email` (optional) - Partial match, case-insensitive
- `discordUsername` (optional) - Partial match, case-insensitive
- `tournamentId` (optional) - Filter by specific tournament

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "player@example.com",
      "name": "John Doe",
      "team": "Team Alpha",
      "discordUsername": "johndoe#1234",
      "discordId": "123456789",
      "verified": true,
      "challongeId": 123,
      "tournament": {
        "id": "tournament-1",
        "name": "Summer Championship 2026"
      }
    }
  ]
}
```

**Behavior**:
- No params = return all players (paginated in future)
- Multiple filters = AND logic
- Sorted by: Tournament name, then team name

---

## Page Layout

### URL & Route
- URL: `/players`
- Route: `router.get("/players", ...)`

### Navigation
- Sidebar item: "Player Search"
- Position: Between "Tournaments" and "System Status"

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Page Header                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Player Search                                            ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Search Bar                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │ Email or Discord │  │    Search        │  │  Clear   │ │
│  └──────────────────┘  └──────────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Results Table                                               │
│  ┌──────┬─────────────┬────────┬──────────────┬──────────┐│
│  │ Name │ Email       │ Team   │ Discord      │ Tournament││
│  ├──────┼─────────────┼────────┼──────────────┼──────────┤│
│  │ ...  │ ...         │ ...    │ ...          │ ...      ││
│  └──────┴─────────────┴────────┴──────────────┴──────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Edit Modal

### Fields
- **Name** (text, required)
- **Team** (text, required)
- **Discord Username** (text, optional)
- **Verified** (checkbox/toggle)
- **Tournament** (read-only display)

### API
- `PUT /api/tournaments/:id/participants/:participantId` (existing)

### Behavior
- Pre-populated with current data
- Validation on save
- Success/error toast feedback
- Close on save or cancel

---

## Delete Flow

### Confirmation Dialog
```
┌─────────────────────────────────────┐
│  Delete Player?                     │
│  ─────────────────────────────────  │
│  Are you sure you want to delete    │
│  John Doe from Summer Championship? │
│  This action cannot be undone.      │
│                                     │
│  [Cancel]            [Delete]       │
└─────────────────────────────────────┘
```

### API
- `DELETE /api/tournaments/:id/participants/:participantId` (existing)

### Behavior
- Confirm → Delete API → Remove row → Success toast
- Error → Show error toast → Keep row
- "Deleting..." state during API call

---

## Results Table

### Columns
1. **Player Name** - Clickable, links to tournament
2. **Email** - Primary identifier
3. **Team** - Team name
4. **Discord Username** - With verified badge if applicable
5. **Tournament** - Tournament name
6. **Actions** - Edit (icon), Delete (icon)

### Visual States
- **Hover**: Light background highlight
- **Verified**: Green checkmark badge
- **Unverified**: Gray indicator
- **Loading**: Skeleton rows
- **Empty**: "No players found" message

### Row Click
- Click row (excluding actions) → Navigate to `/tournaments/{tournamentId}`

---

## Implementation Order

1. Create players route (`src/web/routes/players.ts`)
2. Create search API endpoint (`GET /api/players/search`)
3. Create view template (`src/web/views/players/index.ejs`)
4. Create page script (`src/web/public/js/pages/players.js`)
5. Add navigation item to layout
6. Register players router in main app
