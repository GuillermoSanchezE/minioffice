#!/bin/bash
# Evidencias de distribución en macOS: firma, entitlements, Gatekeeper, fusibles,
# arquitecturas y versión mínima de cada binario, e instalador .dmg.
#   bash pruebas/evidencias-mac.sh dist/mac-arm64/minioffice.app dist/mac/minioffice.app
set -u

echo "## Sistema"
sw_vers
uname -m
xcodebuild -version 2>/dev/null | head -1
if arch -x86_64 /usr/bin/true 2>/dev/null; then echo "Rosetta 2: disponible"; else echo "Rosetta 2: NO disponible"; fi

for APP in "$@"; do
  echo
  echo "################ $APP"
  [ -d "$APP" ] || { echo "no existe"; continue; }
  du -sh "$APP"

  echo "## Firma (codesign -dvvv)"
  codesign -dvvv "$APP" 2>&1 | grep -E "^(Identifier|Format|CodeDirectory|Signature|Authority|TeamIdentifier|Runtime|Timestamp|Info.plist|Sealed)"

  echo "## Verificación estricta"
  codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tail -3

  echo "## Entitlements de la app"
  codesign -d --entitlements - --xml "$APP" 2>/dev/null | plutil -p - 2>/dev/null || echo "(ninguno)"

  echo "## Entitlements de los helpers"
  for H in "$APP"/Contents/Frameworks/*.app; do
    echo "-- $(basename "$H"): $(codesign -dv "$H" 2>&1 | grep -o 'flags=[^ ]*')"
    codesign -d --entitlements - --xml "$H" 2>/dev/null | plutil -p - 2>/dev/null || echo "   (ninguno)"
  done

  echo "## Gatekeeper (spctl)"
  spctl -a -vvv -t exec "$APP" 2>&1 | head -5

  echo "## Gatekeeper simulando una descarga (atributo de cuarentena)"
  COPIA="$(mktemp -d)/minioffice.app"
  ditto "$APP" "$COPIA"
  xattr -w com.apple.quarantine "0081;$(printf %x "$(date +%s)");Safari;" "$COPIA"
  spctl -a -vvv -t exec "$COPIA" 2>&1 | head -5
  rm -rf "$(dirname "$COPIA")"

  echo "## Preparación para notarizar (syspolicy_check distribution)"
  syspolicy_check distribution "$APP" 2>&1 | head -40 || true

  echo "## Info.plist"
  plutil -p "$APP/Contents/Info.plist"

  echo "## Fusibles de Electron"
  npx --yes @electron/fuses read --app "$APP" 2>&1 | tail -12

  echo "## Binarios Mach-O: arquitecturas | macOS mínimo | firma | ruta"
  find "$APP" -type f \( -perm -u+x -o -name '*.node' -o -name '*.dylib' -o -name '*.so' \) -print0 |
    while IFS= read -r -d '' F; do
      file -b "$F" | grep -q 'Mach-O' || continue
      ARCHS=$(lipo -archs "$F" 2>/dev/null)
      MINOS=$(vtool -show-build "$F" 2>/dev/null | awk '/minos/ {print $2}' | sort -u | tr '\n' ' ')
      FIRMA=$(codesign -dv "$F" 2>&1 | grep -o 'flags=[^ ]*' || echo 'sin-firma')
      echo "$ARCHS | $MINOS| $FIRMA | ${F#"$APP"/}"
    done | sort -t'|' -k4

  echo "## node-pty desempaquetado"
  ls -la "$APP/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/"*/ 2>&1 | head -20
  ls -la "$APP/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/" 2>&1 | head -10
done

echo
echo "################ Instaladores"
for DMG in dist/*.dmg; do
  [ -f "$DMG" ] || continue
  echo "-- $DMG ($(du -h "$DMG" | cut -f1))"
  shasum -a 256 "$DMG"
  hdiutil imageinfo "$DMG" 2>/dev/null | grep -E "^Format:|Checksum Type|Checksum Value" | head -3
  codesign -dv "$DMG" 2>&1 | head -2
  hdiutil verify "$DMG" 2>&1 | tail -1
done
ls -la dist/ | grep -E "\.yml|\.blockmap|\.zip" || echo "Sin archivos de actualización (latest-mac.yml, .blockmap, .zip)"
