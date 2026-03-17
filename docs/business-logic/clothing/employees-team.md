# Clothing — Employees: Team Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/team/hooks/useTeam.ts`
> - `src/app/clothing/employees/team/components/EmployeeFormDialog.tsx`
> - `src/app/clothing/employees/team/types/index.ts`

---

## A — Page Layout & Stats Cards

| #   | Logic                                             | Explanation                                                                                                                     |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Four stat cards are displayed at the top          | Cards show: Total Employees, Active, On Leave, and Total Basic Salary (active employees only).                                  |
| 2   | Total Salary counts active employees only         | `totalSalary` sums `basicSalary` for all employees where `status === 'active'`. Resigned and terminated employees are excluded. |
| 3   | On-Leave count is derived from status             | Employees with `status === 'on-leave'` are counted separately from resigned and terminated.                                     |
| 4   | Resigned and terminated are tracked independently | `resignedEmployees` and `terminatedEmployees` are counts derived from employee status — used for informational display.         |

---

## B — Employee ID Generation

| #   | Logic                                                | Explanation                                                                                                                                                     |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Employee IDs are auto-generated in `EMP-XXXX` format | When no valid ID is provided, `generateEmployeeId` queries the API for existing employees, finds the highest number in `EMP-NNNN` pattern, and increments by 1. |
| 6   | Custom IDs bypass auto-generation if valid           | If the form supplies an ID matching `/^EMP-\d{4}$/`, it is used as-is. Otherwise auto-generation runs.                                                          |
| 7   | Duplicate employee ID errors trigger up to 5 retries | If the server returns a unique-constraint error on `employeeId`, the hook retries up to 5 times with incrementing offsets (e.g., `EMP-0006`, `EMP-0007`, etc.). |
| 8   | After 5 failed retries, creation throws permanently  | If all retry attempts produce duplicates, the mutation throws `'Failed to create employee after retries'` and the form stays open.                              |

---

## C — Employee Form Fields

| #   | Logic                                                                                                               | Explanation                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 9   | Required fields: First Name, Last Name, Contact Number, Department, Position, Hire Date, Basic Salary               | Validation returns inline errors for missing required fields before submission.                                          |
| 10  | Optional fields: Middle Name, Suffix, Email, Job Title, Employee Type, Employment Status, Office, Hiring Source     | These fields default to null if empty.                                                                                   |
| 11  | Name is auto-composed from first/middle/last + suffix                                                               | If the `name` field is blank, it is built as `firstName + middleName + lastName + suffix` with extra spaces collapsed.   |
| 12  | Basic Salary must be a positive number                                                                              | Validation checks `parseFloat(value) > 0`. Zero and negative values are rejected.                                        |
| 13  | Government ID fields: SSS Number, PhilHealth Number, HDMF Number, TIN Number                                        | All stored as nullable strings; no format validation enforced in the form.                                               |
| 14  | Payroll-related fields: Basic Salary, Allowance, Payment Schedule, SSS/PhilHealth/Pag-IBIG/Tax monthly contribution | Contribution fields store pre-agreed monthly amounts used as fallback in payroll if payroll record contribution is zero. |
| 15  | Bank/GCash fields: Bank Account, GCash Account                                                                      | Both nullable strings; used for payroll disbursement reference.                                                          |
| 16  | Final Pay fields: Final Pay Pending (switch), Effective Date, Notes                                                 | Used to flag employees whose final pay is outstanding after separation.                                                  |
| 17  | Profile Photo accepts a URL string                                                                                  | If a photo URL is provided and non-empty it is stored; otherwise the existing employee photo is preserved on edit.       |

---

## D — Create / Edit Employee

| #   | Logic                                                               | Explanation                                                                                                                  |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 18  | Modal title changes between "Add Employee" and "Edit Employee"      | Icon uses `IconUserPlus` for new entries, `IconUserEdit` for edits.                                                          |
| 19  | Opening the form for a new employee clears all fields to defaults   | `setEditingEmployee(null)` and `setIsFormOpen(true)`.                                                                        |
| 20  | Opening the form for an existing employee populates all fields      | All fields from the existing employee record are populated into the Mantine form.                                            |
| 21  | Optimistic create inserts a temporary record immediately            | A `temp-{timestamp}` record appears in the list before the API responds.                                                     |
| 22  | Optimistic update modifies the existing record in cache immediately | The UI reflects changes before the server confirms.                                                                          |
| 23  | On save success, the modal closes                                   | `setIsFormOpen(false)` and `setEditingEmployee(null)` are called.                                                            |
| 24  | On save error, the optimistic entry is rolled back                  | The previous cache snapshot is restored on mutation failure; `alert('Failed to save employee. Please try again.')` is shown. |

---

## E — Delete Employee

| #   | Logic                                            | Explanation                                                                                                                        |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Delete uses native browser `confirm()`           | `confirm('Are you sure you want to delete this employee?')` is shown before the mutation fires.                                    |
| 26  | Optimistic delete removes the record immediately | Employee is removed from cache before the API responds.                                                                            |
| 27  | Delete error rolls back the record               | If the DELETE API call fails, the removed employee reappears and `alert('Failed to delete employee. Please try again.')` is shown. |

---

## F — Filters & Search

| #   | Logic                                                                         | Explanation                                                                                    |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 28  | Filtering is applied server-side via query parameters                         | `search`, `department`, and `status` filters are sent as URL query params to `GET /employees`. |
| 29  | Department filter dropdown is populated from unique departments in the result | Options are derived from the current employee list and sorted alphabetically.                  |
| 30  | Status filter options: all, active, on-leave, resigned, terminated            | Selecting a status sends it as the `status` param to the API.                                  |
| 31  | Searching by text sends a `search` param                                      | The API handles the search logic; the UI does not apply client-side text filtering.            |
| 32  | Filters are combined with AND logic                                           | All active filters must match for a record to appear.                                          |

---

## G — Employee Detail View (`/team/[id]`)

| #   | Logic                                                                           | Explanation                                                                                                   |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 33  | Detail fields are organised by category                                         | `EmployeeDetailField` carries a `label`, `value`, and `category` — the detail page groups fields by category. |
| 34  | Categories include: Personal, Employment, Compensation, Government IDs, Contact | Each section renders a labelled grid of field values.                                                         |

---

## H — Tabs

| #   | Logic                                                      | Explanation                                                                                 |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 35  | The page has two tabs: "Employees" (list) and a second tab | `activeTab` defaults to `'employees'`.                                                      |
| 36  | Tab state is local to the hook                             | Switching tabs does not trigger data re-fetches unless tab content requires different data. |
