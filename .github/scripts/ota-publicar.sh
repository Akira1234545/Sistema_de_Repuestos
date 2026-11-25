#!/usr/bin/env bash
# Publica la web de la app como actualización OTA en la rama «ota» (lo llama ota-publicar.yml).
set -euo pipefail
LOG="$RUNNER_TEMP/ota.log"
paso() { echo "== $1" | tee -a "$LOG"; }
fallo() {
  # Deja el final del registro como anotación del job, visible desde la API de GitHub.
  echo "::error title=OTA falló::$(tail -c 1800 "$LOG" | tr '\n' ' ' | sed 's/%/%25/g')"
}
trap fallo ERR
exec > >(tee -a "$LOG") 2>&1

VERSION=${GITHUB_SHA::7}
RAW="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/ota/android"
REMOTE="${OTA_REMOTE:-https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}}"
OUT="$RUNNER_TEMP/ota-out"
REPO="$RUNNER_TEMP/ota-repo"

paso "lint"
npm run lint
paso "compilar $VERSION"
VITE_APP_VERSION=$VERSION npm run build

paso "empaquetar"
MIN_BUILD=$(grep -oE 'versionCode [0-9]+' android/app/build.gradle | grep -oE '[0-9]+')
mkdir -p "$OUT"
(cd dist && zip -qr "$OUT/bundle-${VERSION}.zip" .)
SUM=$(sha256sum "$OUT/bundle-${VERSION}.zip" | cut -d' ' -f1)
node --input-type=commonjs -e '
  const [version, url, checksum, minBuild, commit, out] = process.argv.slice(1)
  const manifest = { version, url, checksum, minBuild: Number(minBuild), commit, publicado: new Date().toISOString() }
  require("fs").writeFileSync(out + "/latest.json", JSON.stringify(manifest, null, 2) + "\n")
' "$VERSION" "$RAW/bundle-${VERSION}.zip" "$SUM" "$MIN_BUILD" "$GITHUB_SHA" "$OUT"
cat "$OUT/latest.json"

paso "preparar rama ota"
if git ls-remote --exit-code "$REMOTE" ota >/dev/null 2>&1; then
  git clone -q --depth 1 --branch ota "$REMOTE" "$REPO"
  PREV=$(node --input-type=commonjs -e 'try { console.log(require(process.argv[1]).version) } catch {}' "$REPO/android/latest.json")
else
  mkdir -p "$REPO" && git -C "$REPO" init -q -b ota
  PREV=""
fi
mkdir -p "$REPO/android"
# Se conserva el paquete anterior por si un teléfono lo está descargando; el resto se borra.
find "$REPO/android" -name 'bundle-*.zip' ! -name "bundle-${PREV:-ninguno}.zip" -delete
cp "$OUT"/* "$REPO/android/"
printf '# Actualizaciones de DriveFix\n\nRama generada por GitHub Actions (ota-publicar.yml). No editar a mano.\n' > "$REPO/README.md"

paso "publicar"
cd "$REPO"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
# Un solo commit, para que la rama no crezca con cada paquete.
git checkout -q --orphan nueva
git commit -qm "OTA $VERSION"
git branch -M nueva ota
git push -f "$REMOTE" ota
paso "listo: $RAW/latest.json"
