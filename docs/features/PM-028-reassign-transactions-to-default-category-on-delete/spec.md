# Reassign Transactions to Default Category on Delete - PM-028

## Description

When a user deletes a category, its transactions must not be left uncategorized. Instead, they are reassigned to a default "Outros" category (icon `tag`, color `#2563EB`), created on demand the first time it's needed for that user.

## Users

Any user managing categories who deletes one that still has transactions attached to it.

## Acceptance Criteria

* [x] Deleting a category reassigns all of its transactions to that user's "Outros" category
* [x] The "Outros" category is created on demand (per user) the first time a deletion needs it, with title `Outros`, icon `tag`, color `#2563EB`
* [x] If the user already has an "Outros" category, it is reused — never duplicated (`(userId, title)` stays unique)
* [x] Deleting the "Outros" category itself is still allowed; its own transactions fall back to no category (existing `SetNull` behavior), since there's nothing left to reassign into

## Out of Scope

- Letting the user rename, configure, or opt out of the default category
- Auto-creating "Outros" at registration time (it's created lazily, on first use)
- Protecting the "Outros" category from being deleted
