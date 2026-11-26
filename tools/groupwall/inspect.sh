#!/usr/bin/env bash
# Inspect the Roblox Group Wall Archive: download, list, and sample its database.
set -uo pipefail
mkdir -p probe/groupwall work
df -h / /mnt 2>/dev/null | tee probe/groupwall/disk.txt
URL="https://archive.org/download/roblox-group-wall-archive/RobloxGroupWallArchive.7z"
curl -sSIL "$URL" | tee probe/groupwall/headers.txt
time curl -sSL --retry 5 -o /mnt/wall.7z "$URL" || time curl -sSL --retry 5 -o work/wall.7z "$URL"
ARCH=/mnt/wall.7z; [ -s "$ARCH" ] || ARCH=work/wall.7z
ls -l "$ARCH" | tee probe/groupwall/size.txt
7z l "$ARCH" | tee probe/groupwall/listing.txt
# Same for the small app archive (has the code that wrote the DB).
curl -sSL -o work/app.7z "https://archive.org/download/roblox-group-wall-archive/RobloxWallArchiverApp.7z" && 7z l work/app.7z > probe/groupwall/app-listing.txt && 7z x -y -owork/app work/app.7z >/dev/null
find work/app -type f \( -name "*.cs" -o -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.json" -o -name "*.md" -o -name "*.txt" -o -name "*.sql" -o -name "*.go" -o -name "*.rs" -o -name "*.config" \) -size -200k -exec cp --parents {} probe/groupwall/ \; 2>/dev/null
# Extract the biggest entry to /mnt and inspect it.
sudo chmod 777 /mnt
7z x -y -o/mnt/wall "$ARCH" > probe/groupwall/extract.txt 2>&1
find /mnt/wall -type f -exec ls -l {} \; | tee probe/groupwall/files.txt
for f in $(find /mnt/wall -type f); do
  echo "== $f" >> probe/groupwall/heads.txt
  file "$f" >> probe/groupwall/heads.txt
  head -c 3000 "$f" | strings -n 3 | head -60 >> probe/groupwall/heads.txt
  case "$(head -c 16 "$f")" in
    "SQLite format 3"*)
      sqlite3 "$f" ".tables" > "probe/groupwall/sqlite-$(basename "$f").txt"
      sqlite3 "$f" ".schema" >> "probe/groupwall/sqlite-$(basename "$f").txt"
      for t in $(sqlite3 "$f" ".tables"); do
        echo "-- $t count: $(sqlite3 "$f" "select count(*) from \"$t\"")" >> "probe/groupwall/sqlite-$(basename "$f").txt"
        sqlite3 -header "$f" "select * from \"$t\" limit 8" >> "probe/groupwall/sqlite-$(basename "$f").txt"
      done ;;
  esac
done
df -h / /mnt >> probe/groupwall/disk.txt
