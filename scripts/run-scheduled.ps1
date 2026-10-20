param(
  [string]$Providers = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
if ($Providers) {
  & npm.cmd run -s scrape:all -- --providers $Providers
} else {
  & npm.cmd run -s scrape:all
}
exit $LASTEXITCODE
