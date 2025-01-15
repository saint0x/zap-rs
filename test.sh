#!/bin/bash

# Build the project first
npm run build

# Test GET request
echo -e "\nTesting GET /api/hello"
curl -X GET http://localhost:3000/api/hello

# Test POST request with data
echo -e "\nTesting POST /api/echo"
curl -X POST -H "Content-Type: application/json" -d '{"test":"data"}' http://localhost:3000/api/echo

# Test protected route without auth
echo -e "\nTesting GET /api/protected without auth"
curl -X GET http://localhost:3000/api/protected

# Test protected route with auth
echo -e "\nTesting GET /api/protected with auth"
curl -X GET -H "x-auth: secret" http://localhost:3000/api/protected 