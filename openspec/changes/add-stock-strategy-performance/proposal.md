## Why

The stock trading app records AI decisions, paper trades, positions, reviews, and learning items, but operators still cannot see which strategy tags are actually working. The original design requires strategy-level performance so weak rules can be rejected and strong rules can be refined.

## What Changes

- Add strategy performance aggregation from completed internal paper trades.
- Compute trade count, win rate, realized PnL, average profit/loss, expectancy, Profit Factor, best/worst trade, and latest trade time per strategy.
- Expose strategy performance through authenticated admin API.
- Add a stock trading Strategies page and dashboard summary panel.
- Keep strategy performance as reporting only; no real broker execution or automatic strategy mutation is introduced.

## Capabilities

### New Capabilities

- `stock-strategy-performance`: Computes and displays performance metrics for stock trading strategy tags.

### Modified Capabilities

None.

## Impact

- Extends stock trading repository with derived strategy metrics.
- Adds admin API route and admin UI page for strategy performance.
- Updates navigation and UI types.
- Adds repository, route, and UI tests.
