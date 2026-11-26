#!/usr/bin/env bash
set -uo pipefail
mkdir -p probe/froast
UA="Mozilla/5.0 (compatible; bagof.fish user checker)"
for path in / /docs /docs/ /docs/json /docs/swagger.json /docs/openapi.json /swagger.json /openapi.json /api-docs /v1 /users/294568 /user/294568 /users/294568/posts /posts?author=294568 /search?author=294568 /threads/100000229 /thread/100000229 /posts/100000229; do
  safe=$(echo "$path" | tr '/?=&' '____')
  code=$(curl -s -m 30 -A "$UA" -o "probe/froast/api$safe.txt" -w '%{http_code} %{content_type} %{size_download}' "https://api.froast.io$path")
  echo "RESULT $code https://api.froast.io$path :: $(head -c 200 "probe/froast/api$safe.txt" | tr '\n\r' '  ')"
done | tee probe/froast/results.txt
# Pull any spec URL referenced by a Swagger UI page and fetch it.
for f in probe/froast/api_docs*.txt; do
  grep -oE '"[^"]*\.(json|yaml)"|url: *"[^"]+"' "$f" 2>/dev/null
done | tr -d '"' | sed 's/url: *//' | sort -u | while read -r u; do
  case "$u" in http*) full="$u";; /*) full="https://api.froast.io$u";; *) full="https://api.froast.io/docs/$u";; esac
  curl -s -m 30 -A "$UA" -o "probe/froast/spec_$(basename "$u")" -w "RESULT %{http_code} $full\n" "$full"
done | tee -a probe/froast/results.txt
