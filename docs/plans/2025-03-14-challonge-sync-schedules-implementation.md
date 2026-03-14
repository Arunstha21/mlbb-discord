# Challonge Sync - Auto-Populate Schedules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance tournament sync to auto-populate match schedules from Challonge, preserving user-set times

**Architecture:** Extend existing sync endpoint to fetch matches and create schedule entries. Enhance schedules API to return team names from Challonge participant data. Update frontend table layout to display match details.

**Tech Stack:** TypeScript, Express.js, EJS templates, Challonge API, TypeORM

---

## Task 1: Backend - Enhance Sync Endpoint to Fetch Matches

**Files:**
- Modify: `src/web/routes/tournaments.ts:176-268`

**Step 1: Update syncTournament function signature and imports**

The file already has necessary imports. We'll extend the existing sync endpoint.

**Step 2: Add match fetching after participant matching**

Locate the sync endpoint (around line 176). After the participant matching loop (around line 213), add:

```typescript
// Fetch matches from Challonge and create schedule entries
const challongeMatches = await challonge.getMatches(tournament.challongeTournamentId);

let addedSchedules = 0;
let skippedSchedules = 0;
const syncWarnings: string[] = [];

// Get existing match IDs to avoid duplicates
const existingSchedules = await MatchSchedule.find({
	where: { tournamentId: id }
});
const existingMatchIds = new Set(existingSchedules.map(s => s.matchId));

for (const match of challongeMatches) {
	// Skip if schedule already exists (preserve user's time)
	if (existingMatchIds.has(match.matchId)) {
		skippedSchedules++;
		continue;
	}

	// Create new schedule entry
	const schedule = new MatchSchedule();
	schedule.matchId = match.matchId;
	schedule.tournamentId = id;
	schedule.scheduledTime = null; // User must set time
	schedule.notified = false;
	schedule.threadId = null;

	await schedule.save();
	addedSchedules++;
	existingMatchIds.add(match.matchId); // Track for this batch
}

logger.verbose(`Sync created ${addedSchedules} new schedules, skipped ${skippedSchedules} existing`);
```

**Step 3: Update response to include schedule counts**

Modify the response object (around line 254) to include:

```typescript
res.json({
	success: true,
	data: {
		id: tournament.tournamentId,
		name: tournament.name,
		status: tournament.status,
		format: tournament.format,
		participantLimit: tournament.participantLimit,
		matchedPlayers: matchedCount,
		addedSchedules,
		skippedSchedules,
		warnings: syncWarnings.length > 0 ? syncWarnings : undefined
	}
});
```

**Step 4: Test the sync endpoint**

Run: `npm run build && npm start`
Then: `curl -X POST http://localhost:3000/api/tournaments/{test-id}/sync`

Expected: Response includes `addedSchedules` and `skippedSchedules` counts

**Step 5: Commit**

```bash
git add src/web/routes/tournaments.ts
git commit -m "feat(sync): auto-populate schedules from Challonge matches

- Fetch matches during tournament sync
- Create schedule entries for new matches only
- Preserve existing schedules (user times not overwritten)
- Return counts for added/skipped schedules in response"
```

---

## Task 2: Backend - Add Team Names to Schedules Response

**Files:**
- Modify: `src/web/routes/schedules.ts:24-52`

**Step 1: Add Challonge import at top of file**

Add to existing imports (around line 6):
```typescript
import { WebsiteWrapperChallonge, WebsitePlayer } from "../../website/challonge";
import { getConfig } from "../../config";
```

**Step 2: Create helper function to get Challonge data**

Add before the router definition (after line 7):
```typescript
async function getChallongeParticipantNames(
	tournamentId: string
): Promise<Map<number, string>> {
	try {
		const config = getConfig();
		const challonge = new WebsiteWrapperChallonge(
			config.challongeUsername,
			config.challongeToken
		);
		const tournamentData = await challonge.getTournament(tournamentId);

		const playerMap = new Map<number, string>();
		for (const player of tournamentData.players) {
			playerMap.set(player.challongeId, player.name);
		}
		return playerMap;
	} catch (error) {
		logger.error("Failed to fetch Challonge participants:", error);
		return new Map();
	}
}
```

**Step 3: Update GET /api/tournaments/:id/schedules endpoint**

Modify the endpoint (around line 24) to fetch participant names:

```typescript
router.get("/api/tournaments/:id/schedules", async (req: Request, res: Response) => {
	try {
		const tournamentId = getIdParam(req.params);

		const tournament = await validateTournament(tournamentId);
		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		const schedules = await MatchSchedule.find({
			where: { tournamentId },
			order: { scheduledTime: "ASC" }
		});

		// Fetch Challonge participant names
		const playerMap = await getChallongeParticipantNames(tournament.challongeTournamentId);

		// Fetch Challonge matches for player IDs
		let challongeMatches: any[] = [];
		try {
			const config = getConfig();
			const challonge = new WebsiteWrapperChallonge(
				config.challongeUsername,
				config.challongeToken
			);
			const tournamentData = await challonge.getTournament(tournament.challongeTournamentId);
			challongeMatches = tournamentData.matches || [];
		} catch (error) {
			logger.error("Failed to fetch Challonge matches:", error);
		}

		// Create match ID -> player IDs map
		const matchPlayerMap = new Map<number, { player1: number | null; player2: number | null }>();
		for (const cm of challongeMatches) {
			matchPlayerMap.set(cm.match.id, {
				player1: cm.match.player1_id ?? null,
				player2: cm.match.player2_id ?? null
			});
		}

		res.json({
			success: true,
			data: schedules.map(s => {
				const players = matchPlayerMap.get(s.matchId);
				const player1Name = players?.player1 ? playerMap.get(players.player1) : null;
				const player2Name = players?.player2 ? playerMap.get(players.player2) : null;

				return {
					id: s.id,
					matchId: s.matchId,
					scheduledTime: s.scheduledTime,
					player1Name: player1Name ?? 'TBD',
					player2Name: player2Name ?? 'TBD',
					notified: s.notified,
					threadId: s.threadId,
				};
			})
		});
	} catch (error) {
		logger.error("Failed to fetch schedules:", error);
		res.status(500).json({ success: false, error: "Failed to fetch schedules" });
	}
});
```

**Step 4: Test the enhanced schedules endpoint**

Run: `npm run build && npm start`
Then: `curl http://localhost:3000/api/tournaments/{test-id}/schedules`

Expected: Response includes `player1Name` and `player2Name` fields

**Step 5: Commit**

```bash
git add src/web/routes/schedules.ts
git commit -m "feat(schedules): include team names from Challonge

- Fetch Challonge participants and matches
- Map player IDs to team names
- Return player1Name and player2Name in schedules API
- Handle TBD case for pending matches"
```

---

## Task 3: Frontend - Update Schedule Table Headers

**Files:**
- Modify: `src/web/views/tournaments/detail.ejs:91-99`

**Step 1: Update table headers in schedules pane**

Find the schedules table thead section (around line 91) and replace:
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

**Step 2: Update colspan in empty state**

Find the schedules empty state (around line 768 in renderSchedules function) and update colspan from 5 to 6:
```javascript
tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-state-text">No matches scheduled</div></td></tr>`;
```

**Step 3: Commit**

```bash
git add src/web/views/tournaments/detail.ejs
git commit -m "feat(ui): update schedules table layout

- Split Match ID and Teams into separate columns
- Update header labels for clarity
- Fix colspan in empty state"
```

---

## Task 4: Frontend - Update renderSchedules Function

**Files:**
- Modify: `src/web/views/tournaments/detail.ejs:1264-1297`

**Step 1: Locate and replace the renderSchedules function**

Find the renderSchedules override function (around line 1264) and replace with:

```javascript
const originalRenderSchedules = renderSchedules;
renderSchedules = function(schedules) {
	const tbody = document.getElementById('schedules-body');

	if (!schedules.length) {
		tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-state-text">No matches scheduled</div></td></tr>`;
		return;
	}

	tbody.innerHTML = schedules.map(s => {
		// Format teams display
		const teams = `${s.player1Name} vs ${s.player2Name}`;

		// Format scheduled time
		let formattedDate;
		if (s.scheduledTime) {
			const dateObj = new Date(s.scheduledTime);
			if (!isNaN(dateObj.getTime())) {
				formattedDate = dateObj.toLocaleString(undefined, {
					weekday: 'short', month: 'short', day: 'numeric',
					hour: '2-digit', minute: '2-digit'
				});
			} else {
				formattedDate = s.scheduledTime;
			}
		} else {
			formattedDate = '<span style="color:var(--warning)">Not set ⚠️</span>';
		}

		// Format notified status
		const notifiedDisplay = s.notified
			? '<span class="text-success">Yes</span>'
			: '<span class="text-secondary">No</span>';

		return `
			<tr>
				<td><strong>#${s.matchId}</strong></td>
				<td>${teams}</td>
				<td>${formattedDate}</td>
				<td>${s.threadId || '<span style="color:var(--text-secondary)">—</span>'}</td>
				<td>${notifiedDisplay}</td>
				<td class="actions-col">
					<button class="action-btn edit" onclick='openScheduleModal(${JSON.stringify(s)})' title="Edit">✏️</button>
					<button class="action-btn delete" onclick="deleteSchedule(${s.id})" title="Delete">🗑️</button>
				</td>
			</tr>
		`;
	}).join('');
};
```

**Step 2: Test the frontend**

Run: `npm run build && npm start`
Navigate to tournament detail page and check schedules tab

Expected: Table shows separate Match and Teams columns with proper formatting

**Step 3: Commit**

```bash
git add src/web/views/tournaments/detail.ejs
git commit -m "feat(ui): render schedules with team names

- Display match number and teams in separate columns
- Show \"Not set\" warning for unscheduled matches
- Format teams as \"Player 1 vs Player 2\"
- Handle TBD for pending matches"
```

---

## Task 5: Frontend - Enhance Sync Success Message

**Files:**
- Modify: `src/web/views/tournaments/detail.ejs:802-821`

**Step 1: Update syncTournament function**

Find the syncTournament function (around line 802) and update the success message:

```javascript
async function syncTournament() {
	try {
		const btn = document.getElementById('btn-sync');
		btn.disabled = true;
		btn.textContent = 'Syncing...';

		const response = await Dot.API.post(`/api/tournaments/${tournamentId}/sync`);
		const data = response.data;

		let message = 'Tournament synced successfully!';
		if (data.matchedPlayers !== undefined) {
			message += ` Matched ${data.matchedPlayers} participants.`;
		}
		if (data.addedSchedules !== undefined) {
			message += ` Added ${data.addedSchedules} new schedules.`;
		}
		if (data.skippedSchedules !== undefined && data.skippedSchedules > 0) {
			message += ` Skipped ${data.skippedSchedules} existing schedules.`;
		}

		Dot.Toast.success(message);

		// Reload data
		await loadTournamentData();
	} catch (error) {
		console.error('Failed to sync tournament:', error);
		Dot.Toast.error('Failed to sync tournament');
	} finally {
		const btn = document.getElementById('btn-sync');
		btn.disabled = false;
		btn.textContent = 'Sync from Challonge';
	}
}
```

**Step 2: Test the sync flow**

Run: `npm run build && npm start`
Click "Sync from Challonge" button

Expected: Toast shows detailed message with participant and schedule counts

**Step 3: Commit**

```bash
git add src/web/views/tournaments/detail.ejs
git commit -m "feat(ui): show detailed sync results in toast

- Display participant match count
- Show added/skipped schedule counts
- Provide clear feedback after sync operation"
```

---

## Task 6: Add New Match Badge (Optional Enhancement)

**Files:**
- Modify: `src/web/views/tournaments/detail.ejs`

**Step 1: Add CSS for new badge**

Add to styles section (around line 680):
```css
.badge-new {
	background: rgba(88, 103, 242, 0.15);
	color: var(--accent);
	font-size: 11px;
	padding: 2px 6px;
	border-radius: 4px;
	margin-left: 6px;
	font-weight: 500;
}
```

**Step 2: Update renderSchedules to show badge for new matches**

Modify the schedules mapping to add badge for recently added matches (could be tracked via timestamp or a flag from backend).

**Step 3: Test visual appearance**

**Step 4: Commit**

---

## Testing Checklist

After implementation, verify:

1. **Sync creates schedules for new matches**
   - Create tournament on Challonge with matches
   - Click sync → schedules appear in table
   - Match IDs and team names display correctly

2. **Sync preserves existing schedules**
   - Set time for a schedule
   - Sync again → time is not overwritten
   - Toast shows "Skipped X existing schedules"

3. **TBD displays for pending matches**
   - Challonge match with no players assigned
   - Teams column shows "TBD vs TBD"

4. **CSV bulk update still works**
   - Upload CSV with match_id and scheduled_time
   - Existing schedules update, new ones created

5. **Error handling**
   - Challonge API down → graceful error message
   - Invalid tournament ID → 404 response

---

## Documentation Updates

**Files:**
- Create: `docs/api/schedules.md` (if doesn't exist)

Document the enhanced schedules API response format:

```typescript
interface ScheduleResponse {
	id: number;
	matchId: number;
	scheduledTime: string | null;
	player1Name: string;  // NEW
	player2Name: string;  // NEW
	notified: boolean;
	threadId: string | null;
}
```

---

## Notes

- Challonge API rate limiting: The existing mutex in `WebsiteWrapperChallonge` prevents concurrent requests
- Timezone handling: Scheduled times stored in UTC, displayed in user's local time
- Performance: Participant names cached per request, consider caching longer for frequently accessed tournaments
