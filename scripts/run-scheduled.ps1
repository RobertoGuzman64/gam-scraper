param(
  [string]$Providers = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
if ($Providers) {
  & npm.cmd run -s extraer:todos -- --proveedores $Providers
} else {
  & npm.cmd run -s extraer:todos
}
exit $LASTEXITCODE
