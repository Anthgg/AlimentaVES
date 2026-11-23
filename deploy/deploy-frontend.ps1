param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Container })]
    [string]$FrontendPath
)

$ErrorActionPreference = "Stop"

$ProjectId = "alimentaves-demo-2026-anthg"
$Region = "us-east1"
$FrontendService = "alimentaves-web"
$ApiService = "alimentaves-api"
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$FrontendPath = (Resolve-Path $FrontendPath).Path
$FrontendRepoRoot = (& git -C $FrontendPath rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or -not $FrontendRepoRoot) {
    throw "FrontendPath must point inside a Git worktree."
}
$ExpectedFrontendPath = (Resolve-Path (Join-Path $FrontendRepoRoot "front")).Path
if (-not [string]::Equals($FrontendPath, $ExpectedFrontendPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "FrontendPath must point to that worktree's front directory."
}

$ApiUrl = gcloud run services describe $ApiService `
    --project=$ProjectId `
    --region=$Region `
    --format="value(status.url)"
if ($LASTEXITCODE -ne 0 -or -not $ApiUrl.Trim().StartsWith("https://")) {
    throw "Could not read the HTTPS URL of the deployed API."
}
$ApiUrl = "$($ApiUrl.Trim().TrimEnd('/'))/api"

$ContextPath = Join-Path ([System.IO.Path]::GetTempPath()) ("alimentaves-web-" + [guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Path $ContextPath | Out-Null

    $ExcludedDirectories = @(".git", "node_modules", "dist", ".vite", ".cache", "coverage")
    $FrontendFiles = Get-ChildItem -LiteralPath $FrontendPath -Recurse -File -Force | Where-Object {
        $RelativePath = $_.FullName.Substring($FrontendPath.Length).TrimStart('\', '/')
        $Segments = $RelativePath -split '[\\/]'
        $HasExcludedDirectory = @($Segments | Where-Object { $_ -in $ExcludedDirectories }).Count -gt 0
        $IsLocalEnvironmentFile = $_.Name -match '^\.env($|\.)' -and $_.Name -ne ".env.example"
        -not $HasExcludedDirectory -and -not $IsLocalEnvironmentFile -and
            $_.Name -notmatch '\.(log|tsbuildinfo)$'
    }
    if (@($FrontendFiles).Count -eq 0) {
        throw "No frontend source files were found in '$FrontendPath'."
    }

    foreach ($FrontendFile in $FrontendFiles) {
        $RelativePath = $FrontendFile.FullName.Substring($FrontendPath.Length).TrimStart('\', '/')
        $Destination = Join-Path $ContextPath $RelativePath
        New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
        Copy-Item -LiteralPath $FrontendFile.FullName -Destination $Destination
    }

    $Dockerfile = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot "frontend\Dockerfile.template"))
    if (-not $Dockerfile.Contains("__VITE_API_URL__")) {
        throw "The frontend Dockerfile template has no API URL placeholder."
    }
    $Dockerfile = $Dockerfile.Replace("__VITE_API_URL__", $ApiUrl)
    [System.IO.File]::WriteAllText(
        (Join-Path $ContextPath "Dockerfile"),
        $Dockerfile,
        [System.Text.UTF8Encoding]::new($false)
    )
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "frontend\nginx.conf.template") -Destination $ContextPath
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "frontend\start.sh") -Destination $ContextPath

    gcloud run deploy $FrontendService `
        --project=$ProjectId `
        --region=$Region `
        --source=$ContextPath `
        --allow-unauthenticated `
        --port=8080 `
        --concurrency=80 `
        --cpu=1 `
        --memory=512Mi `
        --timeout=30s `
        --min=0 `
        --max=2 `
        --quiet
    if ($LASTEXITCODE -ne 0) { throw "Frontend Cloud Run deployment failed." }

    $FrontendUrl = gcloud run services describe $FrontendService `
        --project=$ProjectId `
        --region=$Region `
        --format="value(status.url)"
    if ($LASTEXITCODE -ne 0 -or -not $FrontendUrl.Trim().StartsWith("https://")) {
        throw "Could not read the HTTPS URL of the deployed frontend."
    }
    $FrontendOrigin = $FrontendUrl.Trim().TrimEnd('/')

    $ApiDescription = gcloud run services describe $ApiService `
        --project=$ProjectId `
        --region=$Region `
        --format=json
    if ($LASTEXITCODE -ne 0) { throw "Could not verify the API CORS configuration." }
    $ApiDescription = ($ApiDescription -join "`n") | ConvertFrom-Json
    $ApiEnv = $ApiDescription.spec.template.spec.containers[0].env
    $CurrentOrigins = ($ApiEnv | Where-Object { $_.name -eq "FRONTEND_ORIGINS" } | Select-Object -First 1).value
    $OriginList = @($CurrentOrigins -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($OriginList -notcontains $FrontendOrigin) {
        $OriginList += $FrontendOrigin
        $OriginList = @($OriginList | Select-Object -Unique)
        $Origins = $OriginList -join ','
        gcloud run services update $ApiService `
            --project=$ProjectId `
            --region=$Region `
            "--update-env-vars=^@^FRONTEND_ORIGINS=$Origins" `
            --quiet
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend is live at '$FrontendOrigin', but API CORS update failed; rerun after correcting access."
        }
    }

    Write-Output "Frontend: $FrontendOrigin"
    Write-Output "API: $ApiUrl"
} finally {
    if (Test-Path -LiteralPath $ContextPath) {
        $TempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
        $ResolvedContextPath = [System.IO.Path]::GetFullPath($ContextPath)
        if (-not $ResolvedContextPath.StartsWith($TempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove a build context outside the system temporary directory."
        }
        Remove-Item -LiteralPath $ResolvedContextPath -Recurse -Force
    }
}
