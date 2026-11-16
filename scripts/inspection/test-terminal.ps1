[CmdletBinding()]
param(
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('equipzilla-terminal-' + [guid]::NewGuid().ToString('N').Substring(0, 10))
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) { throw 'El directorio de diagnóstico ya existe; elige uno nuevo' }
[void][System.IO.Directory]::CreateDirectory($OutputDirectory)

$node = (Get-Command node -ErrorAction Stop).Source
$specs = @(
    @{ Name = 'json'; Arguments = 'scripts/inspection/terminal-probe.mjs --json'; Expected = 0 },
    @{ Name = 'streams'; Arguments = 'scripts/inspection/terminal-probe.mjs --streams'; Expected = 17 },
    @{ Name = 'exception'; Arguments = 'scripts/inspection/terminal-probe.mjs --exception'; Expected = 1 },
    @{ Name = 'help'; Arguments = 'scripts/tooling.mjs ayuda'; Expected = 0 },
    @{ Name = 'error'; Arguments = 'scripts/tooling.mjs comando-inexistente'; Expected = 1 }
)

$results = @()
foreach ($spec in $specs) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $node
    $info.Arguments = $spec.Arguments
    $info.WorkingDirectory = $root
    $info.CreateNoWindow = $true
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.RedirectStandardInput = $true
    $info.StandardOutputEncoding = $utf8
    $info.StandardErrorEncoding = $utf8
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw 'No se pudo iniciar Node' }
        $process.StandardInput.Close()
        $stdoutPending = $process.StandardOutput.ReadToEndAsync()
        $stderrPending = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $stdout = $stdoutPending.GetAwaiter().GetResult()
        $stderr = $stderrPending.GetAwaiter().GetResult()
        [System.IO.File]::WriteAllText((Join-Path $OutputDirectory ($spec.Name + '.stdout.txt')), $stdout, $utf8)
        [System.IO.File]::WriteAllText((Join-Path $OutputDirectory ($spec.Name + '.stderr.txt')), $stderr, $utf8)
        $expectedExit = $process.ExitCode -eq $spec.Expected
        $plain = -not ($stdout.Contains([string][char]27) -or $stderr.Contains([string][char]27))
        $validUtf8 = -not ($stdout.Contains([string][char]0xfffd) -or $stderr.Contains([string][char]0xfffd))
        $contentValid = switch ($spec.Name) {
            'json' {
                try { (ConvertFrom-Json -InputObject $stdout).text -eq 'á é í ó ú ñ █ ✓' }
                catch { $false }
            }
            'streams' { $stdout -eq "SALIDA | á é í ó ú ñ █ ✓`n" -and $stderr -eq "ERROR | á é í ó ú ñ █ ✓`n" }
            'exception' { $stderr.Contains('Excepción de diagnóstico: á é í ó ú ñ') }
            'help' { $stdout.Contains('EQUIPZILLA') }
            'error' { $stderr.Contains('Comando desconocido') }
        }
        $results += [pscustomobject]@{
            name = $spec.Name
            expectedExit = $spec.Expected
            actualExit = $process.ExitCode
            exitCorrect = $expectedExit
            noAnsi = $plain
            validUtf8 = $validUtf8
            contentCorrect = [bool]$contentValid
        }
    } finally {
        $process.Dispose()
    }
}

$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$manifest = [pscustomobject]@{
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    psVersion = $PSVersionTable.PSVersion.ToString()
    hostName = $Host.Name
    administrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    consoleOutputEncoding = [Console]::OutputEncoding.WebName
    powershellOutputEncoding = $OutputEncoding.WebName
    codePage = (chcp)
    windowsTerminal = -not [string]::IsNullOrEmpty($env:WT_SESSION)
    vsCode = $env:TERM_PROGRAM -eq 'vscode'
    noColor = -not [string]::IsNullOrEmpty($env:NO_COLOR)
    results = $results
}
$manifestPath = Join-Path $OutputDirectory 'manifest.json'
[System.IO.File]::WriteAllText($manifestPath, (ConvertTo-Json -InputObject $manifest -Depth 7) + "`n", $utf8)
Write-Output "DIAGNOSTICO | $manifestPath"
foreach ($item in $results) {
    Write-Output ("{0} | codigo={1} | sinANSI={2} | UTF8={3} | contenido={4}" -f $item.name, $item.exitCorrect, $item.noAnsi, $item.validUtf8, $item.contentCorrect)
}
if ($results.Count -ne $specs.Count -or @($results | Where-Object { -not $_.exitCorrect -or -not $_.noAnsi -or -not $_.validUtf8 -or -not $_.contentCorrect }).Count -gt 0) {
    exit 1
}
