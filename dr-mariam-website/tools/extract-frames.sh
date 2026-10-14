#!/usr/bin/env bash
# Builds the hero scroll-sequence frames from a source video.
# Usage: tools/extract-frames.sh path/to/video.mp4 [version]
# Writes assets/seq/dna-<version>/lg (every frame, 1280 px wide) and
# assets/seq/dna-<version>/sm (every 2nd frame, 854 px wide, for phones).
# Bump the version whenever the video changes: the folder name is what lets
# the server cache frames forever (see _headers, vercel.json, .htaccess),
# and then update data-src / data-frames on #seqCanvas in index.html.
set -euo pipefail
SRC="${1:?usage: tools/extract-frames.sh video.mp4 [version]}"
VER="${2:-v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/seq/dna-$VER"
mkdir -p "$OUT/lg" "$OUT/sm"
rm -f "$OUT"/lg/*.webp "$OUT"/sm/*.webp
ffmpeg -v error -i "$SRC" -an -vf "scale=1280:-2:flags=lanczos" \
  -c:v libwebp -quality 60 -compression_level 6 "$OUT/lg/%04d.webp"
ffmpeg -v error -i "$SRC" -an -vf "select='not(mod(n\,2))',scale=854:-2:flags=lanczos" -fps_mode vfr \
  -c:v libwebp -quality 60 -compression_level 6 "$OUT/sm/%04d.webp"
echo "lg: $(ls "$OUT/lg" | wc -l) frames, $(du -sh "$OUT/lg" | cut -f1)"
echo "sm: $(ls "$OUT/sm" | wc -l) frames, $(du -sh "$OUT/sm" | cut -f1)"
