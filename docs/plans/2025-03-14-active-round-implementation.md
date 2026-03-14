# Active Round-Based Thread Addition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `activeRound` tracking to tournaments so newly verified users are only added to match threads for the currently active round.

**Architecture:** Add nullable `activeRound` integer field to `ChallongeTournament` entity. Set it when creating round threads via `dot!round`. Filter `MatchSchedule` queries by `activeRound` when adding verified users to threads.

**Tech Stack:** TypeORM, Discord.js, TypeScript

---

## Task 1: Add activeRound Field to ChallongeTournament Entity

**Files:**
- Modify: `src/database/orm/ChallongeTournament.ts`

**Step 1: Add the activeRound column**

Add this field after the `participantRoleName` field (around line 67):

```typescript
/// The currently active round for this tournament. Null means no round is active.
/// Used to determine which match threads newly verified users should be added to.
@Column({ nullable: true })
activeRound?: number;
```

**Step 2: Verify the change compiles**

Run: `npm run build`
Expected: No TypeScript errors, successful build

**Step 3: Commit**

```bash
git add src/database/orm/ChallongeTournament.ts
git commit -m "feat(tournament): add activeRound field to track current round"
```

---

## Task 2: Set Active Round When Creating Round Threads

**Files:**
- Modify: `src/commands/round.ts` (around line 252, in the confirm_round handler)

**Step 1: Add activeRound assignment**

After the loop that creates threads (after line 250, before the final edit message at line 252), add:

```typescript
// Set this round as the active round for the tournament
tournament.activeRound = roundNumber;
await tournament.save();
logger.info(`Set active round to ${roundNumber} for tournament ${id}`);
```

**Step 2: Verify the change compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/commands/round.ts
git commit -m "feat(round): auto-set activeRound when creating round threads"
```

---

## Task 3: Filter by Active Round in addUserToMatchThreads

**Files:**
- Modify: `src/util/matchThreads.ts`

**Step 3a: Add early return if no active round**

After fetching the tournament (after line 40), add:

```typescript
// If no round is active, don't add user to any threads
if (tournament.activeRound === null || tournament.activeRound === undefined) {
    logger.info(`No active round for tournament ${player.tournamentId}, skipping thread addition`);
    return 0;
}
```

**Step 3b: Filter schedules query by active round**

Modify the schedules query (around line 43-48) to filter by round:

```typescript
// Get all match schedules for this tournament's active round that have threads
const schedules = await MatchSchedule.find({
    where: {
        tournamentId: player.tournamentId,
        roundNumber: tournament.activeRound,  // Filter by active round
        threadId: Not(IsNull())
    }
});
```

**Step 3c: Update logging for clarity**

Update the log message (around line 96) to indicate active round:

```typescript
await thread.send(`👋 <@${member.id}> has been verified for **${player.team || player.name}** and added to this match thread (Round ${tournament.activeRound}).`);
```

**Step 3d: Verify the changes compile**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3e: Commit**

```bash
git add src/util/matchThreads.ts
git commit -m "feat(verification): only add users to active round match threads"
```

---

## Task 4: Database Migration (if needed)

**Files:**
- Create: N/A (TypeORM auto-creates columns in SQLite)
- Note: No migration needed for SQLite - TypeORM will auto-add the column on next startup

**Step 1: Verify schema sync**

Run the bot briefly and check that the column was created:
```bash
# Check SQLite database for new column
sqlite3 <your-db-file> ".schema challonge_tournament"
```

Expected: Schema should include `activeRound INTEGER` column

**Step 2: Commit schema change (if version controlled)**

If schema file is tracked:
```bash
git add <schema-file>
git commit -m "chore: auto-apply activeRound column via TypeORM sync"
```

---

## Task 5: Testing

**Files:**
- Manual testing required (no automated tests exist for this feature)

**Step 1: Test - User verifies before any round starts**

1. Start tournament, do NOT run `dot!round`
2. User runs `dot!enroll` and `dot!email`, receives OTP
3. User runs `dot!verify <otp>`
Expected: User verifies successfully, NO thread messages

**Step 2: Test - User verifies after round starts**

1. Run `dot!round #channel 1`
2. Another user runs `dot!enroll`, `dot!email`, `dot!verify <otp>`
Expected: User is added ONLY to Round 1 match threads

**Step 3: Test - Round transition**

1. Run `dot!round #channel 2`
2. Another user verifies
Expected: User is added ONLY to Round 2 match threads (not Round 1)

**Step 4: Test - Active round persists**

1. Check database: `activeRound` should be 2
2. Restart bot
3. Another user verifies
Expected: User added to Round 2 threads (activeRound persisted)

**Step 5: Document test results**

Add notes to design doc:
```bash
# Update docs/plans/2025-03-14-active-round-verification-design.md
# Add "## Testing Results" section with test outcomes
```

---

## Summary

This implementation:
1. Adds `activeRound` field to track current round
2. Auto-sets active round when `dot!round` creates threads
3. Filters verified user thread additions to active round only
4. Handles edge cases (no active round, round transitions)

**Total commits: 3** (database schema, round command, verification logic)
