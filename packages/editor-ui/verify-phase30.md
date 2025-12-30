# Phase 30 Verification: UI State Persistence

## Manual Testing Guide

### Prerequisites
1. Start the API server: `cd packages/api && npm run dev`
2. Start the UI: `cd packages/editor-ui && npm run dev`
3. Open browser to `http://localhost:5173`

---

## Test 1: Drag Persistence

**Steps:**
1. Navigate to a workflow in the canvas
2. Drag multiple nodes to custom positions (spread them out across the canvas)
3. Click the **Save** button
4. **Reload the page** (F5 or Cmd+R)

**Expected Result:**
✅ Nodes remain in the exact positions where you placed them
✅ No layout shift or repositioning

**Failure Indicators:**
❌ Nodes reset to vertical stack layout
❌ Positions are different from where you saved them

---

## Test 2: Connection Persistence

**Steps:**
1. Create connections between nodes by dragging from output to input handles
2. Verify edges are visible
3. Click **Save**
4. **Reload the page**

**Expected Result:**
✅ All edges remain intact
✅ Connections are preserved exactly as before
✅ No orphaned or missing connections

**Failure Indicators:**
❌ Edges disappear
❌ Connections are broken

---

## Test 3: Mixed Workflows (Backward Compatibility)

**Steps:**
1. Load an old workflow that was saved WITHOUT ui metadata (before Phase 30)
   - You can create one by manually editing the DB or using an old workflow
2. Verify it loads correctly

**Expected Result:**
✅ Workflow loads without errors
✅ Nodes appear in default vertical stack layout
✅ No console errors or crashes

**Then:**
3. Drag nodes to new positions
4. Click **Save**
5. **Reload the page**

**Expected Result:**
✅ Positions now persist (ui metadata was added)
✅ Nodes stay where you placed them

**Failure Indicators:**
❌ Workflow fails to load
❌ Console errors about missing ui field
❌ Positions don't persist after save

---

## Test 4: Execution Safety

**Steps:**
1. Create a simple workflow: ManualTrigger → Set → NoOp
2. Position nodes in custom locations
3. Click **Run** (do NOT save yet)
4. Verify execution completes successfully
5. Now click **Save**
6. **Reload the page**
7. Click **Run** again

**Expected Result:**
✅ Execution works identically before and after save
✅ Execution works identically before and after reload
✅ No changes to execution behavior
✅ Execution steps appear correctly in sidebar

**Failure Indicators:**
❌ Execution fails after save
❌ Execution behavior changes
❌ Nodes execute in wrong order

---

## Additional Checks

### Console Verification
- Open browser DevTools (F12)
- Check Console tab for errors
- Should see: `Mapped Nodes:` and `Mapped Edges:` logs
- No errors or warnings related to positions

### Network Verification
- Open Network tab in DevTools
- Save workflow
- Check PUT request to `/api/workflows/:id`
- Verify payload includes `ui.position` for each node

### Database Verification (Optional)
```bash
cd packages/database
sqlite3 sqlite.db
SELECT id, name, json_extract(nodes, '$[0].ui') FROM workflows;
```
Should show ui metadata in the nodes JSON.

---

## Success Criteria

✅ All 4 tests pass
✅ No console errors
✅ No breaking changes to existing workflows
✅ Execution behavior unchanged

---

## Known Limitations (By Design)

- No auto-save (must click Save button)
- No snap-to-grid
- No zoom persistence
- No undo/redo for position changes
