## ADDED Requirements

### Requirement: Unified idle optimization threshold
The extension SHALL use one shared inactivity threshold to decide when eligible tabs enter the optimization flow.

#### Scenario: Idle tab reaches threshold
- **WHEN** an eligible tab has been inactive for at least the configured threshold
- **THEN** the extension includes that tab in the same optimization pass for grouping and discard evaluation

#### Scenario: Tab remains below threshold
- **WHEN** an eligible tab has been inactive for less than the configured threshold
- **THEN** the extension SHALL NOT group or discard that tab because of idle optimization

### Requirement: Preset-based idle modes
The extension SHALL provide preset optimization modes that map to inactivity thresholds of 2, 5, and 10 minutes, with 5 minutes selected by default.

#### Scenario: Default settings are initialized
- **WHEN** the extension initializes settings for a new installation
- **THEN** the selected optimization preset SHALL resolve to a 5 minute threshold

#### Scenario: User selects a different preset
- **WHEN** the user chooses the aggressive or conservative preset
- **THEN** the extension SHALL apply the corresponding threshold to future idle optimization scans

### Requirement: Safe tab discard eligibility
The extension SHALL discard only tabs that satisfy the idle threshold and are not active, pinned, audible, already discarded, or using protected internal URLs.

#### Scenario: Protected tab is scanned
- **WHEN** a tab is active, pinned, audible, already discarded, or has a protected internal URL
- **THEN** the extension SHALL NOT discard that tab

#### Scenario: Eligible tab is scanned
- **WHEN** a tab satisfies the idle threshold and none of the discard exclusions apply
- **THEN** the extension SHALL attempt to discard the tab after grouping logic completes

### Requirement: Group before discard in the same pass
The extension SHALL evaluate grouping before discarding tabs that enter the idle optimization flow.

#### Scenario: Groupable idle tab is optimized
- **WHEN** an idle tab matches the grouping strategy and also qualifies for discard
- **THEN** the extension SHALL apply grouping decisions before issuing discard for that tab

#### Scenario: Non-groupable idle tab is optimized
- **WHEN** an idle tab does not produce a grouping target but still qualifies for discard
- **THEN** the extension MAY discard the tab without moving it into a group
