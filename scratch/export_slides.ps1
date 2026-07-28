$pptxPath = "G:\Digifyce web app\digifyce-platform-php\digifyce-php\scratch\strategy_test_nirvana.pptx"
$outputFolder = "G:\Digifyce web app\digifyce-platform-php\digifyce-php\scratch\slides"

if (!(Test-Path $outputFolder)) {
    New-Item -ItemType Directory -Force -Path $outputFolder | Out-Null
}

try {
    Write-Host "Opening PowerPoint Application..."
    $ppt = New-Object -ComObject PowerPoint.Application
    
    # Try to make PowerPoint visible (sometimes required to open files)
    try {
        $ppt.Visible = 1
    } catch {}

    Write-Host "Opening presentation: $pptxPath"
    $presentation = $ppt.Presentations.Open($pptxPath)
    
    Write-Host "Exporting slides as PNGs..."
    $i = 1
    foreach ($slide in $presentation.Slides) {
        $slidePath = Join-Path $outputFolder ("slide_" + $i.ToString("D2") + ".png")
        $slide.Export($slidePath, "PNG", 1280, 720)
        Write-Host "Exported slide $i to $slidePath"
        $i++
    }
    
    Write-Host "Closing presentation..."
    $presentation.Close()
    $ppt.Quit()
    Write-Host "PowerPoint export finished successfully!"
}
catch {
    Write-Error "Error during PowerPoint export: $_"
    if ($ppt) { 
        try { $ppt.Quit() } catch {}
    }
}
