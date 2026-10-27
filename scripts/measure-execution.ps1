param(
    [ValidateRange(1, 64)]
    [int]$Concurrency = 8
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runId = [guid]::NewGuid().ToString("N").Substring(0, 8)
$work = Join-Path $env:TEMP "equipzilla-execution-$stamp-$runId"
$zip = Join-Path $desktop "EZ-EXECUTION-$stamp-$runId.zip"

New-Item -ItemType Directory -Path $work -Force | Out-Null
Push-Location $repo
try {
    $basePath = Join-Path $work "baseline.json"
    $adjustedPath = Join-Path $work "candidate.json"
    $baseLog = Join-Path $work "baseline.log"
    $adjustedLog = Join-Path $work "candidate.log"

    Write-Host "Measuring baseline (concurrencia 6)"
    & node scripts/run-tests.mjs --medicion $basePath *> $baseLog
    $baseExit = $LASTEXITCODE

    if ($baseExit -eq 0) {
        Write-Host "Measuring candidate con concurrencia $Concurrency"
        & node scripts/run-tests.mjs --concurrencia $Concurrency --medicion $adjustedPath *> $adjustedLog
        $adjustedExit = $LASTEXITCODE
    } else {
        $adjustedExit = 1
    }

    $lines = @("Concurrency alternativa: $Concurrency", "Baseline exit code: $baseExit", "Candidate exit code: $adjustedExit")

    if (Test-Path $basePath) {
        $base = Get-Content $basePath -Raw -Encoding UTF8 | ConvertFrom-Json
        $lines += "Predeterminada (6): $([math]::Round($base.resumen.tiempo_ms)) ms, $($base.resumen.correctos) correctos, $($base.resumen.fallidos) fallidos"
        $base.pruebas | Sort-Object tiempo_ms -Descending | Select-Object -First 15 | Export-Csv (Join-Path $work "TOP15-BASELINE.csv") -NoTypeInformation -Delimiter ";" -Encoding UTF8
        $base.archivos | Sort-Object tiempo_ms -Descending | Select-Object -First 15 | Export-Csv (Join-Path $work "TOP15-ARCHIVOS-BASELINE.csv") -NoTypeInformation -Delimiter ";" -Encoding UTF8
    }

    if (Test-Path $adjustedPath) {
        $adjusted = Get-Content $adjustedPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $lines += "Alternativa ($Concurrency): $([math]::Round($adjusted.resumen.tiempo_ms)) ms, $($adjusted.resumen.correctos) correctos, $($adjusted.resumen.fallidos) fallidos"
        $adjusted.pruebas | Sort-Object tiempo_ms -Descending | Select-Object -First 15 | Export-Csv (Join-Path $work "TOP15-CANDIDATE.csv") -NoTypeInformation -Delimiter ";" -Encoding UTF8
        $adjusted.archivos | Sort-Object tiempo_ms -Descending | Select-Object -First 15 | Export-Csv (Join-Path $work "TOP15-ARCHIVOS-CANDIDATE.csv") -NoTypeInformation -Delimiter ";" -Encoding UTF8
        $baseIdentities = @($base.pruebas | ForEach-Object { "$($_.archivo) :: $($_.prueba) :: $($_.estado)" } | Sort-Object)
        $adjustedIdentities = @($adjusted.pruebas | ForEach-Object { "$($_.archivo) :: $($_.prueba) :: $($_.estado)" } | Sort-Object)
        $testIdentitiesSame = @(Compare-Object -ReferenceObject $baseIdentities -DifferenceObject $adjustedIdentities -CaseSensitive).Count -eq 0
        $same = $base.resumen.archivos -eq $adjusted.resumen.archivos -and
            $base.resumen.correctos -eq $adjusted.resumen.correctos -and
            $base.resumen.fallidos -eq $adjusted.resumen.fallidos -and
            $base.resumen.omitidos -eq $adjusted.resumen.omitidos -and
            $base.resumen.pendientes -eq $adjusted.resumen.pendientes -and
            $testIdentitiesSame
        $lines += "Equivalent tests: $testIdentitiesSame"
        $lines += "Equivalent counts: $same"
        $lines += "Diferencia candidate - baseline: $([math]::Round($adjusted.resumen.tiempo_ms - $base.resumen.tiempo_ms)) ms"
    }

    $lines | Set-Content (Join-Path $work "SUMMARY.txt") -Encoding UTF8
    Compress-Archive -Path (Join-Path $work "*") -DestinationPath $zip
    if (!(Test-Path $zip)) { throw "No se pudo generar el ZIP" }
    Get-Item $zip | Select-Object FullName, Length | Format-List
    $lines | ForEach-Object { Write-Host $_ }

    if ($baseExit -ne 0 -or $adjustedExit -ne 0 -or !$same) {
        Write-Warning "La medición no ha sido equivalente; revisa el ZIP antes de cambiar la concurrencia baseline."
        exit 1
    }
} finally {
    Pop-Location
}
