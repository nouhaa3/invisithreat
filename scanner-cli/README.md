# InvisiThreat CLI Scanner

Scan any local project and send results to your InvisiThreat platform account.
No Python required — just one exe file.

## For end users

### 1. Download invisithreat.exe
Get it from the **Developer** page on your InvisiThreat platform.

### 2. Open terminal where you saved the exe
Navigate to the folder containing the exe file.

### 3. Create a project on the platform
- Click **New Scan** → name your project → select **CLI** → **Launch Scan**
- Copy the UUID from the URL bar: .../projects/xxxxxxxx-xxxx-...

### 4. Generate an API key  
**Developer** page → API Keys → Generate Key → copy the ivt_... token.

### 5. Login
`powershell
.\invisithreat.exe login --server http://localhost:8000 --token ivt_YOUR_KEY
`

### 6. Scan your project
`powershell
.\invisithreat.exe scan "path\to\your-project" --project-id YOUR_PROJECT_UUID
`

Results appear instantly in the platform.

**Optional:** --dry-run | --severity high

---

## For platform operators (building)

`powershell
cd scanner-cli  
build.bat
`

Builds standalone exe and copies to rontend\public\downloads\ for user downloads.
