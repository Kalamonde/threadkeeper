<#
.SYNOPSIS
  Pre-publish scan: fails if any file git would publish, or any commit message
  or author line, holds a private term. Run before every push.

.DESCRIPTION
  Two kinds of rules:
  - Built-in rules below: generic patterns only (app ids, ticket keys, task ids).
  - Private terms: read from tools/scan-terms.local.txt, which git ignores and
    which never leaves your computer. Copy tools/scan-terms.example.txt to start.
    The scan refuses to run without it, and fails if it is ever tracked by git.

  Scans tracked files plus new files not ignored. File paths are scanned too.
  Binary images are skipped (check them by eye). Commit messages and author and
  committer lines of every commit on HEAD are scanned for the private terms.

  False positives go in tools/scan-allow.txt, one per line:
      <path or wildcard>|<regex that the matched text must match>
  Exit code 0 = clean, 1 = findings, 2 = could not run.

.EXAMPLE
  pwsh -File tools/scan.ps1
#>
[CmdletBinding()]
param(
    [string]$Root
)

$ErrorActionPreference = 'Stop'
# Set here, not in param(): Windows PowerShell 5.1 has no $PSScriptRoot there.
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }

# Built-in generic rules: name, regex, case-sensitive?
$rules = @(
    @('section id',     '\bcg-[0-9a-f]{8}',                                $false),
    @('thread id',      '\blocal_[0-9a-f]{8}',                             $false),
    @('ticket key',     '\b[A-Z][A-Z0-9]{1,9}-\d+\b',                      $true),
    @('task id',        '\b1[12]\d{14}\b',                                 $false)
)

$termsRel = 'tools/scan-terms.local.txt'
$skipPaths = @('tools/scan.ps1', 'tools/scan-allow.txt', 'tools/scan-terms.example.txt')
$binary = '\.(png|jpe?g|gif|ico|webp|zip)$'

try {
    Push-Location $Root
    $tracked = @(git -c core.quotePath=false ls-files)
    if ($LASTEXITCODE -ne 0) { throw 'git ls-files failed' }
    $new = @(git -c core.quotePath=false ls-files --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'git ls-files --others failed' }
} catch {
    Write-Host "Scan could not run: $_" -ForegroundColor Red
    exit 2
}

# The private terms file must exist and must never be published.
$termsFile = Join-Path $Root $termsRel
if (($tracked + $new) -contains $termsRel) {
    Pop-Location
    Write-Host "Scan FAILED: $termsRel would be published. Remove it from git (git rm --cached) and check .gitignore." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $termsFile -PathType Leaf)) {
    Pop-Location
    Write-Host "Scan could not run: $termsRel is missing. Copy tools/scan-terms.example.txt to it and add your private terms." -ForegroundColor Red
    exit 2
}

# Private terms: <rule name>|<regex>|<cs or ci>
$private = @()
$lineNo = 0
foreach ($line in Get-Content $termsFile) {
    $lineNo++
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    # The regex may hold | itself: the name ends at the first |, the flag follows the last |.
    $first = $t.IndexOf('|')
    if ($first -lt 1) {
        Pop-Location
        Write-Host "Scan could not run: $termsRel line $lineNo is not <name>|<regex>|<cs or ci>." -ForegroundColor Red
        exit 2
    }
    $name = $t.Substring(0, $first).Trim()
    $rest = $t.Substring($first + 1)
    $last = $rest.LastIndexOf('|')
    $cs = $false
    if (($last -ge 0) -and (@('cs', 'ci') -contains $rest.Substring($last + 1).Trim())) {
        $cs = $rest.Substring($last + 1).Trim() -eq 'cs'
        $rest = $rest.Substring(0, $last)
    }
    $regex = $rest.Trim()
    try { [void][regex]::new($regex) } catch {
        Pop-Location
        Write-Host "Scan could not run: $termsRel line $lineNo has a bad regex: $regex" -ForegroundColor Red
        exit 2
    }
    $private += ,@($name, $regex, $cs)
}
if ($private.Count -eq 0) {
    Pop-Location
    Write-Host "Scan could not run: $termsRel has no terms." -ForegroundColor Red
    exit 2
}
$rules += $private

$files = @($tracked + $new | Where-Object { $_ } | Sort-Object -Unique)

$allow = @()
$allowFile = Join-Path $Root 'tools/scan-allow.txt'
if (Test-Path $allowFile) {
    $allow = Get-Content $allowFile | Where-Object { $_ -and -not $_.StartsWith('#') } | ForEach-Object {
        $parts = $_ -split '\|', 2
        [pscustomobject]@{ Path = $parts[0].Trim(); Text = $parts[1].Trim() }
    }
}

function Test-Allowed([string]$path, [string]$found) {
    foreach ($a in $allow) {
        if (($path -like $a.Path) -and ($found -match $a.Text)) { return $true }
    }
    return $false
}

function Find-Terms([string]$path, [string]$text, [int]$lineNo, $ruleSet) {
    $hits = @()
    foreach ($r in $ruleSet) {
        $opts = if ($r[2]) { [System.Text.RegularExpressions.RegexOptions]::None } else { [System.Text.RegularExpressions.RegexOptions]::IgnoreCase }
        foreach ($m in [regex]::Matches($text, $r[1], $opts)) {
            if (-not (Test-Allowed $path $m.Value)) {
                $hits += [pscustomobject]@{ File = $path; Line = $lineNo; Rule = $r[0]; Found = $m.Value }
            }
        }
    }
    return $hits
}

$findings = @()
foreach ($f in $files) {
    if ($skipPaths -contains $f) { continue }
    $findings += Find-Terms $f $f 0 $rules
    if ($f -match $binary) { continue }
    $full = Join-Path $Root $f
    if (-not (Test-Path $full -PathType Leaf)) { continue }
    $n = 0
    foreach ($line in [System.IO.File]::ReadLines($full)) {
        $n++
        $findings += Find-Terms $f $line $n $rules
    }
}

# Commit messages, authors and committers on HEAD (none yet in a new repo).
$commits = 0
git rev-parse --verify --quiet HEAD *> $null
if ($LASTEXITCODE -eq 0) {
    $log = @(git -c core.quotePath=false log --format='%h%x09%an <%ae>%x09%cn <%ce>%x09%s%x09%b%x1e' HEAD)
    $rs = [string][char]0x1e
    foreach ($entry in (($log -join "`n") -split $rs)) {
        $e = $entry.Trim()
        if (-not $e) { continue }
        $commits++
        $sha = ($e -split "`t", 2)[0]
        $findings += Find-Terms "commit $sha" $e 0 $private
    }
}
Pop-Location

if ($findings.Count -gt 0) {
    $findings | Format-Table File, Line, Rule, Found -AutoSize | Out-String -Width 200 | Write-Host
    Write-Host "Scan FAILED: $($findings.Count) finding(s) in $($files.Count) files and $commits commits. Fix them or add a line to tools/scan-allow.txt." -ForegroundColor Red
    exit 1
}
$images = @($files | Where-Object { $_ -match $binary })
Write-Host "Scan clean: $($files.Count) files and $commits commits checked, $($private.Count) private terms." -ForegroundColor Green
if ($images.Count -gt 0) { Write-Host "Check these images by eye: $($images -join ', ')" -ForegroundColor Yellow }
exit 0
