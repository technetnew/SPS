#!/bin/bash

# SPS API Test Script

API_URL="http://localhost:3000"

echo "================================="
echo "SPS API Test Suite"
echo "================================="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
curl -s $API_URL/health | python3 -m json.tool
echo ""
echo ""

# Test 2: Login
echo "Test 2: User Login"
echo "------------------"
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"SecurePass123"}')

echo "$LOGIN_RESPONSE" | python3 -m json.tool
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
echo ""
echo "Token extracted: ${TOKEN:0:50}..."
echo ""
echo ""

# Test 3: Get User Profile
echo "Test 3: Get User Profile"
echo "------------------------"
curl -s -X GET $API_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

# Test 4: Add Inventory Item
echo "Test 4: Add Inventory Item (Canned Beans)"
echo "------------------------------------------"
curl -s -X POST $API_URL/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Canned Beans","category_id":1,"quantity":24,"unit":"cans","location":"Basement Shelf A","expiration_date":"2025-12-31"}' | python3 -m json.tool
echo ""
echo ""

# Test 5: Add More Items
echo "Test 5: Add More Inventory Items"
echo "---------------------------------"

curl -s -X POST $API_URL/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Bottled Water","category_id":1,"quantity":48,"unit":"bottles","location":"Garage Storage","expiration_date":"2027-06-30"}' | python3 -m json.tool
echo ""

curl -s -X POST $API_URL/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"First Aid Kit","category_id":2,"quantity":2,"unit":"kits","location":"Hall Closet"}' | python3 -m json.tool
echo ""

curl -s -X POST $API_URL/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Flashlight","category_id":6,"quantity":5,"unit":"units","location":"Kitchen Drawer","min_quantity":2}' | python3 -m json.tool
echo ""
echo ""

# Test 6: Get All Inventory
echo "Test 6: Get All Inventory Items"
echo "--------------------------------"
curl -s -X GET $API_URL/api/inventory \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

# Test 7: Get Inventory Stats
echo "Test 7: Get Inventory Statistics"
echo "---------------------------------"
curl -s -X GET $API_URL/api/inventory/stats/overview \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

# Test 8: Get Categories
echo "Test 8: Get All Categories"
echo "--------------------------"
curl -s -X GET $API_URL/api/inventory/categories/all \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

echo "================================="
echo "All Tests Completed!"
echo "================================="
