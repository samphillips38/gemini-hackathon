#!/usr/bin/env bash
# Download the full-res CAGB Level 2 plan next to this script. Run on a Mac/laptop with normal internet.
set -euo pipefail
cd "$(dirname "$0")"
curl -fsSL -o cagb-L2.jpg "https://www.imperial.ac.uk/media/migration/faculty-of-engineering/MENG-SKEM-L2-Model--tojpeg_1506604531634_x2.jpg"
ls -la cagb-L2.jpg
