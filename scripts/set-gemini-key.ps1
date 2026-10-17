Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Gemini API 키 입력'
$form.ClientSize = New-Object System.Drawing.Size(540, 225)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

$description = New-Object System.Windows.Forms.Label
$description.Location = New-Object System.Drawing.Point(20, 18)
$description.Size = New-Object System.Drawing.Size(500, 62)
$description.Text = "API 키만 붙여 넣어 주세요. 따옴표는 넣지 마세요.`r`n키는 화면·채팅·로그에 출력하지 않습니다.`r`n현재 Windows 사용자의 GEMINI_API_KEY 환경변수에 저장합니다."
$form.Controls.Add($description)

$inputBox = New-Object System.Windows.Forms.TextBox
$inputBox.Location = New-Object System.Drawing.Point(20, 90)
$inputBox.Size = New-Object System.Drawing.Size(500, 28)
$inputBox.UseSystemPasswordChar = $true
$inputBox.ShortcutsEnabled = $true
$form.Controls.Add($inputBox)

$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(20, 127)
$status.Size = New-Object System.Drawing.Size(500, 30)
$form.Controls.Add($status)

$saveButton = New-Object System.Windows.Forms.Button
$saveButton.Text = '저장'
$saveButton.Location = New-Object System.Drawing.Point(320, 173)
$saveButton.Size = New-Object System.Drawing.Size(95, 32)
$form.Controls.Add($saveButton)
$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = '취소'
$cancelButton.Location = New-Object System.Drawing.Point(425, 173)
$cancelButton.Size = New-Object System.Drawing.Size(95, 32)
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)
$form.AcceptButton = $saveButton
$form.CancelButton = $cancelButton

$saveButton.Add_Click({
    $enteredKey = $inputBox.Text.Trim()
    if ($enteredKey -notmatch '^AIza[0-9A-Za-z_-]{35}$') {
        $status.Text = 'Google API 키 전체를 붙여 넣어 주세요. 입력 형식이 맞지 않습니다.'
        $inputBox.Focus()
        return
    }
    try {
        [Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $enteredKey, 'User')
        $inputBox.Clear()
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    } catch {
        $status.Text = '저장하지 못했습니다. Windows 환경변수 설정을 확인해 주세요.'
    } finally {
        $enteredKey = $null
    }
})
$form.Add_Shown({ $inputBox.Focus() })
$null = $form.ShowDialog()
$inputBox.Clear()
$form.Dispose()
