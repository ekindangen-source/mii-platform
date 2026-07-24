[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({
    if (-not (Test-Path -LiteralPath $_ -PathType Leaf)) {
      throw "SSH key file not found: $_"
    }

    $true
  })]
  [string]$KeyPath,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Ec2Host,

  [string]$Ec2User = "ubuntu",

  [string]$Branch = "main",

  [string]$RemoteRepoPath = "/home/ubuntu/mii-platform",

  [string]$RemoteWebRoot = "/var/www/mii-platform",

  [string]$RemoteArchive = "/tmp/mii-frontend.tar.gz",

  [string]$ProjectRoot = "",

  [switch]$RestartApi,

  [switch]$AllowDirty,

  [switch]$SkipGitSync
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path

  if ([string]::IsNullOrWhiteSpace($ScriptDirectory)) {
    throw "Unable to determine the deployment script directory."
  }

  $ProjectRoot = Join-Path $ScriptDirectory ".."
}

function Write-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command is not available: $Name"
  }
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [Parameter()]
    [string[]]$Arguments = @()
  )

  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE"
  }
}

Assert-Command "git"
Assert-Command "npm.cmd"
Assert-Command "tar"
Assert-Command "scp"
Assert-Command "ssh"

$ProjectRoot = (
  Resolve-Path -LiteralPath $ProjectRoot
).Path

$FrontendPath = Join-Path $ProjectRoot "frontend"
$DistPath = Join-Path $FrontendPath "dist"
$ArchivePath = Join-Path $FrontendPath "mii-frontend.tar.gz"

if (-not (Test-Path -LiteralPath $FrontendPath -PathType Container)) {
  throw "Frontend directory not found: $FrontendPath"
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
  throw "Project root is not a Git repository: $ProjectRoot"
}

Write-Host "MII Platform Deployment" -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Target:  $Ec2User@$Ec2Host"
Write-Host "Branch:  $Branch"

if (-not $SkipGitSync) {
  Write-Step "Checking Git branch and working tree"

  Push-Location $ProjectRoot

  try {
    $CurrentBranch = (
      & git branch --show-current
    ).Trim()

    if ($LASTEXITCODE -ne 0) {
      throw "Unable to determine the current Git branch."
    }

    if ($CurrentBranch -ne $Branch) {
      throw (
        "Current branch is '$CurrentBranch'. " +
        "Switch to '$Branch' before deployment."
      )
    }

    $Changes = & git status --porcelain

    if (
      -not $AllowDirty -and
      -not [string]::IsNullOrWhiteSpace(
        ($Changes -join "`n")
      )
    ) {
      throw (
        "The working tree has uncommitted changes. " +
        "Commit them first or rerun with -AllowDirty."
      )
    }

    Write-Step "Pushing $Branch to GitHub"
    Invoke-Native "git" @(
      "push",
      "origin",
      $Branch
    )
  }
  finally {
    Pop-Location
  }
}

Write-Step "Building the React frontend"

Push-Location $FrontendPath

try {
  Invoke-Native "npm.cmd" @(
    "run",
    "build"
  )

  if (-not (Test-Path -LiteralPath $DistPath -PathType Container)) {
    throw "Vite did not create the dist directory."
  }

  Write-Step "Creating deployment archive"

  Remove-Item `
    -LiteralPath $ArchivePath `
    -Force `
    -ErrorAction SilentlyContinue

  Invoke-Native "tar" @(
    "-czf",
    $ArchivePath,
    "-C",
    $DistPath,
    "."
  )
}
finally {
  Pop-Location
}

$Archive = Get-Item -LiteralPath $ArchivePath

Write-Host (
  "Archive: {0} ({1:N0} bytes)" -f
  $Archive.FullName,
  $Archive.Length
)

Write-Step "Uploading frontend archive to EC2"

Invoke-Native "scp" @(
  "-i",
  $KeyPath,
  $ArchivePath,
  "${Ec2User}@${Ec2Host}:${RemoteArchive}"
)

$ApiCommands = ""

if ($RestartApi) {
  $ApiCommands = @'
sudo systemctl restart mii-api
sleep 3
sudo systemctl is-active mii-api
curl --fail --silent --show-error \
  http://127.0.0.1:3000/health
echo
curl --fail --silent --show-error \
  http://127.0.0.1:3000/health/db
echo
'@
}

$RemoteScript = @'
set -euo pipefail

echo "==> Updating EC2 Git repository"
cd "__REMOTE_REPO__"
git fetch origin
git pull --ff-only origin "__BRANCH__"

echo "==> Verifying uploaded archive"
test -s "__REMOTE_ARCHIVE__"
ls -lh "__REMOTE_ARCHIVE__"

echo "==> Backing up current live frontend"
sudo rm -rf "__REMOTE_WEB_ROOT__-backup"
sudo cp -a \
  "__REMOTE_WEB_ROOT__" \
  "__REMOTE_WEB_ROOT__-backup"

echo "==> Deploying new frontend"
sudo rm -rf "__REMOTE_WEB_ROOT__"/*
sudo tar -xzf \
  "__REMOTE_ARCHIVE__" \
  -C "__REMOTE_WEB_ROOT__"

echo "==> Applying web permissions"
sudo chown -R \
  www-data:www-data \
  "__REMOTE_WEB_ROOT__"

sudo find "__REMOTE_WEB_ROOT__" \
  -type d -exec chmod 755 {} \;

sudo find "__REMOTE_WEB_ROOT__" \
  -type f -exec chmod 644 {} \;

echo "==> Validating and reloading Nginx"
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl is-active nginx

__API_COMMANDS__

echo "==> Deployment completed successfully"
'@

$RemoteScript = $RemoteScript.Replace(
  "__REMOTE_REPO__",
  $RemoteRepoPath
).Replace(
  "__BRANCH__",
  $Branch
).Replace(
  "__REMOTE_ARCHIVE__",
  $RemoteArchive
).Replace(
  "__REMOTE_WEB_ROOT__",
  $RemoteWebRoot
).Replace(
  "__API_COMMANDS__",
  $ApiCommands
)

Write-Step "Deploying on EC2"

$RemoteScript |
  & ssh `
    -i $KeyPath `
    "${Ec2User}@${Ec2Host}" `
    "bash -s"

if ($LASTEXITCODE -ne 0) {
  throw (
    "Remote deployment failed with exit code " +
    "$LASTEXITCODE"
  )
}

Write-Step "Done"

Write-Host (
  "The frontend was built, uploaded, backed up, " +
  "deployed, and Nginx was reloaded."
) -ForegroundColor Green

if (-not $RestartApi) {
  Write-Host (
    "The API was not restarted. Use -RestartApi " +
    "when backend changes also need deployment."
  )
}
