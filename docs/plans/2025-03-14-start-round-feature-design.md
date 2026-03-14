# Start Round Feature Design

**Date:** 2025-03-14
**Status:** Approved

## Overview

Add a "Start Round" button in the tournament detail page header that allows organizers to create Discord match threads for a specific round using data already imported from schedules.

## User Story

As a tournament organizer, I want to start a round from the web admin panel so that I don't need to use Discord commands to create match threads.

## Components

### 1. Header Action Button
- **Location:** Next to "Sync from Challonge" button in the tabs header
- **Action:** Opens a modal for round configuration
- **Icon:** Play icon or similar

### 2. Start Round Modal

**Fields:**
- **Round dropdown:** Populated with unique round numbers from existing MatchSchedule records
- **Channel dropdown:** Fetches text channels from the tournament's Discord server via API
- **Preview section:** Shows matches that will have threads created (teams, scheduled times)
- **Confirm/Cancel buttons**

**Validation:**
- Block if no schedules exist for the tournament
- Show warning if some players aren't enrolled (but allow proceeding)

### 3. Backend API Endpoints

Update `src/web/routes/rounds.ts`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tournaments/:id/channels` | Fetch Discord text channels for the server |
| GET | `/api/tournaments/:id/rounds` | Get available round numbers from schedules |
| GET | `/api/tournaments/:id/rounds/:round/preview` | Preview matches for a round |
| POST | `/api/tournaments/:id/rounds/:round/start` | Start the round (create threads) |

## User Flow

1. User clicks "Start Round" → Modal opens
2. Round dropdown auto-populated from schedules (unique round numbers)
3. Channel dropdown populated from Discord API (text channels only)
4. User selects round + channel → Preview shows match details
5. **Validation:** If no schedules exist → Block with error message
6. User confirms → Backend creates Discord threads
7. Success toast shows count of threads created

## Implementation Notes

### Round Number Source
- Use unique round numbers from `MatchSchedule` records
- No need to fetch from Challonge (schedules already imported)

### Discord Integration
- Reuse existing thread creation logic from `src/commands/round.ts`
- Bot client must be available via `getBotClient()`
- Create private threads with auto-archive duration of 1 day

### Error Handling
- **No schedules:** Block with error message
- **No enrolled players:** Warning but allow continuation
- **Discord API errors:** Show specific error message

### Preview Data
For each match in the round:
- Match ID
- Team/Player names (from Challonge player lookup)
- Scheduled time (from MatchSchedule)
- Enrolled player status (linked/unlinked)

## Success Criteria

- [ ] "Start Round" button visible in tournament detail page header
- [ ] Modal opens and loads round numbers from schedules
- [ ] Channel dropdown successfully fetches Discord channels
- [ ] Preview accurately shows match information
- [ ] Confirm successfully creates Discord threads
- [ ] Threads are properly associated with schedules (threadId saved)
- [ ] Success feedback provided to user
