#!/bin/bash

# Clean Next.js Development Cache Script
# This removes the .next cache and helps with compilation issues

echo "🧹 Cleaning Next.js development cache..."

# Remove .next directory
if [ -d ".next" ]; then
    echo "📁 Removing .next directory..."
    rm -rf .next
    echo "✅ .next directory removed"
else
    echo "ℹ️  .next directory not found"
fi

# Remove node_modules/.cache if it exists
if [ -d "node_modules/.cache" ]; then
    echo "📁 Removing node_modules/.cache..."
    rm -rf node_modules/.cache
    echo "✅ node_modules/.cache removed"
fi

# Remove TypeScript build info
if [ -f "tsconfig.tsbuildinfo" ]; then
    echo "📁 Removing tsconfig.tsbuildinfo..."
    rm -f tsconfig.tsbuildinfo
    echo "✅ tsconfig.tsbuildinfo removed"
fi

echo ""
echo "✨ Cache cleaned successfully!"
echo ""
echo "💡 Next steps:"
echo "   1. Run: npm run dev"
echo "   2. First load will be slow (building cache)"
echo "   3. Subsequent loads should be faster"
echo ""
