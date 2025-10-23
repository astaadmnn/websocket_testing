# SmartBite Arduino Detector - PowerShell Script
# This script automatically detects Arduino devices and configures them for RFID reading

# Parameters
param(
    [switch]$AutoConnect = $false,
    [string]$Port,
    [int]$BaudRate = 9600,
    [switch]$ListOnly = $false,
    [switch]$Help = $false
)

# Display help
function Show-Help {
    Write-Host "SmartBite Arduino Detector"
    Write-Host "Usage: .\arduino_detector.ps1 [-AutoConnect] [-Port COM#] [-BaudRate rate] [-ListOnly] [-Help]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -AutoConnect     Automatically try to connect to the first detected Arduino"
    Write-Host "  -Port COM#       Specify a specific COM port (e.g., COM3)"
    Write-Host "  -BaudRate rate   Set baud rate (default: 9600)"
    Write-Host "  -ListOnly        Just list available ports without connecting"
    Write-Host "  -Help            Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\arduino_detector.ps1 -ListOnly"
    Write-Host "  .\arduino_detector.ps1 -AutoConnect"
    Write-Host "  .\arduino_detector.ps1 -Port COM3"
    exit
}

# Show help if requested
if ($Help) {
    Show-Help
}

# Check if running with admin privileges
function Test-Administrator {
    $user = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal $user
    return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Warning "This script might need administrator privileges to access certain serial ports."
    Write-Host "Consider rerunning as administrator if you encounter permission issues."
}

# Function to list all available serial ports
function Get-SerialPorts {
    try {
        $ports = [System.IO.Ports.SerialPort]::GetPortNames()
        if ($ports.Count -eq 0) {
            Write-Host "No serial ports found." -ForegroundColor Yellow
            return @()
        }
        
        $portInfos = @()
        foreach ($portName in $ports) {
            try {
                # Try to get some basic info about the port
                $port = New-Object System.IO.Ports.SerialPort $portName
                $port.Open()
                $isOpen = $true
                $port.Close()
                $status = "Available"
            }
            catch {
                $isOpen = $false
                $status = "In use or unavailable"
            }

            # Get device information using WMI
            $wmiPorts = Get-WmiObject -Class Win32_PnPEntity | Where-Object { 
                $_.Name -match "^(?:.*COM\d+\)?$)" -and $_.Name -match "\($portName\)" 
            }
            
            $description = "Unknown device"
            if ($wmiPorts) {
                $description = $wmiPorts.Description
                if (-not $description) {
                    $description = $wmiPorts.Name
                }
            }

            # Check if it looks like an Arduino
            $isArduino = ($description -match "Arduino" -or 
                         $description -match "CH340" -or 
                         $description -match "USB Serial" -or
                         $description -match "FTDI")
                         
            $obj = [PSCustomObject]@{
                PortName = $portName
                Description = $description
                Status = $status
                IsLikelyArduino = $isArduino
            }
            
            $portInfos += $obj
        }
        
        return $portInfos
    }
    catch {
        Write-Host "Error listing serial ports: $_" -ForegroundColor Red
        return @()
    }
}

# Function to connect to an Arduino
function Connect-Arduino {
    param (
        [Parameter(Mandatory=$true)][string]$PortName,
        [Parameter(Mandatory=$false)][int]$BaudRate = 9600
    )

    try {
        Write-Host "Attempting to connect to $PortName..." -ForegroundColor Cyan
        
        # Create and configure serial port
        $port = New-Object System.IO.Ports.SerialPort $PortName, $BaudRate
        $port.ReadTimeout = 3000  # 3 seconds timeout
        $port.DtrEnable = $true   # Data Terminal Ready
        
        # Open the port
        $port.Open()
        
        # Wait for Arduino to reset
        Start-Sleep -Seconds 2
        
        Write-Host "Connected to $PortName successfully." -ForegroundColor Green
        Write-Host "Listening for RFID card data. Press Ctrl+C to stop." -ForegroundColor Yellow
        
        # Read and display data from Arduino
        try {
            while ($true) {
                # Check if data is available
                if ($port.BytesToRead -gt 0) {
                    # Read a line (assumes Arduino sends complete lines ending with newline)
                    $data = $port.ReadLine()
                    
                    # Trim and validate the data
                    $data = $data.Trim()
                    
                    # Check if it's a valid RFID card number (10 digits)
                    if ($data -match '^\d{10}$') {
                        Write-Host "RFID Card detected: $data" -ForegroundColor Green
                        
                        # Here you could add code to forward this data to your application
                    }
                    elseif ($data -ne "") {
                        # Other data from Arduino
                        Write-Host "Data received: $data" -ForegroundColor Cyan
                    }
                }
                
                # Small delay to prevent high CPU usage
                Start-Sleep -Milliseconds 50
            }
        }
        catch {
            # Handle connection errors or user interruption
            Write-Host "Connection interrupted: $_" -ForegroundColor Red
        }
        finally {
            # Ensure the port is closed
            if ($port.IsOpen) {
                $port.Close()
            }
            Write-Host "Connection closed." -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "Failed to connect to $PortName : $_" -ForegroundColor Red
    }
}

# Main script execution
try {
    # Load System.IO.Ports
    Add-Type -AssemblyName System.IO.Ports
    
    # Just list ports if requested
    if ($ListOnly) {
        Write-Host "Available Serial Ports:" -ForegroundColor Cyan
        $portInfos = Get-SerialPorts
        
        if ($portInfos.Count -gt 0) {
            $portInfos | Format-Table -AutoSize
        }
        exit
    }
    
    # Connect to a specific port if provided
    if ($Port) {
        Connect-Arduino -PortName $Port -BaudRate $BaudRate
        exit
    }
    
    # Auto-connect to the first Arduino-like device
    if ($AutoConnect) {
        $portInfos = Get-SerialPorts
        
        # First try ports that look like Arduino
        $arduinoPorts = $portInfos | Where-Object { $_.IsLikelyArduino -eq $true }
        
        if ($arduinoPorts.Count -gt 0) {
            Write-Host "Detected Arduino-like devices:" -ForegroundColor Cyan
            $arduinoPorts | Format-Table -AutoSize
            
            # Connect to the first available Arduino port
            Connect-Arduino -PortName $arduinoPorts[0].PortName -BaudRate $BaudRate
            exit
        }
        
        # If no Arduino-like ports found, try any available port
        if ($portInfos.Count -gt 0) {
            Write-Host "No Arduino-like devices detected. Trying the first available port:" -ForegroundColor Yellow
            $portInfos | Format-Table -AutoSize
            
            Connect-Arduino -PortName $portInfos[0].PortName -BaudRate $BaudRate
            exit
        }
        
        Write-Host "No serial ports available for connection." -ForegroundColor Red
        exit
    }
    
    # If no specific options, show available ports and prompt for selection
    $portInfos = Get-SerialPorts
    
    if ($portInfos.Count -eq 0) {
        Write-Host "No serial ports found. Please connect an Arduino device and try again." -ForegroundColor Red
        exit
    }
    
    Write-Host "Available Serial Ports:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $portInfos.Count; $i++) {
        $port = $portInfos[$i]
        $arduinoIndicator = if ($port.IsLikelyArduino) { " [LIKELY ARDUINO]" } else { "" }
        Write-Host "[$i] $($port.PortName) - $($port.Description)$arduinoIndicator - $($port.Status)"
    }
    
    Write-Host ""
    $selection = Read-Host "Enter the number of the port to connect to, or 'q' to quit"
    
    if ($selection -eq 'q') {
        exit
    }
    
    # Validate selection
    if ($selection -match '^\d+$' -and [int]$selection -ge 0 -and [int]$selection -lt $portInfos.Count) {
        $selectedPort = $portInfos[[int]$selection].PortName
        Connect-Arduino -PortName $selectedPort -BaudRate $BaudRate
    }
    else {
        Write-Host "Invalid selection." -ForegroundColor Red
    }
}
catch {
    Write-Host "An error occurred: $_" -ForegroundColor Red
}