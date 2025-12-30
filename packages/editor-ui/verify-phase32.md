# Phase 32 Verification: Visual Validation Feedback

## Manual Testing Guide

### Prerequisites
1. Start the API server: `cd packages/api && npm run dev`
2. Start the UI: `cd packages/editor-ui && npm run dev`
3. Open browser to `http://localhost:5173`

---

## Test 1: Missing URL Parameter - Visual Feedback

**Steps:**
1. Navigate to a workflow in the canvas
2. Add an **HttpRequest** node from the palette
3. Do NOT fill in the URL parameter (leave it empty)
4. Click the **Run** button

**Expected Result:**
✅ Validation error alert appears (from Phase 31)
✅ **HttpRequest node border turns RED** (2px solid red)
✅ **⚠️ icon appears** in top-right corner of the node
✅ **Hover over the node** → Tooltip shows: `❌ Missing required parameter "url"`
✅ No execution is created

**Failure Indicators:**
❌ Node border stays normal color
❌ No warning icon
❌ No tooltip on hover

---

## Test 2: Disconnected Node - Visual Feedback

**Steps:**
1. Create a simple workflow: ManualTrigger → Set
2. Add a **NoOp** node but do NOT connect it to anything
3. Click **Run**

**Expected Result:**
✅ Validation error alert appears
✅ **NoOp node border turns RED**
✅ **⚠️ icon appears** on the disconnected node
✅ **Hover over NoOp** → Tooltip shows: `❌ Node is not connected to execution path`
✅ Connected nodes (ManualTrigger, Set) remain normal (no red border)

**Failure Indicators:**
❌ All nodes turn red (should only be the disconnected one)
❌ No visual distinction

---

## Test 3: Multiple Errors on Single Node

**Steps:**
1. Add an **HttpRequest** node
2. Leave URL empty
3. Don't connect it to anything
4. Click **Run**

**Expected Result:**
✅ **HttpRequest node has RED border**
✅ **⚠️ icon visible**
✅ **Hover over node** → Tooltip shows BOTH errors:
```
❌ Missing required parameter "url"
❌ Node is not connected to execution path
```
✅ Each error on separate line

**Failure Indicators:**
❌ Only one error shown
❌ Errors not listed properly

---

## Test 4: Multiple Invalid Nodes

**Steps:**
1. Create workflow with multiple issues:
   - HttpRequest without URL
   - Disconnected Set node
   - Two ManualTriggers
2. Click **Run**

**Expected Result:**
✅ **All invalid nodes have RED borders**
✅ **All invalid nodes show ⚠️ icon**
✅ **Hover over each** → Specific error for that node
✅ Valid/connected nodes remain normal

**Visual Check:**
- HttpRequest: Red border + ⚠️
- Disconnected Set: Red border + ⚠️
- Both ManualTriggers: Red border + ⚠️
- Other valid nodes: Normal border

---

## Test 5: Fix Error - Visual Update

**Steps:**
1. Add HttpRequest without URL
2. Click **Run** → Node turns red
3. **Fill in the URL parameter** in Node Inspector
4. **Connect the node** to the workflow
5. Click **Run** again

**Expected Result:**
✅ After filling URL and connecting: **Red border disappears**
✅ **⚠️ icon disappears**
✅ **No tooltip on hover**
✅ Node returns to normal appearance
✅ Execution proceeds normally

**Failure Indicators:**
❌ Red border persists after fixing
❌ Warning icon remains

---

## Test 6: Valid Workflow - No Visual Errors

**Steps:**
1. Create valid workflow: **ManualTrigger → Set → NoOp**
2. Fill in all required parameters
3. Ensure all nodes are connected
4. Click **Run**

**Expected Result:**
✅ **No red borders** on any nodes
✅ **No ⚠️ icons**
✅ **No validation tooltips**
✅ Execution starts normally
✅ Nodes execute and show execution status (running → success)

**Failure Indicators:**
❌ Valid nodes show red borders
❌ False positive validation errors

---

## Test 7: Tooltip Visibility

**Steps:**
1. Create a node with validation error
2. **Hover over the node** (wait ~1 second)
3. **Move mouse away**
4. **Hover again**

**Expected Result:**
✅ Tooltip appears on hover
✅ Tooltip shows all validation errors
✅ Tooltip disappears when mouse leaves
✅ Tooltip is readable (not cut off)

**Check Tooltip Format:**
```
❌ Error message 1
❌ Error message 2
```

---

## Test 8: Visual States Don't Interfere with Execution States

**Steps:**
1. Create valid workflow
2. Click **Run** → Nodes execute
3. During execution, nodes show status colors (yellow for running, green for success)
4. After execution completes
5. Now add a disconnected node
6. Click **Run** again

**Expected Result:**
✅ **Execution status colors** work normally (yellow, green)
✅ **Validation red border** appears on invalid nodes
✅ **Both systems work independently**
✅ Red border for validation, green background for success (can coexist)

**Failure Indicators:**
❌ Execution status colors broken
❌ Validation colors override execution colors incorrectly

---

## Test 9: Phase 30 & 31 Regression Check

**Steps:**
1. Create workflow with validation errors
2. **Save the workflow** (positions should persist - Phase 30)
3. **Reload the page**
4. Click **Run**

**Expected Result:**
✅ **Node positions persist** (Phase 30 still works)
✅ **Validation runs** and shows errors (Phase 31 still works)
✅ **Visual feedback appears** (Phase 32 works)
✅ Red borders and warnings show correctly

**Failure Indicators:**
❌ Positions reset
❌ Validation broken
❌ Visual feedback missing

---

## Visual Inspection Checklist

### Red Border
- [ ] Border is clearly visible (2px solid #dc3545)
- [ ] Border color is distinct from execution error state
- [ ] Border appears immediately after validation fails

### Warning Icon (⚠️)
- [ ] Icon appears in top-right corner of node
- [ ] Icon is visible against node background
- [ ] Icon size is appropriate (14px)

### Tooltip
- [ ] Tooltip appears on hover
- [ ] All errors are listed
- [ ] Each error has ❌ prefix
- [ ] Errors are on separate lines
- [ ] Tooltip text is readable

### Normal State
- [ ] Valid nodes have normal border (1px solid, status color)
- [ ] No warning icon on valid nodes
- [ ] No tooltip on valid nodes

---

## Browser DevTools Check

### Console
- Open DevTools (F12) → Console
- Should see no errors related to validation rendering
- No React warnings about keys or state updates

### Elements Inspector
- Inspect a node with validation errors
- Check the `<div>` has:
  - `style="border: 2px solid rgb(220, 53, 69);"`
  - `title` attribute with error messages
  - Child `<div>` with ⚠️ emoji

---

## Success Criteria

✅ All 9 tests pass
✅ Visual feedback is immediate and clear
✅ Red borders appear on invalid nodes
✅ Warning icons visible
✅ Tooltips show all errors
✅ Visual state clears when errors are fixed
✅ No interference with execution status colors
✅ No regression in Phase 30 (positions) or Phase 31 (validation)

---

## Known Visual States

| State | Border | Background | Icon |
|-------|--------|------------|------|
| Valid (pending) | 1px gray | Light gray | None |
| Valid (running) | 1px yellow | Yellow | None |
| Valid (success) | 1px green | Green | None |
| Valid (error) | 1px red | Light red | None |
| **Invalid (validation)** | **2px RED** | Normal | **⚠️** |
| Invalid + Running | 2px RED | Yellow | ⚠️ |
| Invalid + Success | 2px RED | Green | ⚠️ |

**Note:** Validation errors (red border) can coexist with execution states (background colors).
