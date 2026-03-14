# Start Round Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add web UI for tournament organizers to create Discord match threads for a round without using Discord commands.

**Architecture:**
- Backend: Extend existing `rounds.ts` routes with real Discord.js integration
- Frontend: Add header button and modal to tournament detail page
- Data: Use existing MatchSchedule records for round numbers, Discord API for channels

**Tech Stack:** TypeScript, Express, EJS templates, Discord.js

---

### Task 1: Add GET /api/tournaments/:id/channels endpoint

**Files:**
- Modify: `src/web/routes/rounds.ts:139-154`

**Step 1: Write the implementation**

Replace the placeholder `/api/servers/:serverId/channels` route with real Discord channel fetching. The route should be at `/api/tournaments/:id/channels` to get channels for the tournament's server.

```typescript
// API: Get Discord channels for a tournament's server
router.get("/api/tournaments/:id/channels", async (req: Request, res: Response) => {
	try {
		const id = getIdParam(req.params);
		const tournament = await validateTournament(id);

		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		const client = tryGetBotClient();
		if (!client) {
			return res.status(503).json({
				success: false,
				error: "Bot client not ready. Please try again in a moment."
			});
		}

		const guild = await client.guilds.fetch(tournament.owningDiscordServer).catch(() => null);
		if (!guild) {
			return res.status(404).json({ success: false, error: "Discord server not found" });
		}

		const channels = guild.channels.cache
			.filter(ch => ch.type === 0 /* GuildText */)
			.map(ch => ({
				id: ch.id,
				name: ch.name,
				type: ch.name
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		res.json({ success: true, data: channels });
	} catch (error) {
		logger.error("Failed to fetch channels:", error);
		res.status(500).json({ success: false, error: "Failed to fetch channels" });
	}
});
```

**Step 2: Add helper function at top of file**

Add this after the existing `tryGetBotClient` helper (create it if it doesn't exist):

```typescript
// Helper to safely get the Discord client or null
function tryGetBotClient() {
	try {
		return require("../../web/server").getBotClient();
	} catch (e) {
		return null;
	}
}
```

**Step 3: Commit**

```bash
git add src/web/routes/rounds.ts
git commit -m "feat: add API endpoint to fetch Discord channels for tournament"
```

---

### Task 2: Add GET /api/tournaments/:id/rounds endpoint

**Files:**
- Modify: `src/web/routes/rounds.ts` (add before the export)

**Step 1: Write the implementation**

```typescript
// API: Get available round numbers from schedules
router.get("/api/tournaments/:id/rounds", async (req: Request, res: Response) => {
	try {
		const id = getIdParam(req.params);
		const tournament = await validateTournament(id);

		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		// Get unique round numbers from schedules
		const schedules = await MatchSchedule.find({
			where: { tournamentId: id },
			select: ["roundNumber"]
		});

		if (schedules.length === 0) {
			return res.status(400).json({
				success: false,
				error: "No schedules found. Please import schedules first."
			});
		}

		const uniqueRounds = [...new Set(schedules.map(s => s.roundNumber).filter(r => r != null))].sort((a, b) => a - b);

		res.json({ success: true, data: uniqueRounds });
	} catch (error) {
		logger.error("Failed to fetch rounds:", error);
		res.status(500).json({ success: false, error: "Failed to fetch rounds" });
	}
});
```

**Step 2: Verify MatchSchedule entity has roundNumber field**

Check if `MatchSchedule` has a `roundNumber` field. If not, we'll need to add it or use matchId ranges.

Run: `grep -n "roundNumber\|round" src/database/orm/MatchSchedule.ts`

If field doesn't exist, we'll use matchId grouping instead. Adjust query to:
```typescript
// Alternative if no roundNumber field
const schedules = await MatchSchedule.find({
	where: { tournamentId: id },
	select: ["matchId"]
});

// Group by matchId ranges (assuming 100 matches per round)
const rounds = new Set<number>();
schedules.forEach(s => {
	const round = Math.ceil((s.matchId || 1) / 100);
	rounds.add(round);
});
const uniqueRounds = Array.from(rounds).sort((a, b) => a - b);
```

**Step 3: Commit**

```bash
git add src/web/routes/rounds.ts
git commit -m "feat: add API endpoint to get available round numbers from schedules"
```

---

### Task 3: Update GET /api/tournaments/:id/rounds/:round/preview endpoint

**Files:**
- Modify: `src/web/routes/rounds.ts:25-71`

**Step 1: Write the implementation**

Replace the existing placeholder preview endpoint with real implementation:

```typescript
// API: Preview matches for a round
router.get("/api/tournaments/:id/rounds/:round/preview", async (req: Request, res: Response) => {
	try {
		const tournamentId = getIdParam(req.params);
		const roundNumber = parseInt(getIdParam(req.params, 'round'), 10);

		const tournament = await validateTournament(tournamentId);
		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		// Get schedules for this round
		const schedules = await MatchSchedule.find({
			where: { tournamentId }
		});

		// Filter schedules by round number
		// If using roundNumber field:
		const roundSchedules = schedules.filter(s => s.roundNumber === roundNumber);
		// OR if using matchId grouping:
		// const roundSchedules = schedules.filter(s => Math.ceil((s.matchId || 1) / 100) === roundNumber);

		if (roundSchedules.length === 0) {
			return res.status(404).json({
				success: false,
				error: `No schedules found for round ${roundNumber}`
			});
		}

		// Get enrolled players for lookups
		const enrolledPlayers = await EnrolledPlayer.find({
			where: { tournamentId, verified: true }
		});

		// Build lookup maps
		const teamMap = new Map<string, EnrolledPlayer[]>();
		const nameMap = new Map<string, EnrolledPlayer>();
		for (const player of enrolledPlayers) {
			if (player.team) {
				if (!teamMap.has(player.team)) {
					teamMap.set(player.team, []);
				}
				teamMap.get(player.team)!.push(player);
			}
			if (player.name) {
				nameMap.set(player.name, player);
			}
		}

		// Build preview data
		const matches = roundSchedules.map(s => {
			const scheduledTime = s.scheduledTime && s.scheduledTime.getFullYear() < 2090
				? s.scheduledTime.toISOString()
				: null;

			// Try to find enrolled players for this match
			// Note: This is simplified - full implementation would parse team names from Challonge
			const hasEnrolled = enrolledPlayers.length > 0;

			return {
				matchId: s.matchId,
				scheduledTime,
				threadId: s.threadId,
				notified: s.notified,
				hasEnrolled,
				enrolledCount: enrolledPlayers.length
			};
		});

		res.json({
			success: true,
			data: {
				round: roundNumber,
				matchCount: matches.length,
				enrolledCount: enrolledPlayers.length,
				matches,
				warning: enrolledPlayers.length === 0 ? "No verified players enrolled yet" : undefined
			}
		});
	} catch (error) {
		logger.error("Failed to preview round:", error);
		res.status(500).json({ success: false, error: "Failed to preview round" });
	}
});
```

**Step 2: Commit**

```bash
git add src/web/routes/rounds.ts
git commit -m "feat: implement round preview endpoint with schedule and enrollment data"
```

---

### Task 4: Update POST /api/tournaments/:id/rounds/:round/start endpoint

**Files:**
- Modify: `src/web/routes/rounds.ts:74-136`

**Step 1: Write the implementation**

Replace the existing placeholder start endpoint with real Discord.js integration. This will reuse logic from `src/commands/round.ts`:

```typescript
// API: Start a round (create Discord threads)
router.post("/api/tournaments/:id/rounds/:round/start", async (req: Request, res: Response) => {
	try {
		const tournamentId = getIdParam(req.params);
		const roundNumber = parseInt(getIdParam(req.params, 'round'), 10);
		const { channelId } = req.body;

		if (!channelId) {
			return res.status(400).json({
				success: false,
				error: "Missing required field: channelId"
			});
		}

		const tournament = await validateTournament(tournamentId);
		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		// Get Discord client
		const client = tryGetBotClient();
		if (!client) {
			return res.status(503).json({
				success: false,
				error: "Bot client not ready. Please try again in a moment."
			});
		}

		// Get the guild and channel
		const guild = await client.guilds.fetch(tournament.owningDiscordServer).catch(() => null);
		if (!guild) {
			return res.status(404).json({ success: false, error: "Discord server not found" });
		}

		const targetChannel = await guild.channels.fetch(channelId).catch(() => null);
		if (!targetChannel || targetChannel.type !== 0) {
			return res.status(400).json({ success: false, error: "Invalid text channel" });
		}

		// Get enrolled players
		const enrolledPlayers = await EnrolledPlayer.find({
			where: { tournamentId, verified: true }
		});

		// Build lookup maps
		const teamMap = new Map<string, EnrolledPlayer[]>();
		const nameMap = new Map<string, EnrolledPlayer>();
		for (const player of enrolledPlayers) {
			if (player.team) {
				if (!teamMap.has(player.team)) {
					teamMap.set(player.team, []);
				}
				teamMap.get(player.team)!.push(player);
			}
			if (player.name) {
				nameMap.set(player.name, player);
			}
		}

		// Get schedules for this round
		const schedules = await MatchSchedule.find({
			where: { tournamentId }
		});

		// Filter by round number
		const roundSchedules = schedules.filter(s => s.roundNumber === roundNumber);
		// OR: const roundSchedules = schedules.filter(s => Math.ceil((s.matchId || 1) / 100) === roundNumber);

		if (roundSchedules.length === 0) {
			return res.status(400).json({
				success: false,
				error: `No schedules found for round ${roundNumber}`
			});
		}

		// Get Challonge data for player names
		const config = getConfig();
		const challonge = new WebsiteWrapperChallonge(config.challongeUsername, config.challongeToken);
		const players = await challonge.getPlayers(tournament.challongeTournamentId);

		// Create threads
		const { ChannelType, ThreadAutoArchiveDuration } = require("discord.js");
		let createdCount = 0;
		const errors: string[] = [];

		for (const schedule of roundSchedules) {
			try {
				// Get player names from Challonge
				// This is simplified - full implementation would need proper match-player mapping
				const player1Name = players.find(p => p.challongeId === schedule.player1ChallongeId)?.name || "Player 1";
				const player2Name = players.find(p => p.challongeId === schedule.player2ChallongeId)?.name || "Player 2";

				const threadName = `${player1Name} vs ${player2Name}`;

				const thread = await targetChannel.threads.create({
					name: threadName,
					type: ChannelType.PrivateThread,
					autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
					reason: `Round ${roundNumber} match generated by web admin`
				});

				// Get enrolled players for pings
				const team1Players = teamMap.get(player1Name) || [];
				const team2Players = teamMap.get(player2Name) || [];

				const getMentions = (playersArray: EnrolledPlayer[]): string => {
					const mentions = playersArray.map(p => p.discordId ? `<@${p.discordId}>` : null).filter(Boolean);
					return mentions.length > 0 ? mentions.join(" ") : "(No linked Discord users found)";
				};

				const p1Mentions = getMentions(team1Players);
				const p2Mentions = getMentions(team2Players);

				// Format scheduled time
				let scheduledTimeText = "";
				if (schedule.scheduledTime && schedule.scheduledTime.getFullYear() < 2090) {
					const unixTimestamp = Math.floor(schedule.scheduledTime.getTime() / 1000);
					scheduledTimeText = `\n\n⏰ **Scheduled Time:** <t:${unixTimestamp}:F>`;
				}

				// Send thread message
				await thread.send(`🏆 **Round ${roundNumber} Match** 🏆\n\n**${player1Name}** ${p1Mentions}\n**VS**\n**${player2Name}** ${p2Mentions}${scheduledTimeText}\nGood luck!`);

				// Save thread ID to schedule
				schedule.threadId = thread.id;
				await schedule.save();

				createdCount++;

			} catch (e) {
				logger.error(`Error creating thread for match ${schedule.matchId}:`, e);
				errors.push(`Match ${schedule.matchId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
			}
		}

		res.json({
			success: true,
			data: {
				tournamentId,
				roundNumber,
				channelId,
				createdCount,
				totalCount: roundSchedules.length,
				errors: errors.length > 0 ? errors : undefined
			}
		});
	} catch (error) {
		logger.error("Failed to start round:", error);
		res.status(500).json({ success: false, error: "Failed to start round" });
	}
});
```

**Step 2: Add missing imports at top of file**

```typescript
import { WebsiteWrapperChallonge } from "../../website/challonge";
import { getConfig } from "../../config";
```

**Step 3: Add MatchSchedule player fields if needed**

Check if MatchSchedule has player1ChallongeId/player2ChallongeId fields. If not, adjust the implementation to work without them.

Run: `grep -n "player1\|player2\|challongeId" src/database/orm/MatchSchedule.ts`

If not present, simplify the thread name to use matchId:
```typescript
const threadName = `Match ${schedule.matchId}`;
```

**Step 4: Commit**

```bash
git add src/web/routes/rounds.ts
git commit -m "feat: implement round start endpoint with Discord thread creation"
```

---

### Task 5: Add Start Round button to tournament detail page header

**Files:**
- Modify: `src/web/views/tournaments/detail.ejs:37-53`

**Step 1: Add the button in the header tabs**

Find the header section with the "Sync from Challonge" button and add the "Start Round" button:

```ejs
<!-- Tabs Container -->
<div class="detail-tabs" style="display: flex; justify-content: space-between; align-items: center;">
	<div style="display: flex; gap: 16px;">
		<button class="tab-btn active" data-tab="participants" onclick="switchTab('participants')">
			Participants (<span id="t-p-count">0</span>)
		</button>
		<button class="tab-btn" data-tab="schedules" onclick="switchTab('schedules')">
			Schedules (<span id="t-s-count">0</span>)
		</button>
	</div>
	<div style="display: flex; gap: 12px;">
		<button class="btn btn-primary" id="btn-start-round" onclick="openStartRoundModal()">
			<span class="btn-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
			</span>
			Start Round
		</button>
		<button class="btn btn-primary" id="btn-sync" onclick="syncTournament()">
			<span class="btn-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
			</span>
			Sync from Challonge
		</button>
	</div>
</div>
```

**Step 2: Commit**

```bash
git add src/web/views/tournaments/detail.ejs
git commit -m "feat: add Start Round button to tournament detail page header"
```

---

### Task 6: Add Start Round modal HTML

**Files:**
- Modify: `src/web/views/tournaments/detail.ejs` (after the Schedule modal, around line 255)

**Step 1: Add the Start Round modal HTML**

```ejs
<!-- Start Round Modal -->
<div id="start-round-modal" class="modal-overlay" style="display: none;" onclick="if(event.target === this) closeStartRoundModal()">
	<div class="modal">
		<div class="modal-header">
			<h3 class="modal-title">Start Round</h3>
			<button class="modal-close" onclick="closeStartRoundModal()">&times;</button>
		</div>
		<div class="modal-body">
			<form id="start-round-form">
				<div class="form-group">
					<label for="round-select" class="form-label">Round Number *</label>
					<select id="round-select" class="form-input" required onchange="onRoundChange()">
						<option value="">Loading rounds...</option>
					</select>
					<p class="help-text">Select a round from imported schedules</p>
				</div>
				<div class="form-group">
					<label for="channel-select" class="form-label">Discord Channel *</label>
					<select id="channel-select" class="form-input" required>
						<option value="">Loading channels...</option>
					</select>
					<p class="help-text">Text channel where match threads will be created</p>
				</div>

				<!-- Preview Section -->
				<div id="round-preview-section" style="display: none;">
					<h4 style="margin: 20px 0 12px; font-size: 15px; font-weight: 600; color: var(--text-primary);">
						Preview (<span id="preview-match-count">0</span> matches)
					</h4>
					<div id="preview-warnings" style="display: none;" class="preview-warnings"></div>
					<div class="table-container table-preview">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>Match</th>
									<th>Scheduled Time</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody id="preview-tbody">
							</tbody>
						</table>
					</div>
				</div>
			</form>
		</div>
		<div class="modal-footer">
			<button class="btn btn-secondary" onclick="closeStartRoundModal()">Cancel</button>
			<button class="btn btn-primary" id="btn-confirm-start-round" onclick="confirmStartRound()" disabled>
				Start Round
			</button>
		</div>
	</div>
</div>
```

**Step 2: Commit**

```bash
git add src/web/views/tournaments/detail.ejs
git commit -m "feat: add Start Round modal HTML structure"
```

---

### Task 7: Add JavaScript functions for Start Round modal

**Files:**
- Modify: `src/web/views/tournaments/detail.ejs` (in the script section, before closing script tag)

**Step 1: Add the JavaScript functions**

Find the end of the script section (before `</script>`) and add:

```javascript
// ============================================
// Start Round Functions
// ============================================

let startRoundData = {
	rounds: [],
	channels: [],
	preview: null
};

async function openStartRoundModal() {
	try {
		// Reset state
		startRoundData = { rounds: [], channels: [], preview: null };
		document.getElementById('round-select').innerHTML = '<option value="">Loading rounds...</option>';
		document.getElementById('channel-select').innerHTML = '<option value="">Loading channels...</option>';
		document.getElementById('round-preview-section').style.display = 'none';
		document.getElementById('btn-confirm-start-round').disabled = true;

		// Show modal
		document.getElementById('start-round-modal').style.display = 'flex';

		// Fetch rounds and channels in parallel
		const [roundsRes, channelsRes] = await Promise.all([
			Dot.API.get(`/api/tournaments/${tournamentId}/rounds`),
			Dot.API.get(`/api/tournaments/${tournamentId}/channels`)
		]);

		startRoundData.rounds = roundsRes.data || [];
		startRoundData.channels = channelsRes.data || [];

		// Populate rounds dropdown
		const roundSelect = document.getElementById('round-select');
		roundSelect.innerHTML = '<option value="">Select a round...</option>';
		startRoundData.rounds.forEach(round => {
			const option = document.createElement('option');
			option.value = round;
			option.textContent = `Round ${round}`;
			roundSelect.appendChild(option);
		});

		// Populate channels dropdown
		const channelSelect = document.getElementById('channel-select');
		channelSelect.innerHTML = '<option value="">Select a channel...</option>';
		startRoundData.channels.forEach(channel => {
			const option = document.createElement('option');
			option.value = channel.id;
			option.textContent = channel.name;
			channelSelect.appendChild(option);
		});

	} catch (error) {
		console.error('Failed to open Start Round modal:', error);
		const errorMsg = error.response?.data?.error || 'Failed to load data';
		Dot.Toast.error(errorMsg);
		closeStartRoundModal();
	}
}

function closeStartRoundModal() {
	document.getElementById('start-round-modal').style.display = 'none';
	startRoundData = { rounds: [], channels: [], preview: null };
}

async function onRoundChange() {
	const roundSelect = document.getElementById('round-select');
	const channelSelect = document.getElementById('channel-select');
	const round = roundSelect.value;

	// Hide preview and disable confirm until both are selected
	document.getElementById('round-preview-section').style.display = 'none';
	document.getElementById('btn-confirm-start-round').disabled = true;

	if (!round) return;

	// Enable confirm if channel is also selected
	if (channelSelect.value) {
		await loadRoundPreview(round);
	}
}

async function loadRoundPreview(round) {
	try {
		const response = await Dot.API.get(`/api/tournaments/${tournamentId}/rounds/${round}/preview`);
		startRoundData.preview = response.data;

		// Show warnings if any
		const warningEl = document.getElementById('preview-warnings');
		if (response.data.warning) {
			warningEl.textContent = response.data.warning;
			warningEl.style.display = 'block';
		} else {
			warningEl.style.display = 'none';
		}

		// Update match count
		document.getElementById('preview-match-count').textContent = response.data.matchCount;

		// Populate preview table
		const tbody = document.getElementById('preview-tbody');
		tbody.innerHTML = response.data.matches.map(m => {
			const dateObj = m.scheduledTime ? new Date(m.scheduledTime) : null;
			const formattedDate = dateObj ? dateObj.toLocaleString(undefined, {
				weekday: 'short', month: 'short', day: 'numeric',
				hour: '2-digit', minute: '2-digit'
			}) : 'Not set';

			const statusClass = m.threadId ? 'text-success' : 'text-secondary';
			const statusText = m.threadId ? 'Thread created' : 'Not started';

			return `
				<tr>
					<td><strong>#${m.matchId}</strong></td>
					<td>${formattedDate}</td>
					<td class="${statusClass}">${statusText}</td>
				</tr>
			`;
		}).join('');

		// Show preview section
		document.getElementById('round-preview-section').style.display = 'block';

		// Enable confirm button
		document.getElementById('btn-confirm-start-round').disabled = false;

	} catch (error) {
		console.error('Failed to load round preview:', error);
		const errorMsg = error.response?.data?.error || 'Failed to load preview';
		Dot.Toast.error(errorMsg);
	}
}

async function confirmStartRound() {
	const round = document.getElementById('round-select').value;
	const channelId = document.getElementById('channel-select').value;

	if (!round || !channelId) {
		Dot.Toast.error('Please select both a round and a channel');
		return;
	}

	try {
		const btn = document.getElementById('btn-confirm-start-round');
		btn.disabled = true;
		btn.textContent = 'Starting...';

		const response = await Dot.API.post(`/api/tournaments/${tournamentId}/rounds/${round}/start`, {
			channelId
		});

		const data = response.data;
		let message = `Successfully created ${data.createdCount} of ${data.totalCount} match threads!`;

		if (data.errors && data.errors.length > 0) {
			message += ` Some matches had errors: ${data.errors.slice(0, 2).join(', ')}`;
			if (data.errors.length > 2) {
				message += ` and ${data.errors.length - 2} more`;
			}
		}

		Dot.Toast.success(message);
		closeStartRoundModal();

		// Reload data to show updated thread IDs
		await loadTournamentData();

	} catch (error) {
		console.error('Failed to start round:', error);
		const errorMsg = error.response?.data?.error || 'Failed to start round';
		Dot.Toast.error(errorMsg);
	} finally {
		const btn = document.getElementById('btn-confirm-start-round');
		btn.disabled = false;
		btn.textContent = 'Start Round';
	}
}

// Also enable confirm when channel changes and round is already selected
document.addEventListener('DOMContentLoaded', () => {
	const channelSelect = document.getElementById('channel-select');
	if (channelSelect) {
		channelSelect.addEventListener('change', () => {
			const round = document.getElementById('round-select').value;
			if (round) {
				loadRoundPreview(round);
			}
		});
	}
});
```

**Step 2: Commit**

```bash
git add src/web/views/tournaments/detail.ejs
git commit -m "feat: add JavaScript functions for Start Round modal"
```

---

### Task 8: Verify MatchSchedule entity structure

**Files:**
- Check: `src/database/orm/MatchSchedule.ts`

**Step 1: Check entity structure**

Run: `cat src/database/orm/MatchSchedule.ts`

Look for these fields:
- `roundNumber` - Used to group schedules by round
- `player1ChallongeId` / `player2ChallongeId` - Used to look up player names

**Step 2: If roundNumber is missing, add it**

Add to MatchSchedule entity:

```typescript
@Column({ nullable: true })
roundNumber?: number;
```

**Step 3: If player challonge IDs are missing, note for documentation**

If player linking fields don't exist, update the plan notes to use simplified thread names (just match IDs).

**Step 4: Commit if changes made**

```bash
git add src/database/orm/MatchSchedule.ts
git commit -m "feat: add roundNumber field to MatchSchedule entity"
```

---

### Task 9: Test the implementation

**Files:**
- No file changes - testing only

**Step 1: Build the project**

Run: `npm run build`

Expected: Clean build with no errors

**Step 2: Start the web server (or restart if running)**

Run: `npm run web` (or appropriate command)

Expected: Server starts successfully

**Step 3: Manual test in browser**

1. Navigate to tournament detail page
2. Click "Start Round" button
3. Verify modal opens
4. Verify round dropdown populates from schedules
5. Verify channel dropdown populates from Discord
6. Select a round and channel
7. Verify preview shows matches
8. Click "Start Round"
9. Verify Discord threads are created
10. Verify success message appears
11. Verify schedules table updates with thread IDs

**Step 4: Check for any console errors**

Open browser DevTools and verify no errors in console.

**Step 5: Verify Discord threads created**

Check Discord server for the created threads and verify:
- Thread names are correct
- Players are pinged (if enrolled)
- Scheduled time is included
- Thread IDs are saved to MatchSchedule records

**Step 6: Document any issues found**

If issues found, create tasks to fix them.

---

## Summary

This plan implements the Start Round feature in 9 tasks:

1. ✅ API endpoint to fetch Discord channels
2. ✅ API endpoint to get available round numbers
3. ✅ API endpoint to preview round matches
4. ✅ API endpoint to start a round (create threads)
5. ✅ UI: Start Round button in header
6. ✅ UI: Modal HTML structure
7. ✅ UI: JavaScript functions
8. ✅ Verify MatchSchedule entity has required fields
9. ✅ Test the complete implementation

**Total estimated time:** 45-60 minutes
**Files modified:** 3
**Files created:** 0
**Dependencies:** None new (uses existing Discord.js, Challonge integration)
