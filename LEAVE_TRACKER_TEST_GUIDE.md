# Leave Tracker Database Integration - Quick Test Guide

## ✅ Database Integration Complete!

Your leave tracker now persists all data to PostgreSQL. Follow these steps to test:

## Quick Test Steps

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Navigate to Leave Tracker

Open your browser and go to:

```
http://localhost:3000/clothing/employees/leave-tracker
```

### 3. Test Data Persistence

#### Test A: Create a Leave Request

1. Click "Add Leave Request" button
2. Fill in the form:
   - Employee ID: `EMP001`
   - Employee Name: `John Doe`
   - Leave Type: `Sick Leave`
   - Start Date: Tomorrow's date
   - End Date: Day after tomorrow
   - Reason: `Medical appointment`
   - Notes: `Will provide medical certificate`
3. Click "Save"
4. **Verify**: Leave request appears in the list

#### Test B: Refresh Page (Main Test!)

1. Press `F5` or `Ctrl+R` to refresh the page
2. **Verify**: ✅ The leave request is STILL THERE!
   - Before: Request would disappear 😞
   - Now: Request persists! 🎉

#### Test C: Edit Leave Request

1. Click the edit icon (pencil) on your leave request
2. Change the reason to: `Follow-up medical appointment`
3. Click "Save"
4. Refresh the page
5. **Verify**: ✅ Changes are persisted!

#### Test D: Approve Leave Request

1. Click the "Approve" button on your leave request
2. **Verify**: Status changes to "approved" (green badge)
3. Refresh the page
4. **Verify**: ✅ Status is still "approved"!

#### Test E: Delete Leave Request

1. Click the delete icon (trash) on your leave request
2. Confirm deletion
3. **Verify**: Request is removed
4. Refresh the page
5. **Verify**: ✅ Request stays deleted!

## Database Verification

You can also verify data directly in the database:

```bash
# Check all leave requests
PGPASSWORD=ronpassword psql -h localhost -U ron -d business_management_db \
  -c "SELECT id, \"employeeName\", \"leaveType\", status FROM leave_requests;"

# Check request count
PGPASSWORD=ronpassword psql -h localhost -U ron -d business_management_db \
  -c "SELECT COUNT(*) FROM leave_requests;"

# Check pending requests
PGPASSWORD=ronpassword psql -h localhost -U ron -d business_management_db \
  -c "SELECT * FROM leave_requests WHERE status = 'pending';"
```

## CSV Import Test

### 1. Create a Test CSV File

Create `test-leave-requests.csv` with this content:

```csv
employeeId,employeeName,leaveType,startDate,endDate,reason,status,appliedDate,notes
EMP001,John Doe,Sick Leave,2025-10-20,2025-10-22,Medical appointment,pending,2025-10-19,Will provide certificate
EMP002,Jane Smith,Vacation Leave,2025-11-01,2025-11-07,Family vacation,pending,2025-10-19,
EMP003,Bob Johnson,Emergency Leave,2025-10-25,2025-10-25,Family emergency,pending,2025-10-19,Urgent
```

### 2. Import the CSV

1. Click "Import CSV" button
2. Select your `test-leave-requests.csv` file
3. **Verify**: All 3 requests are imported

### 3. Verify Persistence

1. Refresh the page
2. **Verify**: ✅ All 3 imported requests are still there!

## Expected Behavior

### ✅ BEFORE (Not Working)

- ❌ Add leave request → Works
- ❌ Refresh page → **Data disappears!**
- ❌ All data lost on page reload

### ✅ AFTER (Fixed!)

- ✅ Add leave request → Works
- ✅ Refresh page → **Data persists!**
- ✅ Edit request → Saves to database
- ✅ Approve/Reject → Saves to database
- ✅ Delete request → Removes from database
- ✅ Import CSV → All saved to database
- ✅ Close browser, reopen → Data still there!
- ✅ Restart server → Data still there!

## API Endpoints Working

You can test the API endpoints directly:

### Get All Leave Requests

```bash
curl http://localhost:3000/api/leave-requests
```

### Create Leave Request

```bash
curl -X POST http://localhost:3000/api/leave-requests \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP999",
    "employeeName": "Test User",
    "leaveType": "Sick Leave",
    "startDate": "2025-10-20",
    "endDate": "2025-10-20",
    "numberOfDays": 1,
    "reason": "Test reason",
    "status": "pending",
    "appliedDate": "2025-10-19"
  }'
```

### Update Leave Request (Replace {id} with actual ID)

```bash
curl -X PATCH http://localhost:3000/api/leave-requests \
  -H "Content-Type: application/json" \
  -d '{
    "id": "1",
    "status": "approved",
    "approvedBy": "Manager"
  }'
```

### Delete Leave Request (Replace {id} with actual ID)

```bash
curl -X DELETE http://localhost:3000/api/leave-requests/1
```

## Troubleshooting

### Problem: "Failed to fetch leave requests"

**Solution**: Make sure the development server is running

```bash
npm run dev
```

### Problem: Database connection error

**Solution**: Check if PostgreSQL is running

```bash
sudo systemctl status postgresql
```

### Problem: Empty list after refresh

**Solution**:

1. Check browser console for errors (F12)
2. Verify database connection in `.env`
3. Check if data is in database:
   ```bash
   PGPASSWORD=ronpassword psql -h localhost -U ron -d business_management_db \
     -c "SELECT * FROM leave_requests;"
   ```

## Success Criteria

✅ **Integration is working if:**

1. Leave requests persist after page refresh
2. All CRUD operations save to database
3. Data survives browser restart
4. Multiple tabs show same data
5. CSV import creates permanent records

## Current Status

- ✅ Database table created
- ✅ API endpoints configured
- ✅ Frontend hook updated
- ✅ Type conversions handled
- ✅ Error handling added
- ✅ Loading states implemented

## 🎉 You're All Set!

Your leave tracker is now fully database-backed. **No more disappearing data!**

Go ahead and test it out. Add some leave requests and refresh the page - they'll still be there! 🚀
