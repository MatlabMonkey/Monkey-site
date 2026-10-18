# Todo v2 operating loops

## Restart mode

- Restart mode is entered explicitly and temporarily replaces the normal task views with a forgiving 10-minute recovery path.
- Its authenticated, read-only summary includes only real deadlines before the current `TODO_TIME_ZONE` date, the Inbox count, and Waiting tasks unchanged for at least seven days.
- Each task section shows at most five oldest items while retaining the full eligible count, so a long backlog is summarized instead of exposed as a wall.
- Task changes happen only through the existing explicit task controls and authenticated update route. Entering or leaving restart mode never mutates a task.
- The three steps are missed commitments, a link into Inbox, and stale Waiting follow-ups. A clear state is shown when none need attention.

## Daily review

- Daily review is an explicitly entered, read-only five-minute reset using the current `TODO_TIME_ZONE` date.
- It first shows open deadlines due today or earlier that are outside Today, then the current Today list, then the exact Inbox count.
- Each task section shows at most five items while preserving exact counts. All changes still use existing explicit authenticated task actions and append-only history.
- The flow does not schedule, complete, or otherwise mutate tasks automatically.

## Remaining item 3 work

- Add the weekly Inbox, Waiting, and stale-work review flow.
