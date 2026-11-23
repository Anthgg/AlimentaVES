$ErrorActionPreference = 'Stop'

$layerUrl = 'https://www.idep.gob.pe/geoportal/rest/services/DATOS_ESPACIALES/ANTORCHA_INSTEG/MapServer/59'
$queryUrl = "$layerUrl/query"
$allowedFields = @(
    'OBJECTID_1', 'ubigeo_dis', 'departamen', 'provincia', 'distrito',
    'centro_pob', 'nombre_del', 'modalidad', 'estado_del', 'codigo_de',
    'n_usuari'
)
$fieldList = $allowedFields -join ','
$pageSize = 1000

function New-QueryString([hashtable] $Parameters) {
    $pairs = foreach ($key in $Parameters.Keys) {
        '{0}={1}' -f [uri]::EscapeDataString([string]$key), `
            [uri]::EscapeDataString([string]$Parameters[$key])
    }
    return $pairs -join '&'
}

$countQuery = New-QueryString @{ where = '1=1'; returnCountOnly = 'true'; f = 'json' }
$countResponse = Invoke-RestMethod -Uri "$queryUrl`?$countQuery" -TimeoutSec 60
if ($countResponse.error) {
    throw "IDEP conteo rechazado: $($countResponse.error.message)"
}
$expectedCount = [int]$countResponse.count
$features = [System.Collections.Generic.List[object]]::new()

for ($offset = 0; $offset -lt $expectedCount; $offset += $pageSize) {
    $parameters = @{
        where = '1=1'
        outFields = $fieldList
        returnGeometry = 'true'
        outSR = '4326'
        resultOffset = [string]$offset
        resultRecordCount = [string]$pageSize
        orderByFields = 'OBJECTID_1 ASC'
        f = 'json'
    }
    $query = New-QueryString $parameters
    $page = Invoke-RestMethod -Uri "$queryUrl`?$query" -TimeoutSec 120
    if ($page.error) {
        throw "IDEP falló en offset $offset`: $($page.error.message)"
    }
    $pageFeatures = @($page.features)
    $expectedPageCount = [Math]::Min($pageSize, $expectedCount - $offset)
    if ($pageFeatures.Count -ne $expectedPageCount) {
        throw "Página incompleta en offset $offset`: se esperaban $expectedPageCount y llegaron $($pageFeatures.Count)."
    }
    foreach ($feature in $pageFeatures) {
        $attributeNames = @($feature.attributes.PSObject.Properties.Name)
        $unexpectedFields = @($attributeNames | Where-Object { $allowedFields -notcontains $_ })
        if ($unexpectedFields.Count -gt 0) {
            throw "La respuesta incluyó campos fuera de la lista permitida: $($unexpectedFields -join ', ')"
        }
        $null = $features.Add($feature)
    }
}

if ($features.Count -ne $expectedCount) {
    throw "La descarga quedó incompleta: $($features.Count) de $expectedCount registros."
}
$objectIds = @($features | ForEach-Object { [string]$_.attributes.OBJECTID_1 })
if (@($objectIds | Select-Object -Unique).Count -ne $expectedCount) {
    throw 'La descarga contiene identificadores de origen repetidos o incompletos.'
}

$targetFeatures = @($features | Where-Object {
    ([string]$_.attributes.ubigeo_dis).Trim() -eq '150142' -and
    ([string]$_.attributes.distrito).Trim().ToUpperInvariant() -eq 'VILLA EL SALVADOR'
})
$date = Get-Date -Format 'yyyy-MM-dd'
$downloadedAt = (Get-Date).ToUniversalTime().ToString('o')
$outputDirectory = Join-Path $PSScriptRoot '..\data\raw'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$outputPath = Join-Path $outputDirectory "comedores_idep_$date.json"

$document = [ordered]@{
    metadata = [ordered]@{
        source_url = $layerUrl
        query_url = $queryUrl
        downloaded_at = $downloadedAt
        source_count = $expectedCount
        output_spatial_reference_wkid = 4326
        page_size = $pageSize
        order_by = 'OBJECTID_1 ASC'
        included_fields = $allowedFields
        excluded_fields = @('nombre_d_1', 'direccion')
        privacy_note = 'Lista permitida: se excluyen nombre de responsable y dirección específica.'
    }
    features = $features.ToArray()
}
$json = ConvertTo-Json -InputObject $document -Depth 20 -Compress
[System.IO.File]::WriteAllText(
    [System.IO.Path]::GetFullPath($outputPath),
    $json,
    [System.Text.UTF8Encoding]::new($false)
)

$targetCodeGroups = @($targetFeatures | Group-Object { [string]$_.attributes.codigo_de })
$duplicateCount = 0
foreach ($group in $targetCodeGroups) {
    if ($group.Count -gt 1) { $duplicateCount += $group.Count - 1 }
}
$exampleNames = @($targetFeatures | Select-Object -First 5 | ForEach-Object {
    [string]$_.attributes.nombre_del
})
[ordered]@{
    downloaded = $features.Count
    filtered_villa_el_salvador = $targetFeatures.Count
    duplicate_source_codes = $duplicateCount
    output_file = [System.IO.Path]::GetFullPath($outputPath)
    examples = $exampleNames
} | ConvertTo-Json -Depth 5
