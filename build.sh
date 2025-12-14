#!/bin/bash

echo "Building NovaCare POC..."

# Build Machine 1 services
echo "Building Machine 1 services..."
cd machine1/patient-core-service
mvn clean package -DskipTests
cd ../..

# cd machine1/esb-central
# mvn clean package -DskipTests
# cd ../..

# Build Machine 2 services
echo "Building Machine 2 services..."
# cd machine2/esb-local
# mvn clean package -DskipTests
# cd ../..

echo "Build completed!"


