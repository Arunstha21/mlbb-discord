# Challonge Sync - Auto-Populate Schedules Design

**Date:** 2025-03-14
**Status:** Approved

## Overview

When a user clicks "Sync from Challonge", the system will automatically fetch matches from Challonge and create schedule entries. Existing schedules are preserved, allowing users to only update the times for newly added matches.

## User Flow

1. User opens tournament detail page
2. Clicks "Sync from Challonge" button
3. System fetches:
   - Tournament metadata (existing)
   - Participant list → matches to enrolled players (existing)
   - **NEW:** Match list → creates schedule entries for new matches
4. Schedules table updates with:
   - New matches from Challonge
   - Existing schedules preserved (user's time settings not overwritten)
5. User edits individual schedules OR uploads CSV for bulk time updates

## Key Requirements

### Sync Behavior
- If `matchId` exists in schedules → **skip** (preserve user's time)
- If `matchId` doesn't exist → **create** new schedule
- Use Challonge's `scheduled_time` if available, otherwise leave blank
- Return summary: matched players, added schedules, skipped schedules, warnings

### Table Display
| Match | Teams | Scheduled Time | Thread ID | Notified | Actions |
|-------|-------|----------------|-----------|----------|---------|
| #456 | Alpha Team vs Bravo Squad | Mar 15, 2025 3:00 PM | — | No | Edit Delete |
| #457 | TBD | Not set ⚠️ | — | No | Edit Delete |

### CSV Bulk Update
- Format: `match_id`, `scheduled_time`, `timezone` (optional)
- Existing behavior already supports bulk updates (creates new, updates existing)
- No backend changes needed

## Implementation Changes

### 1. Backend: Sync Enhancement ([tournaments.ts](src/web/routes/tournaments.ts))

**Endpoint:** `POST /api/tournaments/:id/sync`

Add to existing sync logic:
```typescript
// After fetching tournament data from Challonge
const challongeMatches = await challonge.getMatches(tournament.challongeTournamentId);

let addedCount = 0;
let skippedCount = 0;
const warnings: string[] = [];

for (const match of challongeMatches) {
    // Check if schedule already exists
    const existing = await MatchSchedule.findOne({
        where: { matchId: match.matchId, tournamentId: id }
    });

    if (existing) {
        skippedCount++;
        continue;
    }

    // Create new schedule
    const schedule = new MatchSchedule();
    schedule.matchId = match.matchId;
    schedule.tournamentId = id;
    schedule.scheduledTime = match.scheduledTime || null;
    schedule.notified = false;
    schedule.threadId = null;
    await schedule.save();
    addedCount++;
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matchedPlayers": 8,
    "addedSchedules": 12,
    "skippedSchedules": 3,
    "warnings": []
  }
}
```

### 2. Backend: Schedules with Team Names ([schedules.ts](src/web/routes/schedules.ts))

**Endpoint:** `GET /api/tournaments/:id/schedules`

Enhance to include team names:
```typescript
// Fetch Challonge data for team names
const challonge = new WebsiteWrapperChallonge(config.challongeUsername, config.challongeToken);
const tournamentData = await challonge.getTournament(tournament.challongeTournamentId);

// Create player ID -> name map
const playerMap = new Map(tournamentData.players.map(p => [p.challongeId, p.name]));

// Enhance schedules with team names
const schedulesWithTeams = schedules.map(s => {
    const challongeMatch = tournamentData.matches?.find(m => m.match.id === s.matchId);
    const player1Name = challongeMatch?.player1 ? playerMap.get(challongeMatch.player1) : null;
    const player2Name = challongeMatch?.player2 ? playerMap.get(challongeMatch.player2) : null;

    return {
        ...s,
        player1Name: player1Name ?? 'TBD',
        player2Name: player2Name ?? 'TBD'
    };
});
```

### 3. Frontend: Table Layout Update ([detail.ejs](src/web/views/tournaments/detail.ejs))

**Update table headers:**
```html
<thead>
    <tr>
        <th>Match</th>
        <th>Teams</th>
        <th>Scheduled Time</th>
        <th>Thread ID</th>
        <th>Notified</th>
        <th class="actions-col">Actions</th>
    </tr>
</thead>
```

**Update renderSchedules function:**
```javascript
tbody.innerHTML = schedules.map(s => {
    const teams = `${s.player1Name} vs ${s.player2Name}`;
    const timeDisplay = s.scheduledTime
        ? new Date(s.scheduledTime).toLocaleString()
        : '<span style="color:var(--warning)">Not set ⚠️</span>';

    return `
        <tr>
            <td><strong>#${s.matchId}</strong></td>
            <td>${teams}</td>
            <td>${timeDisplay}</td>
            <td>${s.threadId || '—'}</td>
            <td><span class="${s.notified ? 'text-success' : 'text-secondary'}">${s.notified ? 'Yes' : 'No'}</span></td>
            <td class="actions-col">
                <button class="action-btn edit" onclick='openScheduleModal(${JSON.stringify(s)})' title="Edit">✏️</button>
                <button class="action-btn delete" onclick="deleteSchedule(${s.id})" title="Delete">🗑️</button>
            </td>
        </tr>
    `;
}).join('');
```

## Error Handling

### Challonge API Failures
- Log error, return partial success
- Show toast with detailed error message
- Indicate which operations succeeded vs failed

### Match Data Edge Cases
- **Pending matches** (no players): Create schedule, show "TBD vs TBD"
- **Bye matches** (one player null): Show "Team Name vs Bye"
- **Player lookup failures**: Fall back to "Player #123 vs Player #456"
- **Null scheduled_time**: Leave blank, user must set manually

### Frontend UX
- Disable "Sync" button during sync (prevent double-click)
- Show loading spinner
- Display success message with counts: "Synced! Added: 12, Skipped: 3"

## Files to Modify

1. `src/web/routes/tournaments.ts` - Sync endpoint enhancement
2. `src/web/routes/schedules.ts` - Team names in GET response
3. `src/web/views/tournaments/detail.ejs` - Table layout and render function

## Notes

- No changes needed to `challonge.ts` - already has required methods
- CSV bulk update already works correctly - no changes needed
- Concurrency protection via existing mutex in Challonge client
