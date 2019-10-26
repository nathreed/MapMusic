#!/bin/bash

rm -rf dist
mkdir dist
browserify index.js > dist/index.js
