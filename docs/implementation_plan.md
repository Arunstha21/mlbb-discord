# Removing Team Roles: Implementation Plan

This document outlines the comprehensive plan to migrate away from Discord-based Team Roles to a database-backed direct ping system. This change is necessary to bypass Discord's hard limit of 250 roles per server, allowing tournaments with 256+ teams to function correctly.

## Problem Statement

Currently, the bot creates a new Discord role for every team when `dot!enroll` is run. With a limit of 250 roles per server, enrolling 256 teams causes role creation to fail, breaking the enrollment process and preventing players from being properly assigned to their teams in Discord.

## Solution Overview

We will remove the concept of Discord Team Roles entirely. Instead, the bot will rely purely on the existing `EnrolledPlayer` database to know which players belong to which team. 
- When a match starts, the bot will ping the players directly (e.g., `@User1 @User2`) instead of pinging a `@Team Role`.
- To allow TOs to communicate with specific teams, we will introduce a new `dot!pingteam` command that looks up the team members and pings them.

## User Review Required

> [!WARNING]
> This is a significant change to how the tournament operates in Discord.
> **Before proceeding, please review the following impacts:**
> 1. Teams will no longer have a colored role in the server sidebar.
> 2. TOs cannot manually ping `@Team Name` in general chat anymore. They must use the new `dot!pingteam` command.
> 3. Does your server rely on Team Roles for private team text channels? If so, we need to adapt this plan to create Private Threads instead (adding users to the thread directly).
> 
> **Are you ready to proceed with these changes?**

## Phase 1: Removing Role Creation & Assignment

We need to strip out all code that attempts to create or manage Team Roles.

### Database / Utils
#### [MODIFY] [src/util/constants.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/util/constants.ts)
- Remove team role configurations if any exist.

#### [MODIFY] [src/util/discord.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/util/discord.ts)
- **Delete** the `assignTeamRole` function entirely.

### Core Commands (Role Assignment)
#### [MODIFY] [src/commands/enroll.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/commands/enroll.ts)
- Remove the block of code that fetches existing roles and creates new ones for `teamsToCreate`.
- Update the success message to no longer mention creating team roles.

#### [MODIFY] [src/commands/check.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/commands/check.ts)
- Remove the `assignTeamRole` call.
- Remove references to team roles in the success message.

#### [MODIFY] [src/commands/verify.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/commands/verify.ts)
- Remove the `assignTeamRole` call.
- Remove references to team roles in the success message.

#### [MODIFY] [src/commands/verifyPlayer.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/commands/verifyPlayer.ts) & [src/slash/verifyPlayer.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/slash/verifyPlayer.ts)
- Remove the prompt asking to create a team role.
- Remove the `assignTeamRole` logic.
- Remove references to team roles in the success message.

#### [MODIFY] [src/events/guildMemberAdd.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/events/guildMemberAdd.ts)
- Remove logic that attempts to auto-assign team roles when a user rejoins.

## Phase 2: Updating Match Threads

When a TO starts a round, the bot creates a thread for each match. It currently pings the team roles. We need to change this to ping the individual players.

#### [MODIFY] [src/commands/round.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/commands/round.ts)
- Instead of using `teamRoleMentions`, query the `EnrolledPlayer` database for all players where `team = challongeMatch.player1.name` and their discord ID is linked (they are verified).
- Generate a string of individual user mentions (`<@discordId> <@discordId> ...`) for both Team 1 and Team 2.
- Update the thread creation message to use these direct user mentions instead of role mentions.

## Phase 3: The New `pingteam` Command

To replace the ability of TOs to easily notify a specific team, we will add a new command.

#### [NEW] `src/commands/pingteam.ts`
- **Arguments**: `<tournamentId> <teamName> <message>`
- **Logic**: 
  1. Look up all `EnrolledPlayer` records for the given `tournamentId` and `teamName`.
  2. Filter for players who have linked a Discord account.
  3. Send a message to the current channel containing the provided `<message>` and pinging all found `<@discordId>`s.

## Phase 4: Veto System Adjustments (If Applicable)

The Veto system often relies on Team Roles to manage permissions during the map/hero ban phase. This will need to be refactored to check the user's database team rather than their Discord roles.

#### [MODIFY] [src/slash/veto.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/slash/veto.ts)
- Remove requirements/checks for team role inputs.

#### [MODIFY] [src/veto/VetoEngine.ts](file:///Users/arunshrestha/Development/discorddot-mlbb/src/veto/VetoEngine.ts) & `src/veto/buttons/*.ts`
- Change permission checks. Instead of checking if `interaction.member.roles.cache.has(teamRoleId)`, query the database: Does the user's `discordId` match an enrolled player on `currentTeamTurn`?

## Verification Plan

### Automated/Local Tests
1. **Enrollment**: Run `dot!enroll` with a CSV containing new teams. Verify no Discord roles are created and no errors are thrown.
2. **Verification**: Run `dot!check` and `dot!verify`. Verify the user receives the Participant role but no errors occur regarding missing Team roles.
3. **Round Start**: Run `dot!round`. Verify the created match threads correctly ping the *individual users* on the team, not a role.
4. **Ping Team**: Run `dot!pingteam <id> <team> test message`. Verify the bot successfully pings all discord-linked users on that team.

### Manual Verification
- Deploy to a test server.
- Run a simulated tournament flow through Challonge.
- Verify that users can play their matches entirely without team roles existing.
