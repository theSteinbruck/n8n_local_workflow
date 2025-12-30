# Phase 31 Verification: Workflow Authoring Validation

## Manual Testing Guide

### Prerequisites
1. Start the API server: `cd packages/api && npm run dev`
2. Start the UI: `cd packages/editor-ui && npm run dev`
3. Open browser to `http://localhost:5173`

---

## Test 1: Missing Parameter Validation

**Steps:**
1. Navigate to a workflow in the canvas
2. Add an **HttpRequest** node from the palette
3. Do NOT fill in the URL parameter (leave it empty)
4. Click the **Run** button

**Expected Result:**
✅ Validation error alert appears
✅ Error message shows: `• HTTP Request (node-id): Missing required parameter "url"`
✅ No execution is created
✅ No backend API call is made (check Network tab)

**Failure Indicators:**
❌ Execution starts despite missing URL
❌ Backend error instead of UI validation
❌ No error message shown

---

## Test 2: Disconnected Node Validation

**Steps:**
1. Create a simple workflow: ManualTrigger → Set
2. Add a **NoOp** node but do NOT connect it to anything
3. Click **Run**

**Expected Result:**
✅ Validation error alert appears
✅ Error message shows: `• No-Op (node-id): Node is not connected to execution path`
✅ No execution is created

**Failure Indicators:**
❌ Execution starts with disconnected node
❌ No validation error

---

## Test 3: Multiple Triggers Validation

**Steps:**
1. Add two **ManualTrigger** nodes to the canvas
2. Connect both to other nodes
3. Click **Run**

**Expected Result:**
✅ Validation error alert appears
✅ Error message shows: `Only one trigger node allowed per workflow` (for both triggers)
✅ No execution is created

**Failure Indicators:**
❌ Execution starts
❌ No validation error
❌ Backend error instead of UI validation

---

## Test 4: Trigger Without Connection

**Steps:**
1. Add a single **ManualTrigger** node
2. Do NOT connect it to any other nodes
3. Click **Run**

**Expected Result:**
✅ Validation error alert appears
✅ Error message shows: `• Manual Trigger (node-id): Trigger must have at least one outgoing connection`
✅ No execution is created

**Failure Indicators:**
❌ Execution starts
❌ No validation error

---

## Test 5: Valid Workflow Execution

**Steps:**
1. Create a valid workflow: **ManualTrigger → Set → NoOp**
2. Fill in all required parameters
3. Ensure all nodes are connected
4. Click **Run**

**Expected Result:**
✅ No validation errors
✅ Execution starts normally
✅ Execution sidebar opens
✅ Nodes execute in order
✅ All nodes show success status

**Failure Indicators:**
❌ Validation error on valid workflow
❌ Execution doesn't start
❌ Nodes don't execute

---

## Test 6: Unsupported Node Type

**Steps:**
1. Try to add an unsupported node type (e.g., "Code" or "Log")
2. These should already be disabled in the palette
3. If you manage to add one (e.g., via direct DB manipulation), click **Run**

**Expected Result:**
✅ Validation error appears
✅ Error message identifies the unsupported node type
✅ No execution is created

**Failure Indicators:**
❌ Execution starts with unsupported node
❌ Backend error instead of UI validation

---

## Test 7: Multiple Validation Errors

**Steps:**
1. Create a workflow with multiple issues:
   - Add HttpRequest without URL
   - Add disconnected Set node
   - Add two ManualTriggers
2. Click **Run**

**Expected Result:**
✅ Validation error alert appears
✅ All errors are listed in the alert
✅ Each error shows node label and specific issue
✅ No execution is created

**Example:**
```
Cannot run workflow:

• HTTP Request (http-1): Missing required parameter "url"
• Set (set-2): Node is not connected to execution path
• Manual Trigger (trigger-1): Only one trigger node allowed per workflow
• Manual Trigger (trigger-2): Only one trigger node allowed per workflow
```

---

## Test 8: Backward Compatibility (No Trigger)

**Steps:**
1. Create a workflow WITHOUT a ManualTrigger
2. Just add: **Set → NoOp**
3. Click **Run**

**Expected Result:**
✅ Workflow executes normally (legacy mode)
✅ Execution starts from first node
✅ No validation errors

**Failure Indicators:**
❌ Validation error about missing trigger
❌ Execution doesn't start

---

## Test 9: Phase 30 Regression Check

**Steps:**
1. Create a workflow with custom node positions
2. Click **Save**
3. Reload the page
4. Verify positions are preserved
5. Click **Run**

**Expected Result:**
✅ Node positions persist (Phase 30 still works)
✅ Validation runs correctly
✅ Execution works normally

**Failure Indicators:**
❌ Positions reset
❌ Validation broken
❌ Execution fails

---

## Console Verification

### Check for Errors
- Open browser DevTools (F12)
- Check Console tab
- Should see no errors related to validation
- Validation should happen silently before execution

### Network Verification
- Open Network tab
- When validation fails, should see NO request to `/api/executions/canvas`
- When validation passes, should see POST to `/api/executions/canvas`

---

## Success Criteria

✅ All 9 tests pass
✅ Invalid workflows never reach backend
✅ Error messages are clear and actionable
✅ Valid workflows execute normally
✅ No regression in Phase 30 (position persistence)
✅ No console errors

---

## Known Validation Rules

1. **Trigger Rules:**
   - Max one trigger per workflow
   - Trigger must have outgoing connection

2. **Connectivity Rules:**
   - All executable nodes must be reachable
   - No orphan nodes allowed

3. **Parameter Rules:**
   - HttpRequest: `url` is required

4. **Node Support:**
   - Only: NoOp, Set, Fail, ManualTrigger, HttpRequest
