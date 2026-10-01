$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $docPath = (Resolve-Path "PROJECT_STRUCTURE.docx").Path
    $pdfPath = [System.IO.Path]::Combine((Get-Location).Path, "PROJECT_STRUCTURE.pdf")
    Write-Host "Opening Word Document: $docPath"
    $doc = $word.Documents.Open($docPath)
    $wdFormatPDF = 17
    $doc.SaveAs([ref]$pdfPath, [ref]$wdFormatPDF)
    $doc.Close()
    Write-Host "Successfully generated PDF: $pdfPath"
} catch {
    Write-Error $_
} finally {
    $word.Quit()
}
