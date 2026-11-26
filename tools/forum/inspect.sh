#!/usr/bin/env bash
set -uo pipefail
mkdir -p probe/forum
K='100000229-1.gz~100001184-1.gz'
for host in rbx-archive.s3-eu-west-1.amazonaws.com rbx-archive.s3.us-west-2.amazonaws.com s3.us-west-2.amazonaws.com/rbx-archive rbx-archive.s3.amazonaws.com; do
  for key in "$K" "$K/100000229-1.gz" "100000229-1.gz"; do
    enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$key")
    code=$(curl -s -o /tmp/o -w '%{http_code}' "https://$host/$enc")
    echo "RESULT $code $host/$key $(head -c 160 /tmp/o | tr '\n' ' ')" | tee -a probe/forum/direct.txt
  done
done
curl -sI https://rbx-archive.s3.amazonaws.com/ | sed 's/^/RESULT /' | tee -a probe/forum/direct.txt
