[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $false)]
    [string]$Location,

    [Parameter(Mandatory = $false)]
    [string]$AppName,

    [Parameter(Mandatory = $false)]
    [string]$PlanName,

    [Parameter(Mandatory = $false)]
    [string]$Sku = "B1",

    [Parameter(Mandatory = $false)]
    [string]$Runtime = "NODE:20-lts",

    [Parameter(Mandatory = $false)]
    [string]$AdminPassword,

    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory = $false)]
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Read-IfEmpty {
    param(
        [string]$CurrentValue,
        [string]$Label,
        [string]$DefaultValue = ""
    )

    if (-not [string]::IsNullOrWhiteSpace($CurrentValue)) {
        return $CurrentValue
    }

    if ([string]::IsNullOrWhiteSpace($DefaultValue)) {
        return (Read-Host $Label)
    }

    $value = Read-Host "$Label [$DefaultValue]"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }

    return $value
}

function Confirm-Action {
    param([string]$Message)

    $answer = Read-Host "$Message (y/N)"
    return $answer -match '^(y|yes|o|oui)$'
}

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "La commande '$Name' est introuvable. Installez-la puis relancez le script."
    }
}

function Test-AzResourceGroupExists {
    param([string]$Name)

    $result = az group exists --name $Name
    return $LASTEXITCODE -eq 0 -and $result.Trim() -eq "true"
}

function Test-AzAppServicePlanExists {
    param(
        [string]$Name,
        [string]$ResourceGroup
    )

    az appservice plan show --name $Name --resource-group $ResourceGroup 1>$null 2>$null
    return $LASTEXITCODE -eq 0
}

function Test-AzWebAppExists {
    param(
        [string]$Name,
        [string]$ResourceGroup
    )

    az webapp show --name $Name --resource-group $ResourceGroup 1>$null 2>$null
    return $LASTEXITCODE -eq 0
}

Write-Host "=== Déploiement Azure Web App (Node.js) ===" -ForegroundColor Cyan

Assert-Command -Name "az"
Assert-Command -Name "git"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$SubscriptionId = Read-IfEmpty -CurrentValue $SubscriptionId -Label "Subscription ID Azure (laisser vide pour conserver le contexte actuel)"
$ResourceGroup = Read-IfEmpty -CurrentValue $ResourceGroup -Label "Nom du Resource Group" -DefaultValue "rg-blindtest"
$Location = Read-IfEmpty -CurrentValue $Location -Label "Région Azure" -DefaultValue "westeurope"
$AppName = Read-IfEmpty -CurrentValue $AppName -Label "Nom global unique de la Web App"
$PlanName = Read-IfEmpty -CurrentValue $PlanName -Label "Nom du App Service Plan" -DefaultValue "$($ResourceGroup)-plan"
$Sku = Read-IfEmpty -CurrentValue $Sku -Label "SKU App Service Plan" -DefaultValue "B1"
$Runtime = Read-IfEmpty -CurrentValue $Runtime -Label "Runtime Stack (ex: NODE:20-lts)" -DefaultValue "NODE:20-lts"
$AdminPassword = Read-IfEmpty -CurrentValue $AdminPassword -Label "Mot de passe admin applicatif" -DefaultValue "admin123"

if (-not (Confirm-Action -Message "Continuer avec ces paramètres")) {
    throw "Déploiement annulé par l'utilisateur."
}

Write-Host "\nRécapitulatif:" -ForegroundColor Yellow
Write-Host "- Resource Group : $ResourceGroup"
Write-Host "- Location       : $Location"
Write-Host "- App Name       : $AppName"
Write-Host "- Plan Name      : $PlanName"
Write-Host "- SKU            : $Sku"
Write-Host "- Runtime        : $Runtime"

if ($WhatIf) {
    Write-Host "\nMode WhatIf activé : aucune commande Azure ne sera exécutée." -ForegroundColor Yellow
    exit 0
}

Write-Host "\nConnexion Azure..." -ForegroundColor Cyan
az account show 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    az login | Out-Null
}

if (-not [string]::IsNullOrWhiteSpace($SubscriptionId)) {
    az account set --subscription $SubscriptionId
}

if (Test-AzResourceGroupExists -Name $ResourceGroup) {
    Write-Host "Resource Group déjà présent : $ResourceGroup" -ForegroundColor DarkGray
}
else {
    Write-Host "Création du Resource Group..." -ForegroundColor Cyan
    az group create --name $ResourceGroup --location $Location | Out-Null
}

if (Test-AzAppServicePlanExists -Name $PlanName -ResourceGroup $ResourceGroup) {
    Write-Host "App Service Plan déjà présent : $PlanName" -ForegroundColor DarkGray
}
else {
    Write-Host "Création du App Service Plan..." -ForegroundColor Cyan
    az appservice plan create --name $PlanName --resource-group $ResourceGroup --location $Location --sku $Sku --is-linux | Out-Null
}

if (Test-AzWebAppExists -Name $AppName -ResourceGroup $ResourceGroup) {
    Write-Host "Web App déjà présente : $AppName" -ForegroundColor DarkGray
}
else {
    Write-Host "Création de la Web App..." -ForegroundColor Cyan
    az webapp create --name $AppName --resource-group $ResourceGroup --plan $PlanName --runtime $Runtime | Out-Null
}

Write-Host "Configuration des variables d'environnement..." -ForegroundColor Cyan
az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings "WEBSITE_NODE_DEFAULT_VERSION=~20" "SCM_DO_BUILD_DURING_DEPLOYMENT=true" "ADMIN_PASSWORD=$AdminPassword" | Out-Null

if (-not $SkipBuild) {
    Write-Host "Installation des dépendances Node.js..." -ForegroundColor Cyan
    npm ci
}

Write-Host "Déploiement du code source (zip deploy via az webapp up)..." -ForegroundColor Cyan
az webapp up --name $AppName --resource-group $ResourceGroup --plan $PlanName --location $Location --runtime $Runtime --sku $Sku | Out-Null

$url = "https://$AppName.azurewebsites.net"
Write-Host "\n✅ Déploiement terminé." -ForegroundColor Green
Write-Host "URL: $url" -ForegroundColor Green
