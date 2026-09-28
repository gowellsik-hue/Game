#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
TOOLS="$ROOT/repo/tools"
GAME_URL="${GAME_URL:?}"
GAME_SHA256="${GAME_SHA256:?}"
FAIRY_URL="${FAIRY_URL:?}"
FAIRY_SHA256="${FAIRY_SHA256:?}"
FAIRY_7Z_PASSWORD="${FAIRY_7Z_PASSWORD:?}"

build_preload_package() {
  local site="$1"
  local prefix="$2"
  local game="$site/gameasync"
  local packager="$ROOT/engine/deps/emsdk/upstream/emscripten/tools/file_packager.py"
  source "$ROOT/engine/deps/emsdk/emsdk_env.sh" >/dev/null
  mkdir -p "$game/Graphics/Pictures"
  touch "$game/Graphics/Pictures/.slkeep"
  local args=()
  add_dir(){ local src="$1" dst="$2"; [ -e "$src" ] && args+=(--preload "$src@$dst"); }
  add_dir "$game/Data" /game/Data
  for d in Animations Autotiles Battlebacks Battlers Characters Fogs Gameovers Icons Panoramas Tilesets Titles Transitions Windowskins; do
    add_dir "$game/Graphics/$d" "/game/Graphics/$d"
  done
  add_dir "$game/Graphics/Pictures/.slkeep" /game/Graphics/Pictures/.slkeep
  for d in SE ME BGS; do add_dir "$game/Audio/$d" "/game/Audio/$d"; done
  add_dir "$game/BM" /game/BM
  add_dir "$game/Fonts" /game/Fonts
  for f in Game.ini Lineage.ini rgss.rb; do add_dir "$game/$f" "/game/$f"; done
  python3 "$packager" "$site/$prefix.data" "${args[@]}" --js-output="$site/$prefix.js" --no-node
  rm -f "$game/Graphics/Pictures/.slkeep"
  test -s "$site/$prefix.data" && test -s "$site/$prefix.js"
  du -h "$site/$prefix.data"
}

curl -L --fail --retry 3 -o game.zip "$GAME_URL"
echo "$GAME_SHA256  game.zip" | sha256sum -c -
curl -L --fail --retry 3 -o fairy-source.zip "$FAIRY_URL"
echo "$FAIRY_SHA256  fairy-source.zip" | sha256sum -c -
unzip -q game.zip -d src
rm -rf player
cp -a engine/build player
rm -rf player/gameasync player/preload
mkdir -p player/gameasync/Fonts player/preload
cp -a src/SLKnight_Android_JoiPlay/. player/gameasync/
cp engine/extra/rgss.rb player/gameasync/rgss.rb
cp engine/COPYING player/COPYING-mkxp-web.txt
cp /usr/share/fonts/truetype/nanum/NanumGothic.ttf player/gameasync/Fonts/NanumGothic.ttf
cp /usr/share/fonts/truetype/nanum/NanumGothicBold.ttf player/gameasync/Fonts/NanumGothicBold.ttf
rm -f player/gameasync/Save*.rxdata player/gameasync/README_Android.txt
ruby -EUTF-8:UTF-8 -rzlib "$TOOLS/patch_knight_base.rb" player/gameasync
ruby -EUTF-8:UTF-8 "$TOOLS/patch_knight_items.rb"
ruby -EUTF-8:UTF-8 "$TOOLS/patch_knight_runtime.rb" player
python3 "$TOOLS/convert_knight_media.py"
(cd player/gameasync && bash ../../engine/extra/make_mapping.sh)
build_preload_package player slknight-core-v148
rm -f player/gameasync/bitmap-map.js
python3 "$TOOLS/patch_drive.py"
cp "$TOOLS/mobile-ui.js" player/js/dpad.js
ruby "$TOOLS/patch_browser.rb" player/index.html
touch player/.nojekyll
for f in player/mkxp.js player/mkxp.wasm player/gameasync/Data/Scripts.rxdata player/gameasync/mapping.js player/slknight-core-v148.data player/slknight-core-v148.js; do test -s "$f"; done
node --check player/js/drive.js
node --check player/js/dpad.js
ruby -EUTF-8:UTF-8 -rzlib "$TOOLS/verify_knight.rb" player/gameasync/Data/Scripts.rxdata
ruby "$TOOLS/verify_knight_items.rb"

rm -rf /tmp/fairy_pkg /tmp/fairy_raw /tmp/fairy_game fairy_player
mkdir -p /tmp/fairy_pkg /tmp/fairy_raw /tmp/fairy_game
unzip -q fairy-source.zip -d /tmp/fairy_pkg
7z x /tmp/fairy_pkg/SLFairy_Win_241226.7z -p"$FAIRY_7Z_PASSWORD" -o/tmp/fairy_raw -y >/tmp/fairy_7z.log
python3 "$TOOLS/rgssad_extract.py" --selftest
python3 "$TOOLS/rgssad_extract.py" /tmp/fairy_raw/Game.rgssad /tmp/fairy_game
cp /tmp/fairy_raw/Game.ini /tmp/fairy_game/Game.ini
if [ -d /tmp/fairy_raw/Audio ]; then mkdir -p /tmp/fairy_game/Audio; cp -a /tmp/fairy_raw/Audio/. /tmp/fairy_game/Audio/; fi
cp -a player fairy_player
rm -rf fairy_player/gameasync fairy_player/preload
rm -f fairy_player/slknight-core-v148.data fairy_player/slknight-core-v148.js
mkdir -p fairy_player/gameasync/Fonts fairy_player/preload
cp -a /tmp/fairy_game/. fairy_player/gameasync/
cp engine/extra/rgss.rb fairy_player/gameasync/rgss.rb
cp /usr/share/fonts/truetype/nanum/NanumGothic.ttf fairy_player/gameasync/Fonts/NanumGothic.ttf
cp /usr/share/fonts/truetype/nanum/NanumGothicBold.ttf fairy_player/gameasync/Fonts/NanumGothicBold.ttf
rm -f fairy_player/gameasync/Game.rgssad fairy_player/gameasync/Save*.rxdata
ruby -EUTF-8:UTF-8 "$TOOLS/patch_fairy.rb" fairy_player/gameasync
python3 "$TOOLS/convert_fairy_media.py"
(cd fairy_player/gameasync && bash ../../engine/extra/make_mapping.sh)
build_preload_package fairy_player slfairy-core-v148
rm -f fairy_player/gameasync/bitmap-map.js
python3 "$TOOLS/fairy_identity.py"
touch fairy_player/.nojekyll
node --check fairy_player/js/drive.js
node --check fairy_player/js/dpad.js
ruby -rzlib "$TOOLS/verify_fairy.rb" fairy_player/gameasync/Data/Scripts.rxdata

test -s fairy_player/slfairy-core-v148.data
test -s fairy_player/slfairy-core-v148.js

rm -rf /tmp/sl_dual_site
mkdir -p /tmp/sl_dual_site/knight /tmp/sl_dual_site/elf
cp -a player/. /tmp/sl_dual_site/knight/
cp -a fairy_player/. /tmp/sl_dual_site/elf/
cp "$TOOLS/launcher.html" /tmp/sl_dual_site/index.html
touch /tmp/sl_dual_site/.nojekyll
rm -rf player fairy_player
mv /tmp/sl_dual_site player
