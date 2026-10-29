# Membuat semua gambar untuk halaman toko Play Store memakai Microsoft Edge (sudah ada di Windows).
# Jalankan dari folder mana saja:  powershell -ExecutionPolicy Bypass -File play-store\buat-gambar.ps1
# Hasil ada di play-store\gambar\. Jalankan ulang setelah tampilan web/ diubah.

$ErrorActionPreference = 'Stop'
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
if (-not (Test-Path $edge)) { throw 'Microsoft Edge tidak ditemukan.' }

$root = Split-Path -Parent $PSCommandPath
$out = Join-Path $root 'gambar'
New-Item -ItemType Directory -Force $out | Out-Null
$profil = Join-Path $env:TEMP 'papan-info-masjid-edge'
$tpl = 'file:///' + ((Join-Path $root 'template') -replace '\\', '/')

function Foto($nama, $url, $lebar, $tinggi) {
    $file = Join-Path $out $nama
    if ($url -like '*shot.html*') { $url += "&W=$lebar&H=$tinggi" }
    # Edge menulis log ke stderr; jangan dianggap gagal
    $ErrorActionPreference = 'Continue'
    # --allow-file-access-from-files: pembungkus shot.html perlu membaca isi iframe
    & $edge --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --lang=id `
        "--user-data-dir=$profil" "--window-size=$lebar,$tinggi" --virtual-time-budget=8000 `
        "--screenshot=$file" $url 2>&1 | Out-Null
    if (-not (Test-Path $file)) { throw "Gagal membuat $nama" }
    Write-Host "  $nama"
}

# localStorage dikosongkan supaya selalu memakai data contoh bawaan
if (Test-Path $profil) { Remove-Item -Recurse -Force $profil }

Write-Host 'Screenshot TV (1920x1080):'
Foto 'screenshot-tv-1.png' "$tpl/shot.html?src=index.html%3Fsim%3D2026-10-29T09:30" 1920 1080
Foto 'screenshot-tv-2.png' "$tpl/shot.html?src=index.html%3Fsim%3D2026-10-29T17:45" 1920 1080
Foto 'screenshot-tv-3.png' "$tpl/shot.html?src=index.html%3Fsim%3D2026-10-29T17:58" 1920 1080
Foto 'screenshot-tv-4.png' "$tpl/shot.html?src=index.html%3Fsim%3D2026-10-30T11:50" 1920 1080

Write-Host 'Screenshot HP (1080x1920):'
Foto 'screenshot-hp-1.png' "$tpl/shot.html?src=admin.html&w=412&h=732&pin=1234&tab=masjid" 1080 1920
Foto 'screenshot-hp-2.png' "$tpl/shot.html?src=admin.html&w=412&h=732&pin=1234&tab=pengajian" 1080 1920
Foto 'screenshot-hp-3.png' "$tpl/shot.html?src=admin.html&w=412&h=732&pin=1234&tab=kas" 1080 1920

Write-Host 'Grafis toko:'
Foto 'ikon-512.png' "$tpl/grafis.html?jenis=ikon" 512 512
Foto 'feature-graphic-1024x500.png' "$tpl/grafis.html?jenis=fitur" 1024 500
Foto 'banner-tv-1280x720.png' "$tpl/grafis.html?jenis=banner" 1280 720

# Play Store mensyaratkan ikon PNG 32-bit (dengan alpha); screenshot Edge hanya 24-bit
Add-Type -AssemblyName System.Drawing
$ikon = Join-Path $out 'ikon-512.png'
$asal = [System.Drawing.Image]::FromFile($ikon)
$argb = New-Object System.Drawing.Bitmap 512, 512, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($argb); $g.DrawImage($asal, 0, 0, 512, 512); $g.Dispose(); $asal.Dispose()
$argb.Save($ikon, [System.Drawing.Imaging.ImageFormat]::Png); $argb.Dispose()

Remove-Item -Recurse -Force $profil -ErrorAction SilentlyContinue
Write-Host "Selesai: $out"
