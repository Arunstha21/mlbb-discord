# Active Round-Based Thread Addition

## Overview

Add an `activeRound` field to tournaments and modify the verification flow to only add newly verified users to match threads for the currently active round. When a round is started via `dot!round`, it automatically becomes the active round.

## Problem

Currently, when a user verifies after match threads have been created, the bot adds them to **all** historical match threads for that tournament. This is noisy and unnecessary - users should only be added to threads for the currently active round.

## Requirements

1. Track which round is currently active for each tournament
2. Only add verified users to match threads for the active round
3. Auto-set active round when `dot!round` creates threads
4. If no active round is set, skip adding to any threads (not fall back to all threads)

## Database Changes

### ChallongeTournament Entity

Add new field:

```typescript
@Column({ nullable: true })
activeRound?: number;
```

This nullable field stores which round is currently "active" for the tournament. When null, no round is considered active.

## Implementation Changes

### 1. Round Creation (`src/commands/round.ts`)

After successfully creating threads (around line 252), set the active round:

```typescript
// Set this round as active
tournament.activeRound = roundNumber;
await tournament.save();
```

### 2. User Verification (`src/util/matchThreads.ts`)

Modify `addUserToMatchThreads` function:

```typescript
// After fetching tournament (line 34-40)
if (tournament.activeRound === null) {
    return 0; // No active round, skip adding to threads
}

// Modify schedules query (line 43-48) to filter by active round
const schedules = await MatchSchedule.find({
    where: {
        tournamentId: player.tournamentId,
        roundNumber: tournament.activeRound,  // NEW: Filter by active round
        threadId: Not(IsNull())
    }
});
```

## Error Handling & Edge Cases

### Round Transition
- When starting a new round, the previous `activeRound` gets overwritten
- Old round threads remain accessible to users who were already added
- Only newly verified users get filtered to the current active round

### Tournament Without Active Round
- New tournaments start with `activeRound = null`
- Early verifiers won't be added to any threads until first round starts
- This is intentional behavior

### Active Round Without Threads
- If `activeRound` is set but no threads exist for that round yet
- Query returns empty schedule array → returns 0 threads added
- User verification succeeds but no thread messages sent

### Race Conditions
- `activeRound` is a simple integer field → atomic writes in TypeORM
- No special locking needed

## Test Cases

1. **User verifies before any round starts** → not added to any threads
2. **User verifies after round 1 starts** → added only to round 1 threads
3. **Round 2 starts, user verifies** → added only to round 2 threads
4. **User was already added to round 1 thread** → doesn't get duplicate entries
5. **Round 1 active, user verifies → then round 2 starts** → user not auto-added to round 2

## Files to Modify

1. `src/database/orm/ChallongeTournament.ts` - Add `activeRound` field
2. `src/commands/round.ts` - Set active round when creating threads
3. `src/util/matchThreads.ts` - Filter schedules by active round
