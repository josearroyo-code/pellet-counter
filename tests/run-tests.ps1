# Ejecuta las suites de pruebas de Pellet Counter en un navegador (Edge o Chrome) sin interfaz.
# Windows PowerShell 5.1 o superior. No hace falta Node ni instalar nada.
#
#   .\tests\run-tests.ps1                    # todas las suites que no necesitan red
#   .\tests\run-tests.ps1 -Network           # incluye las que descargan OpenCV.js de jsDelivr
#   .\tests\run-tests.ps1 -Only 09,10        # solo las suites cuyo nombre contenga 09 o 10
#   .\tests\run-tests.ps1 -List              # lista las suites
#   .\tests\run-tests.ps1 -KeepTemp          # no borra la carpeta temporal (para depurar)
#
# Devuelve codigo de salida 0 si todo pasa y 1 si algo falla. Detalles en tests\README.md.
# (Este fichero es solo ASCII a proposito: PowerShell 5.1 lee mal los acentos sin BOM.)
param(
  [string[]]$Only = @(),
  [switch]$Network,
  [switch]$List,
  [string]$Browser = '',
  [int]$BasePort = 9700,
  [switch]$KeepTemp
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$suiteDir = Join-Path $PSScriptRoot 'suites'

# ---------- descubrir suites y sus directivas (// @size W,H  // @timeout S  // @net  // @aux) ----------
$suites = @()
foreach ($f in (Get-ChildItem $suiteDir -Filter *.js | Sort-Object Name)) {
  $head = (Get-Content $f.FullName -TotalCount 12 -Encoding UTF8) -join "`n"
  $s = [pscustomobject]@{
    Name = $f.BaseName; Path = $f.FullName
    Size = $(if ($head -match '// @size (\d+,\d+)') { $Matches[1] } else { '1280,900' })
    Timeout = $(if ($head -match '// @timeout (\d+)') { [int]$Matches[1] } else { 120 })
    Net = [bool]($head -match '// @net')
    Http = [bool]($head -match '// @(net|http)')
    Aux = [bool]($head -match '// @aux')
    Desc = $(if ($head -match '(?m)^// (?!SUITE|@)(.+)$') { $Matches[1] } else { '' })
  }
  $suites += $s
}
$main = @($suites | Where-Object { -not $_.Aux })
if ($List) { $main | ForEach-Object { '{0,-58} {1}{2}' -f $_.Name, $(if ($_.Net) { '[RED] ' } else { '' }), $_.Desc }; return }
if ($Only.Count -gt 0) {
  # un numero (7, 07) selecciona la suite "07-..."; cualquier otro texto se busca dentro del nombre
  $pats = @($Only | ForEach-Object { if ("$_" -match '^\d+$') { '{0:D2}-*' -f [int]"$_" } else { "*$_*" } })
  $main = @($main | Where-Object { $nm = $_.Name; ($pats | Where-Object { $nm -like $_ }).Count -gt 0 })
}
if (-not $Network) { $skipped = @($main | Where-Object { $_.Net }); $main = @($main | Where-Object { -not $_.Net }) } else { $skipped = @() }

# ---------- comprobaciones estaticas: version coherente en todos los sitios ----------
function Get-First($path, $pattern) { $m = [regex]::Match((Get-Content $path -Raw -Encoding UTF8), $pattern); if ($m.Success) { $m.Groups[1].Value } else { $null } }
$versions = [ordered]@{
  'js/app.js VERSION'      = Get-First "$repo\js\app.js" "const VERSION = '(v[\d.]+)'"
  'sw.js CACHE'            = Get-First "$repo\sw.js" "pellet-(v[\d.]+)'"
  'index.html topbar'      = Get-First "$repo\index.html" 'class="ver">(v[\d.]+)<'
  'index.html Acerca de'   = Get-First "$repo\index.html" 'Pellet Counter (v[\d.]+)</strong>'
  'index.html splash'      = Get-First "$repo\index.html" '<!-- splash (v[\d.]+) -->'
}
$distinct = @($versions.Values | Sort-Object -Unique)
$totalFail = 0; $report = @()
Write-Host ''
Write-Host '== Comprobacion estatica: version =='
$versions.GetEnumerator() | ForEach-Object { Write-Host ('  {0,-22} {1}' -f $_.Key, $_.Value) }
if ($distinct.Count -eq 1 -and $distinct[0]) { Write-Host "  PASS version coherente ($($distinct[0]))" ; $report += 'PASS  static-version' }
else { Write-Host '  FAIL las versiones NO coinciden'; $totalFail++; $report += 'FAIL  static-version' }

# ---------- navegador ----------
if (-not $Browser) {
  $cands = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
             "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe")
  $Browser = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $Browser) { throw 'No se encontro Edge ni Chrome. Usa -Browser <ruta al ejecutable>.' }
Write-Host "Navegador: $Browser"

# ---------- carpeta de trabajo (copia del proyecto + suites; el repo no se modifica) ----------
$work = Join-Path $env:TEMP ('pellet-tests-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $work | Out-Null
New-Item -ItemType Directory -Path (Join-Path $work 'js') | Out-Null
Copy-Item "$repo\js\*.js" (Join-Path $work 'js')
Copy-Item "$repo\manifest.json", "$repo\sw.js" $work
Copy-Item "$suiteDir\*.js" $work
$indexTpl = Get-Content "$repo\index.html" -Raw -Encoding UTF8
$appTag = '<script src="js/app.js"></script>'
if (-not $indexTpl.Contains($appTag)) { throw "index.html ya no contiene $appTag; hay que actualizar el runner" }
# Se anula navigator.serviceWorker en las paginas de prueba: el SW recargaria la pagina a mitad de una prueba.
$noSw = '<script>try{delete Navigator.prototype.serviceWorker}catch(e){}</script>'
$errHook = "<script>window.addEventListener('error',function(e){if(!document.title||document.title.indexOf('RES:')!==0)document.title='ERR '+e.message+' @'+e.lineno})</script>"
function New-TestPage($name) {
  $inject = $noSw + $appTag + '<script src="js/cv-experimental.js"></script><script src="' + $name + '.js"></script>' + $errHook
  $html = $indexTpl.Replace($appTag, $inject)
  [IO.File]::WriteAllText((Join-Path $work "index_$name.html"), $html, (New-Object Text.UTF8Encoding($false)))
}
foreach ($s in $suites) { New-TestPage $s.Name }

# ---------- servidor estatico (solo para suites con red: necesitan contexto seguro http://localhost) ----------
$serverJob = $null; $httpPort = $BasePort + 90
if (@($main | Where-Object { $_.Http }).Count -gt 0) {
  $serverJob = Start-Job -ArgumentList $work, $httpPort -ScriptBlock {
    param($dir, $port)
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$port/"); $l.Start()
    $types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json' }
    while ($l.IsListening) {
      $c = $l.GetContext()
      try {
        $f = Join-Path $dir ([uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/')))
        if (Test-Path $f -PathType Leaf) {
          $b = [IO.File]::ReadAllBytes($f); $ext = [IO.Path]::GetExtension($f)
          $c.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
          $c.Response.OutputStream.Write($b, 0, $b.Length)
        } else { $c.Response.StatusCode = 404 }
      } catch { }
      $c.Response.Close()
    }
  }
  for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 500; try { [void](Invoke-WebRequest "http://localhost:$httpPort/manifest.json" -UseBasicParsing -TimeoutSec 2); break } catch { } }
}

# ---------- ejecutar una suite ----------
function Read-Cdp($wsUrl, $expression) {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([uri]$wsUrl, [Threading.CancellationToken]::None).Wait()
  $msg = (@{ id = 1; method = 'Runtime.evaluate'; params = @{ expression = $expression; returnByValue = $true } } | ConvertTo-Json -Depth 5 -Compress)
  $b = [Text.Encoding]::UTF8.GetBytes($msg)
  $ws.SendAsync([ArraySegment[byte]]$b, 'Text', $true, [Threading.CancellationToken]::None).Wait()
  $buf = New-Object byte[] 65536; $sb = New-Object Text.StringBuilder
  do { $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, [Threading.CancellationToken]::None).Result; [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count)) } while (-not $r.EndOfMessage)
  $ws.Dispose()
  return (($sb.ToString() | ConvertFrom-Json).result.result.value)
}
$extract = "(function(){var r=document.getElementById('res');if(r&&r.textContent)return r.textContent;var t=document.title;if(t.indexOf('RES:')===0){try{return decodeURIComponent(t.slice(4))}catch(e){return t}}return t})()"

function Invoke-Suite($s, $port) {
  $pageUrl = $(if ($s.Http) { "http://localhost:$httpPort/index_$($s.Name).html" } else { 'file:///' + $work.Replace('\', '/') + "/index_$($s.Name).html" })
  $prof = Join-Path $work "profile_$port"
  $cliArgs = @('--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
            "--user-data-dir=`"$prof`"", "--remote-debugging-port=$port", '--no-first-run', '--disable-sync', '--disable-background-networking', "--window-size=$($s.Size)", $pageUrl)
  $p = Start-Process $Browser -ArgumentList $cliArgs -PassThru
  $text = $null; $title = ''
  try {
    for ($i = 0; $i -lt $s.Timeout; $i++) {
      Start-Sleep 1
      try {
        $pg = (Invoke-RestMethod "http://127.0.0.1:$port/json" -TimeoutSec 3) | Where-Object { $_.type -eq 'page' -and $_.url -like "*index_$($s.Name).html*" } | Select-Object -First 1
        if ($pg) {
          $title = $pg.title
          if ($title -like 'RES:*' -or $title -like 'ERR *') { $text = Read-Cdp $pg.webSocketDebuggerUrl $extract; break }
        }
      } catch { }
    }
  } finally { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  return [pscustomobject]@{ Text = $text; Title = $title }
}

$n = 0
Write-Host ''
foreach ($s in $main) {
  $n++
  $t0 = Get-Date
  $res = Invoke-Suite $s ($BasePort + $n)
  $secs = [int]((Get-Date) - $t0).TotalSeconds
  if ($null -eq $res.Text) { Write-Host ("FAIL  {0}  (sin resultado tras {1} s; ultimo titulo: {2})" -f $s.Name, $secs, $res.Title); $totalFail++; $report += "FAIL  $($s.Name)"; continue }
  $lines = @($res.Text -split "`r?`n")
  $failLines = @($lines | Where-Object { $_ -match '^(FAIL|EXC) ' -or $_ -match '^ERR ' })
  $hdr = [regex]::Match($res.Text, '^TOTAL=(\d+) PASS=(\d+)')
  $pass = $(if ($hdr.Success) { [int]$hdr.Groups[2].Value } else { @($lines | Where-Object { $_ -match '^PASS ' }).Count })
  if ($failLines.Count -eq 0 -and $pass -gt 0) { Write-Host ("PASS  {0,-58} {1,3} comprobaciones  ({2} s)" -f $s.Name, $pass, $secs); $report += "PASS  $($s.Name)" }
  else {
    Write-Host ("FAIL  {0,-58} {1} ok, {2} fallos  ({3} s)" -f $s.Name, $pass, $failLines.Count, $secs); $totalFail++; $report += "FAIL  $($s.Name)"
    if ($pass -eq 0 -and $failLines.Count -eq 0) { Write-Host '      (la suite no produjo ninguna comprobacion)' }
    $failLines | ForEach-Object { Write-Host ('      ' + $(if ($_.Length -gt 300) { $_.Substring(0, 300) + '...' } else { $_ })) }
  }
}
foreach ($s in $skipped) { Write-Host ("SKIP  {0}  (necesita red; usa -Network)" -f $s.Name) }

# ---------- limpieza ----------
if ($serverJob) { Stop-Job $serverJob -ErrorAction SilentlyContinue; Remove-Job $serverJob -Force -ErrorAction SilentlyContinue }
if (-not $KeepTemp) {
  # el navegador deja procesos hijo unos instantes con ficheros abiertos en su perfil: se cierran y se reintenta
  try { Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$work*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } } catch { }
  $deleted = $false
  for ($i = 0; $i -lt 6 -and -not $deleted; $i++) {
    try { Remove-Item $work -Recurse -Force -ErrorAction Stop; $deleted = $true } catch { Start-Sleep 1 }
  }
  if (-not $deleted) { Write-Host "(no se pudo borrar la carpeta temporal ${work}; es seguro borrarla a mano)" }
} else { Write-Host "Carpeta temporal: $work" }

Write-Host ''
if ($totalFail -eq 0) { Write-Host 'RESULTADO: todo en verde' } else { Write-Host "RESULTADO: $totalFail suite(s) con fallos" }
exit $(if ($totalFail -eq 0) { 0 } else { 1 })
