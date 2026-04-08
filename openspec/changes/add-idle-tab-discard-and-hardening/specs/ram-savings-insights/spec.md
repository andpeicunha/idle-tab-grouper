## ADDED Requirements

### Requirement: Local RAM savings estimate
The extension SHALL calculate and display RAM savings as a local estimate rather than a measured per-tab memory value.

#### Scenario: Popup shows savings summary
- **WHEN** the popup loads and RAM savings data exists
- **THEN** the popup SHALL present the total as estimated RAM savings

#### Scenario: No analytics exist yet
- **WHEN** the popup loads before any discard activity has been recorded
- **THEN** the popup SHALL display a zero or empty estimated RAM savings state without error

### Requirement: RAM analytics remain local
The extension SHALL store RAM analytics only in local extension storage and SHALL NOT sync those analytics across devices.

#### Scenario: RAM estimate is updated
- **WHEN** a discard event contributes to RAM analytics
- **THEN** the updated aggregate SHALL be written only to local storage

#### Scenario: Settings are synchronized
- **WHEN** user preferences are synchronized between browsers
- **THEN** RAM analytics SHALL remain excluded from sync storage

### Requirement: Lightweight savings history
The extension SHALL retain only a short rolling history of aggregated RAM savings suitable for a lightweight popup chart.

#### Scenario: Daily aggregate is recorded
- **WHEN** RAM savings are updated on a given day
- **THEN** the extension SHALL update the aggregate for that day rather than append an unbounded raw event log

#### Scenario: History exceeds retention window
- **WHEN** stored RAM history is older than the configured retention window
- **THEN** the extension SHALL remove the expired aggregate entries
