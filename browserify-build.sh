#!/bin/bash

rm -rf gh-pages/dist
mkdir gh-pages/dist
browserify index.js > gh-pages/dist/index.js
