# Script temporal para actualizar colores y UI de gráficos Lollipop
$filePath = "c:\Users\Admin\Desktop\Desempeño-RRHH\src\components\MetricasRRHH.tsx"
$content = Get-Content $filePath -Raw

# Cambio 1: Analistas header
$content = $content -replace `
  '(\s+)<div className="flex items-center justify-between mb-3">(\s+)<h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">(\s+)<svg className="w-5 h-5 text-amber-600"', `
  '$1<div className="mb-4">$2<div className="flex items-center justify-between mb-2">$3<h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">$4<svg className="w-5 h-5 text-teal-600"'

# Cambio 2: Analistas dropdown
$content = $content -replace `
  '<option key=\{p\.email\} value=\{p\.email\}>\{p\.nombre\}</option>', `
  '<option key={p.email} value={p.email}>{p.nombreCompleto} {p.areas.length > 1 ? `(${p.areas.length} áreas)` : ``}</option>'

# Cambio 3: Analistas color barra teal
$content = $content -replace `
  'fill="#d97706" name="Puntaje Actual"', `
  'fill="#14b8a6" name="Puntaje Actual"'

# Cambio 4: Líderes color morado
$content = $content -replace `
  'fill="#ca8a04" name="Puntaje Actual"', `
  'fill="#a855f7" name="Puntaje Actual"'

$content | Set-Content $filePath -NoNewline
Write-Host "Actualización completada!" -ForegroundColor Green
