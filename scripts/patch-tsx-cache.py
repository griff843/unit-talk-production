#!/usr/bin/env python3
"""Patch tsx cache to remove BridgeWorker .lt() bug."""
import json
import glob
import os
import sys

cache_files = glob.glob('/tmp/tsx-*/*')
patched = False

for f in cache_files:
    try:
        with open(f) as fh:
            d = json.load(fh)
        code = d.get('code', '')
        old_pattern = '.lt("retry_count",this.requireSupabase().from("events").select("max_retries"))'
        if old_pattern in code:
            code = code.replace(old_pattern, '')
            d['code'] = code
            with open(f, 'w') as out:
                json.dump(d, out)
            print(f'PATCHED: {f}')
            patched = True
    except (json.JSONDecodeError, IOError):
        continue

if not patched:
    print('No files needed patching')
else:
    print('Done - restart tsx process to apply')
