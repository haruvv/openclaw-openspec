## ADDED Requirements

### Requirement: Strategy Performance Aggregation
The system SHALL compute performance metrics for stock paper trading strategies.

#### Scenario: Completed strategy trades exist
- **WHEN** completed internal paper trades have linked AI decisions with strategy tags
- **THEN** the system reports trade count, win rate, realized PnL, average profit, average loss, expectancy, Profit Factor, best trade, worst trade, and latest trade time for each strategy

#### Scenario: Untagged completed trades exist
- **WHEN** completed internal paper trades do not have a linked strategy tag
- **THEN** the system reports them under an explicit unclassified strategy bucket

#### Scenario: Open trades exist
- **WHEN** paper trades are open or do not have realized PnL
- **THEN** the system excludes them from strategy performance metrics

### Requirement: Strategy Performance Visibility
The system SHALL show strategy performance to authorized stock trading operators.

#### Scenario: Operator opens stock trading dashboard
- **WHEN** strategy performance metrics exist
- **THEN** the dashboard displays a concise strategy performance summary

#### Scenario: Operator opens strategy performance page
- **WHEN** the operator navigates to stock strategy performance
- **THEN** the page displays each strategy with its performance metrics and reporting status

#### Scenario: No completed strategy trades exist
- **WHEN** no completed paper trades exist
- **THEN** the dashboard and strategy page display an explicit empty state

### Requirement: Strategy Performance Safety
The system MUST treat strategy performance as reporting only.

#### Scenario: Strategy metrics are computed
- **WHEN** strategy performance is requested
- **THEN** the system reads existing paper decision and trade records only
- **AND** the system does not create broker orders, mutate positions, or automatically change trading rules
