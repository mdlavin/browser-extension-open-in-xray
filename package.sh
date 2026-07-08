#!/usr/bin/env python3
import zipfile, os, datetime

now = datetime.datetime.now()
filename = now.strftime('open-in-xray-%Y%d%m-%H%M%S.zip')

files = [
    'manifest.json',
    'openSumoResultInXRay.js',
    'icons/open-in-xray-128.png',
    'icons/open-in-xray-48.png',
]

here = os.path.dirname(os.path.abspath(__file__))

with zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(here, f), f)

print(f'Created {filename} ({os.path.getsize(filename)} bytes)')
