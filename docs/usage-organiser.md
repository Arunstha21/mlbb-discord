# Commands for tournament hosts

[Back to main](../README.md)

Commands have a specific name exactly following the command prefix. If the command accepts parameters,
these are separated from each other by spaces. For the following, any words that are shown as parameters
refer to the _name_ of the parameter, and you should replace them with an appropriate value when you use these commands!

Parameters shown in square brackets `[like this]` are optional.

**Note about tournament IDs**: The `id` parameter is optional when there is only one tournament in the server.
If you have multiple tournaments, you must specify the tournament ID. When the `id` is omitted, Dot will
automatically use the single tournament in the server.

All host commands are scoped to the current server and do not work in direct messages.
Tournaments can only be managed from the server that they were created in;
they cannot be accessed from other servers.

## Index

### Main tournament workflow
1. [!list](#list-ongoing-tournaments)
1. [!addhost](#add-host)
1. [!enroll](#enroll-players-via-csv)
1. [!info](#show-tournament-details)
1. [!round](#proceed-to-the-next-round)
1. [!forcescore](#override-score)

### Tournament administration
1. [!removehost](#remove-host)
1. [!update](#update-tournament-information)

### Informational
1. [!info](#show-tournament-details)
1. [!sync](#synchronise-tournament-info)

## Reference

### List ongoing tournaments
```
!list
```
**Caller permission level**: DOT-TO role

Responds with a list of all preparing and in progress tournaments, including their IDs, names, status, and participant counts.

### Add host
```
!addhost [id] @discordtag
```
**Caller permission level**: host for the tournament (identified by _id_ if multiple tournaments exist)

`@discordtag` must be a valid Discord mention of a user that pings them.

The user is added as a host for the specified tournament, granting them the same permissions as you.
If there's only one tournament in the server, you can omit the _id_ parameter.

### Remove host
```
!removehost [id] @discordtag
```
**Caller permission level**: host for the tournament (identified by _id_ if multiple tournaments exist)

`@discordtag` can be a Discord mention, though it does not have to ping, or the user's ID.

The user is deauthorised as a host for the specified tournament, losing all corresponding permissions.
You cannot remove yourself if you are the only host; there must always be one host to manage the tournament.
If there's only one tournament in the server, you can omit the _id_ parameter.

If a host leaves the tournament server, they are not automatically removed and will regain
powers for their tournaments if they return.

### Enroll players via CSV
```
!enroll [id] <CSV attachment>
```
**Caller permission level**: DOT-TO role

Upload a CSV file containing player enrollment data. The CSV must include columns for `name` and `email`,
and optionally `team` and `discord`.
If there's only one tournament in the server, you can omit the _id_ parameter.

Example CSV format:
```csv
name,email,team,discord
Player One,player1@example.com,Team Alpha,player1#1234
Player Two,player2@example.com,Team Beta,player2#5678
```

### Update tournament information
```
!update [id] name description
```
**Caller permission level**: host for the tournament (identified by _id_ if multiple tournaments exist)

The specified tournament must be in the preparing stage and not have been started.
Updates the name and description for the tournament, affecting the Challonge page
and future tournament information.
If there's only one tournament in the server, you can omit the _id_ parameter.

### Proceed to the next round
```
!round [id] channelId roundNumber
```
**Caller permission level**: host for the tournament (identified by _id_ if multiple tournaments exist)

The `id` parameter is optional. If there's only one tournament in the server, you can omit it.

`channelId` is the Discord channel where match threads will be created.

`roundNumber` is the round number to start (e.g., 1, 2, 3).

If the tournament is in progress, this command will:
1. Fetch all open matches for the specified round from Challonge
2. Create a thread for each match in the specified channel
3. Ping the participants in their respective threads
4. Update the thread message with score reporting instructions

This command helps streamline round management by automatically creating organized threads
for each match and notifying participants.

### Override score
```
!forcescore [id] score @winner
```
**Caller permission level**: host for the tournament (identified by _id_ if multiple tournaments exist)

`score` must be of the form `#-#`, e.g. `2-1`, with the winner's score first.

`@winner` must be a valid Discord mention of a user that pings them.
If there's only one tournament in the server, you can omit the _id_ parameter.

If the tournament is in progress and the user tagged is a participant, the score
for the last match involving the participant is set to `score`, in their favour.
Draws can also be specified, in which case the mention can be either participant.

This command can submit both outstanding scores and overwrite already-submitted ones.
Please note that if the winner's score is lower, Challonge will happily accept
the match outcome, as if playing golf.

### Show tournament details
```
!info [id]
```
**Caller permission level**: everybody

If used in a server and the tournament exists, displays a pretty
embed of the tournament name, description, Challonge link, number of currently
registered participants, format, current status, and hosts.
If there's only one tournament in the server, you can omit the _id_ parameter.

### Synchronise tournament info
```
!sync [id]
```
**Caller permission level**: host for the tournament (identified by _id_ if multiple tournaments exist)

Synchronises the tournament name, description, and participant list stored in
Dot with those stored in the Challonge API. Useful for testing in development
when changes are made to a tournament on Challonge without going through Dot.
If there's only one tournament in the server, you can omit the _id_ parameter.

---

[Back to main](../README.md)
