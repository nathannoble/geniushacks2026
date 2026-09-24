# FCRM Workbench - Local Setup Session

This document contains the step-by-step instructions for setting up the FCRM Workbench repository locally using Docker, as well as troubleshooting steps for Docker Desktop.

## 1. Prerequisites
To run the full stack (Database, FastAPI, and Langfuse) locally in isolated containers, you only need to install **Docker Desktop**. You do not need to install PostgreSQL locally on your Windows machine.

- Download and install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/).
- Ensure that the option **"Use WSL 2 instead of Hyper-V"** is checked during installation.
- **Restart your computer**.

## 2. Troubleshooting Docker: "Virtualization support not detected"
If Docker Desktop fails to start with the error "Virtualization support not detected", it means hardware virtualization or required Windows features are disabled.

### Step 2a: Enable Virtualization in BIOS
1. Open **Task Manager** (`Ctrl + Shift + Esc`) -> **Performance** tab -> **CPU**.
2. Look at the bottom right. If it says **Virtualization: Disabled**, you need to restart your computer.
3. Enter your BIOS/UEFI settings during boot (usually by pressing F2, F10, F12, or DEL).
4. Find the "Virtualization Technology" (or "Intel VT-x" / "AMD-V") setting and **enable** it. Save and restart.

### Step 2b: Enable Windows Features via PowerShell
Even if BIOS virtualization is enabled, Windows needs specific features turned on.
1. Open **Windows PowerShell as Administrator**.
2. Run the following command to enable the Virtual Machine Platform:
   ```powershell
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   ```
3. Run the following command to enable the Windows Subsystem for Linux (WSL):
   ```powershell
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   ```
4. **Restart your computer**.


### Step 2c: Setup WSL and Ubuntu
After restarting your computer, open a regular PowerShell or Command Prompt and run:
1. Update WSL:
   ```powershell
   wsl --update
   ```
2. Install Ubuntu:
   ```powershell
   wsl --install -d Ubuntu
   ```
   *Credentials Set:* Username: `karlmendoza` / Password: `123456`

Now, open Docker Desktop. Wait for the green "Engine running" indicator in the bottom left corner.

## 3. Prepare Environment Variables
The application needs configuration secrets to run.
1. Navigate to the codebase folder: `src/fcrm-workbench`.
2. Copy the `.env.example` file and rename the copy to `.env`.
3. Open the `.env` file and fill in the values:
   - `ANTHROPIC_API_KEY`: Provide your valid Anthropic API key.
   - `LANGFUSE_SECRET` and `LANGFUSE_SALT`: Generate and paste random strings (e.g., `my-random-secret-123`).
   - `POSTGRES_PASSWORD`: You can leave this as `change-me` for local testing.

## 4. Start the Application using Docker Compose
We will use Docker to download Postgres, build the Python app, and start everything up.
1. Open **PowerShell** (or the VS Code terminal).
2. Change your directory to the workbench folder:
   ```powershell
   cd d:\geniushacks2026\geniushacks2026\src\fcrm-workbench
   ```
3. Run the following command to start all services:
   ```powershell
   docker compose up --build
   ```

## 5. Verify Everything is Running
Once the terminal logs show that the app is listening, you can access your services:
- **FastAPI Backend**: [http://localhost:8000](http://localhost:8000) (Interactive API docs at [http://localhost:8000/docs](http://localhost:8000/docs))
- **Langfuse Dashboard**: [http://localhost:3001](http://localhost:3001)
- **Postgres Database**: Running securely in Docker on port `5432`.

To stop the server at any time, just press `Ctrl + C` in your PowerShell terminal, or click the "Stop" button in the Docker Desktop UI.

## 6. Database Visualization
We successfully installed the IDE extensions to visualize and manage the PostgreSQL database directly within Antigravity IDE:
- Installed **SQLTools** (by `mtxr`)
- Installed **SQLTools PostgreSQL/Cockroach Driver** (by `mtxr`)
- Configured the connection to `localhost:5432` with username `fcrm` and password `ghax2026` via the `.vscode/settings.json`.
