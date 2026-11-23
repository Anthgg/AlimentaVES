$ErrorActionPreference = "Stop"

$ProjectId = "alimentaves-demo-2026-anthg"
$Region = "us-east1"
$Service = "alimentaves-api"
$ServiceAccountId = "alimentaves-runner"
$ServiceAccount = "$ServiceAccountId@$ProjectId.iam.gserviceaccount.com"
$Bucket = "alimentaves-demo-2026-anthg-media"
$EnvFile = Join-Path $PSScriptRoot "cloudrun.env.yaml"
$BackendSource = Join-Path $PSScriptRoot "..\back"

$SecretVersions = @(
    [PSCustomObject]@{ Name = "alimentaves-database-url"; Version = "2" }
    [PSCustomObject]@{ Name = "alimentaves-jwt-secret"; Version = "1" }
)
foreach ($Secret in $SecretVersions) {
    $VersionState = gcloud secrets versions describe $($Secret.Version) `
        --secret=$($Secret.Name) `
        --project=$ProjectId `
        --format="value(state)" 2>$null
    if ($LASTEXITCODE -ne 0 -or $VersionState.Trim() -ne "ENABLED") {
        throw "Secret '$($Secret.Name)' must have enabled version $($Secret.Version) before deploying."
    }
}

gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    secretmanager.googleapis.com `
    storage.googleapis.com `
    --project=$ProjectId
if ($LASTEXITCODE -ne 0) { throw "Could not enable required Google Cloud APIs." }

gcloud iam service-accounts describe $ServiceAccount --project=$ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud iam service-accounts create $ServiceAccountId `
        --display-name="AlimentaVES Cloud Run runtime" `
        --project=$ProjectId
    if ($LASTEXITCODE -ne 0) { throw "Could not create the Cloud Run service account." }
}

$BucketInfo = gcloud storage buckets describe "gs://$Bucket" `
    --project=$ProjectId `
    --format=json 2>$null
if ($LASTEXITCODE -ne 0) {
    gcloud storage buckets create "gs://$Bucket" `
        --project=$ProjectId `
        --location=$Region `
        --uniform-bucket-level-access `
        --public-access-prevention
    if ($LASTEXITCODE -ne 0) { throw "Could not create the private media bucket." }
} else {
    $BucketSettings = ($BucketInfo -join "`n") | ConvertFrom-Json
    if (-not $BucketSettings.uniform_bucket_level_access -or
        $BucketSettings.public_access_prevention -ne "enforced") {
        throw "Existing bucket must have uniform access and public access prevention enabled."
    }
}

gcloud storage buckets add-iam-policy-binding "gs://$Bucket" `
    --member="serviceAccount:$ServiceAccount" `
    --role="roles/storage.objectUser" `
    --project=$ProjectId
if ($LASTEXITCODE -ne 0) { throw "Could not grant bucket-scoped photo access." }

foreach ($Secret in @("alimentaves-database-url", "alimentaves-jwt-secret")) {
    gcloud secrets add-iam-policy-binding $Secret `
        --member="serviceAccount:$ServiceAccount" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId
    if ($LASTEXITCODE -ne 0) { throw "Could not grant access to secret '$Secret'." }
}

gcloud run deploy $Service `
    --project=$ProjectId `
    --region=$Region `
    --source=$BackendSource `
    --allow-unauthenticated `
    --port=8080 `
    --concurrency=20 `
    --cpu=1 `
    --memory=1Gi `
    --timeout=60s `
    --min=0 `
    --max=2 `
    --service-account=$ServiceAccount `
    --env-vars-file=$EnvFile `
    --set-secrets="DATABASE_URL=alimentaves-database-url:2,JWT_SECRET=alimentaves-jwt-secret:1" `
    --startup-probe="httpGet.path=/api/health,httpGet.port=8080,timeoutSeconds=3,periodSeconds=5,failureThreshold=12" `
    --quiet
if ($LASTEXITCODE -ne 0) { throw "Cloud Run deployment failed." }
