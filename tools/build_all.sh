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
