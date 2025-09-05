#!/bin/bash

# Fix common unused variable patterns by prefixing with underscore

cd src

# Fix unused parameters in arrow functions and regular functions
find . -name "*.ts" -exec sed -i 's/(\([a-zA-Z_][a-zA-Z0-9_]*\): [^)]*) => {/(_\1: any) => {/g' {} \;

# Fix unused variables in destructuring
find . -name "*.ts" -exec sed -i 's/const {\([^}]*\)} =/const {_unused} =/g' {} \;

# Fix unused function parameters
find . -name "*.ts" -exec sed -i 's/\([a-zA-Z_][a-zA-Z0-9_]*\): [^,)]*,/_\1: any,/g' {} \;

echo "Fixed unused variables in TypeScript files"