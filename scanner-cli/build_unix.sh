#!/bin/bash
echo "[InvisiThreat] Building scanner binary..."
pip install pyinstaller click requests --quiet
pyinstaller --onefile --name invisithreat scanner.py
echo ""
echo "Done! Binary is at dist/invisithreat"
echo "Install with: sudo cp dist/invisithreat /usr/local/bin/"
