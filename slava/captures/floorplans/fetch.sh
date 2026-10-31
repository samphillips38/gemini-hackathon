#!/usr/bin/env bash
# Download CAGB floor plans (run on the Mac). Files land next to this script.
set -euo pipefail
cd "$(dirname "$0")"
base=https://www.imperial.ac.uk/media/migration/faculty-of-engineering
curl -fsSL -o cagb-L1.jpg "$base/MENG-SKEM-L1-Model--tojpeg_1485534952816_x2.jpg"
curl -fsSL -o cagb-L2.jpg "$base/MENG-SKEM-L2-Model--tojpeg_1506604531634_x2.jpg"
curl -fsSL -o cagb-L3.jpg "$base/MENG-SKEM-L3-Model--tojpeg_1506604833845_x2.jpg"
curl -fsSL -o cagb-L6.jpg "$base/CAGB-06-Model--tojpeg_1444734667218_x2.jpg"
curl -fsSL -o cagb-L7.jpg "$base/CAGB-07-Model--tojpeg_1485181298373_x2.jpg"
ls -la *.jpg
