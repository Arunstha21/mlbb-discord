# DiscordDot MLBB - Visual Flow Diagrams

## Player Verification Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PLAYER VERIFICATION                          │
└─────────────────────────────────────────────────────────────────────┘

                              dot!check
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Check enrolled players │
                    │  by username/name      │
                    │  (local database)      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    Match found?         │
                    └───────────┬─────────────┘
                                │
                ┌───────────────┴───────────────┐
                │ YES                           │ NO
                ▼                               ▼
    ┌───────────────────────┐       ┌──────────────────┐
    │ Auto-verify!         │       │ Create Ticket    │
    │ Grant Participant    │       │ Channel          │
    │ Role                 │       └────────┬─────────┘
    └───────────────────────┘                │
                                                ▼
                                      ┌─────────────────┐
                                      │ In ticket:      │
                                      │ dot!email       │
                                      │ <address>       │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ Send OTP Email  │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ dot!verify      │
                                      │ <otp>           │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ Verify OTP      │
                                      │ Grant Role      │
                                      └─────────────────┘

```

## Score Reporting Flow

```
┌─────────────────────────────────────────────────────────────────────┐
                          SCORE REPORTING                             │
└─────────────────────────────────────────────────────────────────────┘

                        Player: dot!score ID 2-1
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Bot posts score report │
                    │  Pings opponent         │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Opponent clicks button │
                    └───────────┬─────────────┘
                                │
                ┌───────────────┴───────────────┐
                │ Approve                       │ Reject
                ▼                               ▼
    ┌───────────────────────┐       ┌──────────────────┐
    │ Mark as approved      │       │ Mark rejected    │
    │ Check autoPush setting│       │ Players discuss  │
    └───────────┬───────────┘       │ and resubmit     │
                │                    └──────────────────┘
    ┌───────────┴─────────────┐
    │ autoPush = true        │ autoPush = false
    ▼                          ▼
┌──────────────────┐   ┌──────────────────┐
│ Submit to        │   │ Send to review   │
│ Challonge        │   │ channel          │
│ ✓ Complete!      │   │ TO approves      │
└──────────────────┘   │ via button       │
                       └──────────────────┘

    (10 min timeout = auto-approve)

```

## Tournament Organizer Setup Flow

```
┌─────────────────────────────────────────────────────────────────────┐
                    TOURNAMENT ORGANIZER SETUP                         │
└─────────────────────────────────────────────────────────────────────┘

                   1. Create on Challonge
                            │
                            ▼
                   2. Prepare CSV (email, name, team)
                            │
                            ▼
              ┌─────────────────────────────┐
              │  dot!enroll ID [attach CSV] │
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Players enrolled in DB     │
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Add teams to Challonge     │
              │  bracket manually           │
              │  (team names, not players)  │
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Players run dot!check      │
              │  to verify via username     │
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  dot!addhost ID @cohost     │
              │  (optional)                 │
              └─────────────────────────────┘

```

## Round Management Flow

```
┌─────────────────────────────────────────────────────────────────────┐
                        ROUND MANAGEMENT                              │
└─────────────────────────────────────────────────────────────────────┘

                   dot!round ID #channel 1
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Fetch matches from         │
              │  Challonge for round        │
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Show preview of matches    │
              │  Confirm / Cancel buttons   │
              └─────────────┬───────────────┘
                            │
                            │ (Confirm)
                            ▼
              ┌─────────────────────────────┐
              │  Create thread per match    │
              │  Ping verified players      │
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Players use dot!score      │
              │  in their match threads     │
              └─────────────────────────────┘

```

## Command Access Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
                         COMMAND ACCESS                               │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────┬─────────┬─────────┐
                    │ Player  │ Host    │ TO      │
Command             │         │         │         │
─────────────────────────────────────────────────────────────────────
dot!check           │    ✓    │         │         │
dot!email           │    ✓    │         │         │
dot!verify          │    ✓    │         │         │
dot!score           │    ✓    │         │    ✗    │
dot!coin            │    ✓    │    ✓    │    ✓    │
dot!toss            │    ✓    │    ✓    │    ✓    │ (alias for coin)
dot!forcescore      │         │         │    ✓    │
dot!enroll          │         │         │    ✓    │
dot!sync            │         │    ✓    │    ✓    │
dot!update          │         │    ✓    │    ✓    │
dot!addhost         │         │         │    ✓    │
dot!removehost      │         │         │    ✓    │
dot!list            │         │         │    ✓    │
dot!info            │    ✓    │    ✓    │    ✓    │
dot!round           │         │    ✓    │    ✓    │
dot!close           │         │         │    ✓    │
dot!help            │    ✓    │    ✓    │    ✓    │
                    └─────────┴─────────┴─────────┘

Legend: ✓ = Can use | Empty = Cannot use
```

## Error Recovery Flow

```
┌─────────────────────────────────────────────────────────────────────┐
                          ERROR HANDLING                              │
└─────────────────────────────────────────────────────────────────────┘

                    Command Error Occurs
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Error Type?                │
              └─────────────┬───────────────┘
                            │
    ┌───────────┬───────────┼───────────┬───────────┐
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
UserError   Challonge   FetchError  Other      Success
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
Reply with   Reply with  Reply with  Log error   Continue
message      "try again" "try again" & alert    flow
            │           │           TO
            └───────────┴───────────┘

```
