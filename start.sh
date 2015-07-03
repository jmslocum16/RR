#!/bin/bash

platform=`uname`

if [ "${platform}" == "Darwin" ]; then
	node server.js
else
	nodejs server.js
fi
