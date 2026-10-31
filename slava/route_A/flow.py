"""Walking-speed proxy from phone video: forward motion = radial expansion of optical flow (pan/tilt cancels out)."""
import cv2, numpy as np, json, sys
path, tag, fps_s = sys.argv[1], sys.argv[2], 5.0
cap = cv2.VideoCapture(path); src_fps = cap.get(cv2.CAP_PROP_FPS); step = max(1, round(src_fps / fps_s))
prev = None; i = 0; rows = []
while True:
    ok, fr = cap.read()
    if not ok: break
    if i % step == 0:
        g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY); g = cv2.resize(g, (192, 108)) if g.shape[1] > g.shape[0] else cv2.resize(g, (108, 192))
        # video is stored landscape; vertical video has rotation metadata, flow is rotation-invariant for magnitude stats
        if prev is not None:
            f = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            h, w = g.shape; ys, xs = np.mgrid[0:h, 0:w]; cx, cy = w / 2, h / 2
            rx, ry = xs - cx, ys - cy; rn = np.sqrt(rx**2 + ry**2) + 1e-6
            mx, my = f[..., 0].mean(), f[..., 1].mean()          # global pan/tilt
            fx, fy = f[..., 0] - mx, f[..., 1] - my               # remove pan
            radial = ((fx * rx + fy * ry) / rn)                   # expansion (+) when walking forward
            mask = rn > 0.15 * min(w, h)
            rows.append(dict(t=round(i / src_fps, 2), fwd=float(np.median(radial[mask])), pan=float(np.hypot(mx, my)),
                             mag=float(np.hypot(f[..., 0], f[..., 1]).mean())))
        prev = g
    i += 1
json.dump(rows, open(f"flow_{tag}.json", "w")); print(tag, len(rows), "samples, src fps", src_fps)
