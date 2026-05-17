CREATE TABLE IF NOT EXISTS stock_decision_learning_refs (
  decision_id TEXT NOT NULL,
  learning_item_id TEXT NOT NULL,
  selected_at INTEGER NOT NULL,
  PRIMARY KEY (decision_id, learning_item_id),
  FOREIGN KEY (decision_id) REFERENCES stock_ai_decisions(id) ON DELETE CASCADE,
  FOREIGN KEY (learning_item_id) REFERENCES stock_learning_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_decision_learning_refs_decision ON stock_decision_learning_refs(decision_id);
CREATE INDEX IF NOT EXISTS idx_stock_decision_learning_refs_learning ON stock_decision_learning_refs(learning_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_decision_learning_refs_selected_at ON stock_decision_learning_refs(selected_at);
