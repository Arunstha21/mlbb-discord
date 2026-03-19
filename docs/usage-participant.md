# Commands for participants

[Back to main](../README.md)

## Table of contents
1. [Help](#help)
1. [Verifying for a tournament](#verifying-for-a-tournament)
1. [During a tournament](#during-a-tournament)
1. [Submitting scores](#submitting-scores)

## Reference

### Help

Explicitly ping Dot (not Discord replies) or send `!help` in a channel with Dot
or direct messages with Dot to get a link back here to Dot documentation.

This also shows what revision of Dot's code is currently running, which is more
useful for developer diagnostics.

### Verifying for a tournament

To participate in a Mobile Legends tournament, you need to verify your email address with the bot.

**Step 1: Request OTP verification**
```
!email your_email@example.com
```
Send this command in a server channel with Dot or in direct messages.
An OTP (One-Time Password) will be sent to your email address.

**Step 2: Submit OTP**
```
!verify 123456
```
Replace `123456` with the OTP you received in your email.

Once verified, you will be linked to the tournament roster on Challonge and receive
a participant role for the tournament on the server.

### During a tournament

The tournament host decides when each round of a tournament begins. When a round begins, you will
be pinged from the announcement channel with a link to the bracket on Challonge.
If the hosts choose to do so, Dot will try to direct message you and your opponent about
your pairing, but it's up to you to contact your opponent and play your match within the round's
time limit, if any.

If there is a round time limit for this tournament, Dot will also post it to the same channel
and count down every 5 seconds. All participants will be pinged when the time limit is reached.

### Submitting scores
```
!score [id]|score
```
Replace _score_ with the appropriate parameter below.

The _id_ parameter is optional. If there is only one tournament in the server,
you can omit it and Dot will automatically use that tournament. If there are
multiple tournaments, you must specify the tournament ID.

_id_ should be the Challonge ID for the tournament as reported by Dot.
This is NOT the name of the tournament.

_score_ should be the score in your favour. Ties are accepted in Swiss.
For example, if the score for the match was `2-1` in your favour, you should
report a `2-1` and your opponent should report a `1-2`.

Each round, after the match is over, both you and your opponent need to use
this command to submit your scores to tournament hosts and Challonge.
If your scores disagree, both of you will need to resubmit.

You can copy and paste the exact command for your tournament from the **Report scores**
guide that Dot posts in the announcement channel when the tournament begins.

---

[Back to main](../README.md)
