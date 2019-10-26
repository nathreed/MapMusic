#!/bin/bash

rm -rf docs/dist
mkdir docs/dist
browserify index.js > docs/dist/index.js
