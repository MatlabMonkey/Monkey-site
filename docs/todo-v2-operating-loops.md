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

## Weekly review

- Weekly review is an explicitly entered, read-only 15-minute flow using the current `TODO_TIME_ZONE` date.
- It shows the oldest Inbox captures, the oldest Waiting commitments, and Today or Later work unchanged for at least 14 days.
- Each section shows at most five items while preserving exact counts, keeping a large backlog bounded and reviewable.
- Every change requires an existing authenticated task action and remains visible in append-only history; entering the flow never changes a task.

Restart mode, daily reset, and weekly review complete the approved forgiving operating-loop slice. None runs automatically or reads production data during local validation.
