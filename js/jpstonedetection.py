# crop_and_detect_curling_lines.py
# Requirements: pip install opencv-python numpy

import argparse, os, json, math
import numpy as np
import cv2

# ------------------------- Core geometry utils -------------------------

def order_pts(pts):
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
    return np.array([tl, tr, br, bl], dtype=np.float32)

def warp_from_rotated_rect(img, box_pts):
    box = order_pts(box_pts.astype(np.float32))
    wA = np.linalg.norm(box[1] - box[0]); wB = np.linalg.norm(box[2] - box[3])
    hA = np.linalg.norm(box[3] - box[0]); hB = np.linalg.norm(box[2] - box[1])
    width = int(round(max(wA, wB))); height = int(round(max(hA, hB)))
    width = max(width, 100); height = max(height, 100)
    dst = np.array([[0,0],[width-1,0],[width-1,height-1],[0,height-1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(box, dst)
    return cv2.warpPerspective(img, M, (width, height), flags=cv2.INTER_LINEAR)

# ------------------------- Sheet detection (crop/dewarp) -------------------------

def find_sheet_box(img_bgr):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5,5), 0)
    clahe = cv2.createCLAHE(2.0, (8,8))
    g = clahe.apply(gray)
    th = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                               cv2.THRESH_BINARY, 35, -5)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7,7))
    closed = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel, iterations=2)
    cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: raise RuntimeError("No contours found for sheet.")
    h, w = gray.shape; img_area = h*w
    cand = None; best_area = 0
    for c in cnts:
        area = cv2.contourArea(c)
        if area < 0.02*img_area: continue
        rect = cv2.minAreaRect(c); rw, rh = rect[1]
        if rw == 0 or rh == 0: continue
        aspect = max(rw, rh) / (min(rw, rh) + 1e-6)
        if 1.6 <= aspect <= 12.0 and area > best_area:
            cand = rect; best_area = area
    if cand is None: cand = cv2.minAreaRect(max(cnts, key=cv2.contourArea))
    return cv2.boxPoints(cand)

def detect_house_end(warped_bgr):
    h, w, _ = warped_bgr.shape
    hsv = cv2.cvtColor(warped_bgr, cv2.COLOR_BGR2HSV)
    red1 = cv2.inRange(hsv, (0,70,60), (10,255,255))
    red2 = cv2.inRange(hsv, (170,70,60), (180,255,255))
    blue = cv2.inRange(hsv, (95,70,60), (135,255,255))
    mask = cv2.morphologyEx(red1|red2|blue, cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)), 2)
    ys, xs = np.where(mask>0)
    if ys.size < 100: return None
    band = max(5, int(0.2*h))
    top_count = (ys < band).sum(); bot_count = (ys > (h-band)).sum()
    if max(top_count, bot_count) < 50: return None
    return 'top' if top_count >= bot_count else 'bottom'

def ensure_house_at(warped_bgr, target_pos):
    if target_pos == 'none': return warped_bgr
    where = detect_house_end(warped_bgr)
    if where is None: return warped_bgr
    if (target_pos == 'top' and where == 'bottom') or (target_pos == 'bottom' and where == 'top'):
        return cv2.rotate(warped_bgr, cv2.ROTATE_180)
    return warped_bgr

def crop_tight(warped):
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    _, t = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    if np.mean(gray[t>0]) < np.mean(gray[t==0]): t = cv2.bitwise_not(t)
    t = cv2.morphologyEx(t, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT,(7,7)),2)
    cnts,_ = cv2.findContours(t, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: return warped
    x,y,w,h = cv2.boundingRect(max(cnts, key=cv2.contourArea))
    return warped[y:y+h, x:x+w].copy()

# ------------------------- House circle detection -------------------------

def detect_house_circles(img_bgr):
    """
    Returns: dict with keys 'center' (x,y), 'radii' [r1<=r2<=...], and 'circles' [(x,y,r), ...]
    Robust across patterned rings by relying on gradients; tuned for overhead views.
    """
    out = {'center': None, 'radii': [], 'circles': []}
    h, w = img_bgr.shape[:2]
    # Crop to central band to suppress boards and hog area noise
    band = slice(int(0.15*h), int(0.65*h))
    roi = img_bgr[band, :]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (7,7), 1.5)

    edges = cv2.Canny(gray, 60, 180, L2gradient=True)
    edges = cv2.medianBlur(edges, 5)

    # HoughCircles parameters are critical; dp=1.2, minDist relative to roi height
    min_r = int(0.08*min(roi.shape[:2]))
    max_r = int(0.45*min(roi.shape[:2]))
    circles = cv2.HoughCircles(edges, cv2.HOUGH_GRADIENT, dp=1.2, minDist=25,
                               param1=180, param2=25, minRadius=min_r, maxRadius=max_r)
    if circles is None: return out
    circles = np.round(circles[0, :]).astype(int)

    # Group by center proximity -> choose dominant center, then sort by radius
    if len(circles) > 1:
        # KMeans-like single-center vote
        cx = np.median(circles[:,0]); cy = np.median(circles[:,1])
        # convert roi coords to image coords
        cy += int(0.15*h)
        # keep circles whose centers are near the median center
        keep = []
        for (x,y,r) in circles:
            y_full = y + int(0.15*h)
            if abs(x - cx) < 0.06*w and abs(y_full - cy) < 0.06*h:
                keep.append((int(x), int(y_full), int(r)))
        if len(keep) == 0: 
            # fallback: take largest three by radius
            keep = [(int(x), int(y+int(0.15*h)), int(r)) for (x,y,r) in circles]
        circles = np.array(keep, dtype=int)
    else:
        x,y,r = circles[0]; circles = np.array([(int(x), int(y+int(0.15*h)), int(r))])

    # Normalize to image coords and sort by radius
    circles = sorted([(int(x), int(y), int(r)) for (x,y,r) in circles], key=lambda t: t[2])
    out['circles'] = circles
    # center from average of circles
    cx = int(np.mean([c[0] for c in circles])); cy = int(np.mean([c[1] for c in circles]))
    out['center'] = (cx, cy)
    out['radii'] = [c[2] for c in circles]
    return out

# ------------------------- Line detection and classification -------------------------

def detect_lines(img_bgr):
    """
    Returns the strongest long near-horizontal and near-vertical segments after Canny+Hough.
    """
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5,5), 0)
    edges = cv2.Canny(blur, 40, 120, L2gradient=True)

    # Prefer long lines; tune minLineLength relative to width/height
    min_len_v = int(0.60 * h)
    min_len_h = int(0.40 * w)
    lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi/180, threshold=120,
                            minLineLength=min(min_len_h, min_len_v), maxLineGap=18)
    if lines is None: return []

    segs = []
    for l in lines[:,0,:]:
        x1,y1,x2,y2 = map(int, l)
        dx,dy = x2-x1, y2-y1
        length = math.hypot(dx,dy)
        if length < min(min_len_h, min_len_v): continue
        angle = abs(math.degrees(math.atan2(dy, dx)))
        # normalize angle to [0,90]
        angle = angle if angle <= 90 else 180 - angle
        segs.append({'p1':(x1,y1), 'p2':(x2,y2), 'len':length, 'angle':angle})
    return segs

def classify_sheet_lines(segs, center, img_shape):
    """
    Classify centerline (vertical through center),
    tee line (horizontal through center),
    backline (next horizontal below center),
    hog line (next horizontal above center, far from center).
    Uses geometric proximity and expected spacing ratio hog≈3.5×back (tee to hog ~6.40m, tee to back 1.83m).
    """
    h, w = img_shape[:2]
    cx, cy = center if center else (w//2, h//2)

    # Separate near-vertical and near-horizontal
    verticals  = [s for s in segs if s['angle'] > 70]     # ~vertical
    horizontals = [s for s in segs if s['angle'] < 20]    # ~horizontal

    # Centerline: vertical whose x at mid-height is nearest to center.x
    def seg_x_at_y(s, yq):
        (x1,y1),(x2,y2) = s['p1'], s['p2']
        if x2==x1: return x1
        if y2==y1: return (x1+x2)//2
        t = (yq - y1) / (y2 - y1)
        t = max(0,min(1,t))
        return int(x1 + t*(x2-x1))
    centerline = None
    if verticals:
        centerline = min(verticals, key=lambda s: abs(seg_x_at_y(s, cy) - cx))

    # Tee/back/hog from horizontals based on y-position
    ys = []
    for s in horizontals:
        (x1,y1),(x2,y2) = s['p1'], s['p2']
        y = int((y1+y2)/2)
        ys.append((y,s))
    ys.sort(key=lambda t: t[0])

    tee = None; back = None; hog = None
    if ys:
        # Tee line: closest horizontal to cy
        tee_y, tee = min(ys, key=lambda t: abs(t[0]-cy))
        # Candidates above/below
        below = [(y,s) for (y,s) in ys if y > tee_y + 0.01*h]
        above = [(y,s) for (y,s) in ys if y < tee_y - 0.01*h]
        # Backline: nearest below
        if below:
            back_y, back = min(below, key=lambda t: abs(t[0]-tee_y))
        # Hogline: pick a strong line above with spacing ratio ~3.5× back
        if above:
            if back is not None:
                target = 3.5 * abs(back_y - tee_y)
                hog_y, hog = min(above, key=lambda t: abs((tee_y - t[0]) - target))
                # if ratio is poor, fallback to farthest visible above
                if abs((tee_y - hog_y) - target) > 0.25*target:
                    hog_y, hog = max(above, key=lambda t: abs(t[0]-tee_y))
            else:
                hog_y, hog = max(above, key=lambda t: abs(t[0]-tee_y))

    result = {
        'centerline': line_to_dict(centerline),
        'tline':      line_to_dict(tee),
        'backline':   line_to_dict(back),
        'hogline':    line_to_dict(hog)
    }
    return result

def line_to_dict(seg):
    if seg is None: return None
    return {'p1': seg['p1'], 'p2': seg['p2'], 'length': seg['len'], 'angle_deg': seg['angle']}

# ------------------------- Pipeline -------------------------

def process_image(path_in, path_out, overlay_out, json_out, house_pos):
    img = cv2.imread(path_in, cv2.IMREAD_COLOR)
    if img is None: raise RuntimeError(f"Failed to read image: {path_in}")

    scale = 1200 / max(img.shape[:2]) if max(img.shape[:2]) > 1200 else 1.0
    small = cv2.resize(img, (int(img.shape[1]*scale), int(img.shape[0]*scale)),
                       interpolation=cv2.INTER_AREA) if scale!=1.0 else img

    box_small = find_sheet_box(small)
    box_full = box_small / scale
    warped = warp_from_rotated_rect(img, box_full)
    warped = ensure_house_at(warped, house_pos)
    warped = crop_tight(warped)

    # Write cropped/dewarped
    if path_out:
        cv2.imwrite(path_out, warped)

    # Detect features
    circles_info = detect_house_circles(warped)
    segs = detect_lines(warped)
    line_map = classify_sheet_lines(segs, circles_info['center'], warped.shape)

    # Prepare overlay
    overlay = warped.copy()
    # Draw circles
    if circles_info['center'] is not None:
        for (x,y,r) in circles_info['circles']:
            cv2.circle(overlay, (x,y), r, (0,255,0), 2)
        cv2.circle(overlay, circles_info['center'], 4, (0,0,255), -1)

    # Draw lines (distinct colors)
    def draw_seg(seg, color):
        if seg is None: return
        cv2.line(overlay, tuple(seg['p1']), tuple(seg['p2']), color, 3)

    draw_seg(line_map['centerline'], (255,0,0))   # blue
    draw_seg(line_map['tline'],      (0,165,255)) # orange
    draw_seg(line_map['backline'],   (0,0,255))   # red
    draw_seg(line_map['hogline'],    (0,255,255)) # yellow

    if overlay_out:
        cv2.imwrite(overlay_out, overlay)

    # JSON export with pixel coordinates (image origin top-left)
    result = {
        'image_size': {'width': int(warped.shape[1]), 'height': int(warped.shape[0])},
        'house': {
            'center_px': circles_info['center'],
            'radii_px': circles_info['radii'],
            'circles_px': circles_info['circles']  # [(x,y,r), ...]
        },
        'lines': line_map
    }
    if json_out:
        with open(json_out, 'w') as f:
            json.dump(result, f, indent=2)
    return result

# ------------------------- CLI -------------------------

def main():
    ap = argparse.ArgumentParser(description="Crop/dewarp curling sheet and detect house circles and critical lines.")
    ap.add_argument("input", help="input image path")
    ap.add_argument("--out", required=False, help="output cropped image (jpg/png)")
    ap.add_argument("--overlay", required=False, help="output overlay image with annotations (png)")
    ap.add_argument("--json", required=False, help="output JSON with pixel coordinates")
    ap.add_argument("--house", choices=["top","bottom","none"], default="none",
                    help="rotate so the house is at the requested edge if detected")
    args = ap.parse_args()

    # Default outputs if not provided
    root, ext = os.path.splitext(args.input)
    path_out = args.out or f"{root}_cropped.jpg"
    overlay_out = args.overlay or f"{root}_overlay.png"
    json_out = args.json or f"{root}_features.json"

    process_image(args.input, path_out, overlay_out, json_out, args.house)
    print(f"Wrote:\n  {path_out}\n  {overlay_out}\n  {json_out}")

if __name__ == "__main__":
    main()
