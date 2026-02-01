# macOS Widget Research (Future Feature)

> **Status:** Archived for future consideration
> **Decision:** Build in-app Dashboard first (cross-platform, zero friction)
> **Revisit When:** Native Tauri WidgetKit support lands, or after product-market fit

---

## Why Not Now

1. **Build Complexity**: Cannot use `cargo tauri build` alone - requires Xcode schemes, signing, App Groups
2. **Dual Codebase**: Maintaining Rust/TS + Swift is significant overhead
3. **Data Sync**: File-watcher system between Tauri sandbox and widget is fragile
4. **Mac-Only**: Widgets don't help Windows/Linux users

## Widget Design Concepts

### Small Widgets (160x160)

#### 1. Emotion Ring
- Circular visualization of today's dominant emotions
- Shows top 2 emotions from today's entries
- Tap to open journal

#### 2. Streak Counter
- Current journaling streak with flame icon
- Week view with dots for entry days
- Tap to write today's entry

#### 3. Quick Entry
- Daily prompt or greeting
- Single tap to open editor with prompt

### Medium Widgets (340x160)

#### 4. Week in Emotions
- 7-day emotion grid with emoji indicators
- Trend summary (most improved/declined emotions)
- Tap day to view that entry

#### 5. On This Day
- Snippet from entry on same date last year
- Shows emotions from that entry
- Nostalgia/reflection feature

#### 6. Chat Teaser
- AI-generated insight snippet
- Tap to open chat for deeper reflection

### Large Widgets (340x340)

#### 7. Monthly Overview
- Calendar heatmap (color = dominant emotion)
- Entry count and streak stats
- Top emotions for the month

## Data Requirements

| Widget | Data Needed | Tauri Command |
|--------|-------------|---------------|
| Emotion Ring | Today's emotions | `get_entry_emotions` |
| Streak Counter | Entry dates | `list_entries` |
| Week in Emotions | 7 days of emotions | `list_entries` + emotions |
| On This Day | Historical entries | `list_entries` (date filter) |
| Monthly Overview | 30 days data | `list_entries` (range) |

## Implementation Approach (When Ready)

### Option A: Separate Swift Widget Extension

```
MindScribe.app/
├── Contents/
│   ├── MacOS/
│   │   └── MindScribe         (Tauri binary)
│   ├── PlugIns/
│   │   └── MindScribeWidget.appex/  (Swift WidgetKit)
│   └── Resources/
```

**Data Sharing:**
1. App Group Container for shared SQLite
2. UserDefaults Suite for lightweight widget cache
3. JSON export for widget consumption

### Option B: Menu Bar Companion

Simpler alternative: status bar icon with emotion indicator, dropdown showing today's summary, streak, quick actions.

## Reference Apps

### Day One
- Daily Prompt, On This Day, Streak, Today widgets
- Lock screen Suggestions widget
- Source: https://dayoneapp.com/blog/day-one-widgets-iphone-ipad/

### Stoic
- Refreshed widgets with better UX
- Lock screen ideas widget
- Streak and badge tracking
- Source: https://www.getstoic.com/

### Finch
- Widget shows virtual pet status
- Progress = energy, not streaks (less pressure)
- Source: https://finchcare.com/

## Tauri Widget Status

- Feature request: https://github.com/tauri-apps/tauri/issues/9766
- Swift macOS plugin support: https://github.com/tauri-apps/tauri/issues/12137
- No native WidgetKit support as of Feb 2026

## X/Twitter Showcases

- [@wdgtsapp](https://x.com/wdgtsapp) - Widget collection app
- [Wdgts 2](https://x.com/tanmays/status/1463532341255720961) - Native multi-platform widgets
- [iOS 26 Snippets](https://x.com/mattcassinelli/status/1986893057049190614) - Future of widgets
