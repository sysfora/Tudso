# PocketBase Setup

Tudso uses PocketBase as the single source of truth for all persistent application data.

## Import collections

1. Open the PocketBase Admin UI.
2. Go to **Settings → Import collections**.
3. Upload `pb_schema.json` from this repo.
4. Confirm the import (merge is fine; `users` already exists on a fresh PocketBase and will be updated, not created).

The schema matches PocketBase v0.23+ export format and includes:

| Collection | Access |
|---|---|
| `users` | Auth collection (email/password) |
| `profiles` | Owner read/write |
| `resumes` | Owner read/write |
| `conversations` | Owner read/write |
| `messages` | Owner read/write |
| `devices` | Owner read/write |
| `user_context` | Owner read/write |
| `onboarding` | Owner read/write |
| `subscriptions` | Owner read, admin write |
| `entitlements` | Owner read, admin write |
| `usage` | Owner read, admin write |
| `desktop_sessions` | Admin only |

After import, enable Google OAuth on `users` if you want social login.

## Required Collections

### `users` (auth)
Email/password auth collection (`_pb_users_auth_`). Included in `pb_schema.json` so import can merge it with PocketBase's default users collection. Enable Google OAuth on this collection after import if you want social login.

| Field | Type | Notes |
|-------|------|-------|
| email | email | required, unique |
| password | password | min 8 |
| name | text | |
| avatar | file | jpeg/png/svg/gif/webp |
| verified | bool | |
| emailVisibility | bool | |
| plan | select | `free`, `pro`, `premium` (default `free`) |
| planStatus | select | `active`, `trialing`, `past_due`, `canceled`, `unpaid` |
| stripeCustomerId | text | hidden; set by billing |
| stripeSubscriptionId | text | hidden; set by billing |
| aiAccess | bool | |
| realtimeAccess | bool | |
| screenAnalysis | bool | |
| audioAccess | bool | |
| usageLimits | json | daily caps |
| expiresAt | date | current period end |
| onboardingComplete | bool | |

Billing fields on `users` are denormalized from `entitlements` / `subscriptions`. Owners cannot change them through the API; only the backend (admin) can.

### `profiles`
Stores user personalization data.

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | single, required |
| preferredName | text | |
| profession | text | |
| role | text | |
| industry | text | |
| education | text | |
| skills | json | array of strings |
| goals | json | array of strings |
| communicationStyle | select | values: concise, balanced, detailed |
| technicalLevel | select | values: beginner, intermediate, advanced |
| formal | bool | |
| stepByStep | bool | |
| examples | bool | |
| explainTerms | bool | |
| customContext | text | |

API rules:
```text
create: @request.auth.id != "" && user = @request.auth.id
update: user = @request.auth.id
delete: user = @request.auth.id
view: user = @request.auth.id
list: user = @request.auth.id
```

### `resumes`
Stores uploaded resume files and parsed data.

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| file | file | optional legacy PocketBase file |
| filePath | text | object key, e.g. `resumes/{userId}/{uuid}.pdf` |
| storage | select | `r2` or `local` |
| extractedText | text | max 100000; PocketBase defaults max 0 to 5000 |
| parsedData | json | structured resume data plus `rawText`, `filePath`, `storage` |

API rules: owner-only read/write.

### `conversations`

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| title | text | required |

API rules: owner-only.

### `messages`

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| conversation | relation -> conversations | required |
| role | select | values: user, assistant, system |
| content | text | required |
| metadata | json | |

API rules: owner-only.

### `subscriptions`
Managed by backend/webhooks only.

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| stripeCustomerId | text | |
| stripeSubscriptionId | text | |
| priceId | text | |
| status | select | active, trialing, past_due, canceled, incomplete, incomplete_expired, unpaid |
| currentPeriodStart | date | |
| currentPeriodEnd | date | |
| cancelAtPeriodEnd | bool | |

API rules: read-only for owner, write for admin only.

### `entitlements`
Managed by backend/webhooks only.

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| plan | select | free, pro, premium |
| status | select | active, trialing, past_due, canceled, unpaid |
| aiAccess | bool | |
| realtimeAccess | bool | |
| screenAnalysis | bool | |
| audioAccess | bool | |
| usageLimits | json | |
| expiresAt | date | |

API rules: read-only for owner, write for admin only.

### `usage`
Daily usage counters.

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| date | date | required |
| requests | number | default 0 |
| tokens | number | default 0 |
| screenAnalyses | number | default 0 |
| realtimeMinutes | number | default 0 |
| audioMinutes | number | default 0 |

API rules: owner-only read, admin write.

### `devices`

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| deviceId | text | required |
| platform | text | |
| appVersion | text | |
| lastSeen | date | |

API rules: owner-only.

### `desktop_sessions`
Short-lived desktop session tokens.

| Field | Type | Notes |
|-------|------|-------|
| user | relation -> users | required |
| token | text | required, indexed |
| expiresAt | date | required |

API rules: admin only.

## Optional Collections

- `preferences`
- `shortcut_preferences`
- `privacy_preferences`
- `user_context`
- `onboarding`

Use the same owner-only pattern.
