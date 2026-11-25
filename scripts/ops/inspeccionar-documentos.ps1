# Inspeccion manual de documentos de tecnicos, para correr desde el equipo del propietario (una vez al dia).
# Actualiza las firmas de ClamAV, comprueba que todo este listo y procesa la cola hasta vaciarla.
# Los secretos viven FUERA del repositorio, en $env:USERPROFILE\.soyfixo\inspeccion.env (ver docs/production/LOCAL_INSPECTION_GUIDE.md).
# Este archivo se mantiene en ASCII para que Windows PowerShell 5.1 lo lea bien.
param(
  [string]$EnvFile = (Join-Path $env:USERPROFILE ".soyfixo\inspeccion.env"),
  [switch]$SoloComprobar
)
$ErrorActionPreference = "Stop"

function Stop-Run([string]$Message) { Write-Host "NO SE EJECUTO: $Message" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $EnvFile)) { Stop-Run "falta el archivo de configuracion $EnvFile" }
$allowed = "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FIXO_INSPECTION_PROJECT", "FIXO_CLAMSCAN_PATH", "FIXO_CLAMAV_DATABASE_DIR"
$values = @{}
foreach ($line in Get-Content -Path $EnvFile -Encoding UTF8) {
  if ($line -match '^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$') { $values[$Matches[1]] = $Matches[2].Trim('"', "'") }
}
foreach ($name in $allowed) { if (-not $values[$name]) { Stop-Run "falta $name en $EnvFile" } }

$clamscan = $values["FIXO_CLAMSCAN_PATH"]
$database = $values["FIXO_CLAMAV_DATABASE_DIR"]
if (-not (Test-Path $clamscan)) { Stop-Run "no existe clamscan en $clamscan" }
if (-not (Test-Path $database)) { Stop-Run "no existe la carpeta de firmas $database" }

# 1. Firmas al dia
$freshclam = Join-Path (Split-Path $clamscan) "freshclam.exe"
if (-not (Test-Path $freshclam)) { Stop-Run "no existe freshclam.exe junto a clamscan" }
Write-Host "Actualizando firmas de antivirus..."
& $freshclam "--datadir=$database"
if ($LASTEXITCODE -ne 0) { Write-Host "freshclam termino con codigo $LASTEXITCODE; se revisa la fecha de las firmas." -ForegroundColor Yellow }

# 2. Antes de tomar documentos de la cola: con firmas vencidas cada intento fallaria y gastaria reintentos (maximo 5).
$daily = Get-ChildItem -Path $database -File | Where-Object { $_.Name -match '^daily\.(cvd|cld)$' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $daily) { Stop-Run "no hay firmas 'daily' en $database" }
$age = (Get-Date) - $daily.LastWriteTime
if ($age.TotalHours -ge 47) { Stop-Run ("las firmas tienen {0:N0} horas (limite 48). Revisa freshclam." -f $age.TotalHours) }

if ($SoloComprobar) { Write-Host "Todo listo. No se proceso ningun documento (-SoloComprobar)." -ForegroundColor Green; exit 0 }

# 3. Procesar la cola. Las variables solo viven en este proceso.
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
foreach ($name in $allowed) { Set-Item -Path "Env:$name" -Value $values[$name] }
Push-Location $repo
try {
  & node "scripts\inspection-worker.mjs" --drain
  $code = $LASTEXITCODE
} finally {
  Pop-Location
  foreach ($name in $allowed) { Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue }
}
if ($code -ne 0) { Stop-Run "el inspector termino con error (codigo $code). No se publica ningun documento sin inspeccion." }
Write-Host "Listo: cola procesada." -ForegroundColor Green
