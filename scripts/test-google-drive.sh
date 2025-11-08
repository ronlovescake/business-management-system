#!/bin/bash

# Google Drive Integration Test Script
# This script helps you verify your Google Drive setup

echo "=================================="
echo "Google Drive Integration Test"
echo "=================================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ ERROR: .env.local file not found!"
    echo "   Please create .env.local and add your Google Drive credentials."
    exit 1
fi

echo "✅ .env.local file found"
echo ""

# Check if environment variables are set (basic check)
if grep -q "GOOGLE_DRIVE_FOLDER_ID=\"1reLxZAgqSy3xfMaG4lqFSVWAcYHbCjz8\"" .env.local; then
    echo "✅ GOOGLE_DRIVE_FOLDER_ID is configured"
else
    echo "⚠️  WARNING: GOOGLE_DRIVE_FOLDER_ID might not be configured correctly"
fi

if grep -q "GOOGLE_CLIENT_EMAIL=\"your-service-account" .env.local; then
    echo "❌ GOOGLE_CLIENT_EMAIL needs to be updated with your actual service account email"
else
    echo "✅ GOOGLE_CLIENT_EMAIL appears to be configured"
fi

if grep -q "GOOGLE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\\\nYOUR_PRIVATE_KEY_HERE" .env.local; then
    echo "❌ GOOGLE_PRIVATE_KEY needs to be updated with your actual private key"
else
    echo "✅ GOOGLE_PRIVATE_KEY appears to be configured"
fi

echo ""
echo "=================================="
echo "Testing API Endpoint..."
echo "=================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "⚠️  WARNING: Development server doesn't appear to be running"
    echo "   Start it with: npm run dev"
    echo ""
    echo "After starting the server, test the API with:"
    echo "   curl http://localhost:3000/api/google-drive/sync-files"
    exit 0
fi

echo "✅ Development server is running"
echo ""
echo "Testing Google Drive sync endpoint..."
echo ""

# Test the endpoint
response=$(curl -s http://localhost:3000/api/google-drive/sync-files)

# Check if response contains "success"
if echo "$response" | grep -q '"success":true'; then
    echo "✅ SUCCESS! Google Drive integration is working!"
    echo ""
    echo "Response:"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
    echo "🎉 You're all set! Go to the Invoicing tab and click 'Add New' to sync files."
elif echo "$response" | grep -q '"success":false'; then
    echo "❌ API returned an error:"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
    echo "Common issues:"
    echo "1. Service account credentials not configured correctly"
    echo "2. Google Drive folder not shared with service account"
    echo "3. googleapis package not installed"
    echo ""
    echo "See GOOGLE_DRIVE_SETUP_CHECKLIST.md for setup instructions."
else
    echo "⚠️  Unexpected response:"
    echo "$response"
fi

echo ""
echo "=================================="
echo "Setup Resources:"
echo "=================================="
echo "- Setup Checklist: GOOGLE_DRIVE_SETUP_CHECKLIST.md"
echo "- Full Guide: docs/GOOGLE_DRIVE_INTEGRATION.md"
echo "- Environment File: .env.local"
echo "=================================="
