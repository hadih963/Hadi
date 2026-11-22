#!/usr/bin/env bash
# Downloads a few public-domain paintings from Wikimedia Commons into public/paintings/.
# Run on your laptop (needs internet): bash scripts/fetch-paintings.sh
# Add your own: drop any .jpg/.png/.webp into public/paintings/. Files are git-ignored.
set -u
cd "$(dirname "$0")/../public/paintings" || exit 1
UA="tv-dashboard-paintings/1.0 (personal use)"
# "local-name|Wikimedia file name"
LIST=(
  "10-vermeer-view-of-delft.jpg|Vermeer-view-of-delft.jpg"
  "20-van-gogh-starry-night.jpg|Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg"
  "30-hokusai-great-wave.jpg|Tsunami_by_hokusai_19th_century.jpg"
  "40-monet-impression-sunrise.jpg|Monet_-_Impression,_Sunrise.jpg"
  "50-van-gogh-wheatfield-with-cypresses.jpg|Vincent_van_Gogh_-_Wheat_Field_with_Cypresses_(1889).jpg"
)
for item in "${LIST[@]}"; do
  out="${item%%|*}"; file="${item#*|}"
  if [ -s "$out" ]; then echo "have  $out"; continue; fi
  url="https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1920"
  if curl -fsSL -A "$UA" -o "$out" "$url"; then echo "got   $out"; else echo "FAIL  $out (skipped)"; rm -f "$out"; fi
done
echo "Done. Paintings in: $(pwd)"
