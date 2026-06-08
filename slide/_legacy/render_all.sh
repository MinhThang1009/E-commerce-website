#!/bin/bash
# Render all Mermaid diagrams to PNG
# Prerequisites: npm install -g @mermaid-js/mermaid-cli
# Usage: cd mermaid && bash render_all.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for mmd in "$SCRIPT_DIR"/*.mmd; do
    name=$(basename "$mmd" .mmd)
    echo "Rendering $name..."
    npx mmdc -i "$mmd" -o "$SCRIPT_DIR/${name}.png" -w 2500 -H 1100 -b white -t default
    if [ $? -eq 0 ]; then
        echo "  OK: ${name}.png"
    else
        echo "  ERROR: ${name}"
    fi
done

echo "Done!"
