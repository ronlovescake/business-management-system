#!/bin/bash

# Batch script to add React.memo to component exports
# Usage: ./scripts/add-react-memo.sh

set -e

FILES=(
  "src/app/clothing/employees/thirteenth-month-pay/components/ThirteenthMonthPayFormDialog.tsx"
  "src/app/clothing/employees/cash-advance/components/RequestControls.tsx"
  "src/app/clothing/employees/cash-advance/components/RequestListTable.tsx"
  "src/app/clothing/employees/cash-advance/components/StatsCards.tsx"
  "src/app/clothing/employees/schedules/components/ScheduleListTable.tsx"
  "src/app/clothing/employees/schedules/components/ScheduleControls.tsx"
  "src/app/clothing/employees/schedules/components/CalendarView.tsx"
  "src/app/clothing/employees/schedules/components/StatsCards.tsx"
  "src/app/clothing/employees/schedules/components/CalendarBulkActions.tsx"
  "src/app/clothing/employees/expenses/components/AnalyticsTable.tsx"
  "src/app/clothing/employees/expenses/components/ReceiptViewerModal.tsx"
  "src/app/clothing/employees/expenses/components/ExpenseControls.tsx"
  "src/app/clothing/employees/expenses/components/ExpenseListTable.tsx"
  "src/app/clothing/employees/expenses/components/StatsCards.tsx"
  "src/app/clothing/operations/business-intelligence/components/StatCard.tsx"
  "src/app/clothing/operations/business-intelligence/components/BiDashboard.tsx"
  "src/app/clothing/operations/customers/[id]/components/CustomerStatsCards.tsx"
  "src/app/clothing/operations/customers/[id]/components/EditCustomerModal.tsx"
  "src/app/clothing/operations/customers/[id]/components/OrdersAndTransactions.tsx"
  "src/app/clothing/operations/customers/[id]/components/CustomerInfoCard.tsx"
  "src/app/clothing/operations/customers/[id]/components/CustomerDetailsView.tsx"
  "src/app/clothing/operations/customers/[id]/components/CustomerAnalytics.tsx"
)

echo "🚀 Adding React.memo to 22 components..."
echo ""

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "⚠️  File not found: $FILE"
    continue
  fi
  
  COMPONENT_NAME=$(basename "$FILE" .tsx)
  
  # Check if already has React.memo
  if grep -q "React.memo\|memo(" "$FILE"; then
    echo "✓ $COMPONENT_NAME - Already has React.memo"
    continue
  fi
  
  # Extract the export function/const line
  EXPORT_LINE=$(grep -n "^export \(function\|const\) $COMPONENT_NAME" "$FILE" | head -1 | cut -d: -f1)
  
  if [ -z "$EXPORT_LINE" ]; then
    echo "⚠️  $COMPONENT_NAME - Could not find export statement"
    continue
  fi
  
  # Check if it's a function or const
  if grep -q "^export function $COMPONENT_NAME" "$FILE"; then
    # Function export: export function Name() { ... }
    # Change to: export const Name = React.memo(function Name() { ... })
    
    # Find the closing brace (last line of file typically)
    LAST_LINE=$(wc -l < "$FILE")
    
    # Replace export function with export const Name = React.memo(function Name
    sed -i "${EXPORT_LINE}s/^export function \($COMPONENT_NAME\)/export const \1 = React.memo(function \1/" "$FILE"
    
    # Add closing ); at the end (before last })
    sed -i "${LAST_LINE}s/^}$/});/" "$FILE"
    
    echo "✓ $COMPONENT_NAME - Added React.memo (function)"
  else
    # Const export: export const Name = () => { ... }
    # Change to: export const Name = React.memo(() => { ... })
    
    # Find the closing brace
    LAST_LINE=$(wc -l < "$FILE")
    
    # Add React.memo( after =
    sed -i "${EXPORT_LINE}s/= /= React.memo(/" "$FILE"
    
    # Add closing ) at the end (before last ;)
    sed -i "${LAST_LINE}s/;$/);/" "$FILE"
    
    echo "✓ $COMPONENT_NAME - Added React.memo (const)"
  fi
done

echo ""
echo "✅ Done! Added React.memo to components."
echo "Run 'npm run lint' to verify no syntax errors."
