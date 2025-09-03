import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import minimize

g = 32.174  # ft/s²
L = 99.0    # near hog to back line distance

# Hog-to-hog anchor times and tee-line curls (inches)
anchors = {
    8.0: 3.0,
    9.0: 7.0,
    10.0: 12.0,
    11.2: 16.0,
    12.5: 22.0,
    14.5: 45.0
}
y_tee = 93.0  # ft to tee-line

def v0_from_time(mu, L, t_hog):
    a = mu * g
    return (2*a*L + (t_hog**2)*(a**2)) / (2*t_hog*a)

def path_xy(mu, C, n, beta, y0, kappa, t_hog, N=1000):
    a = mu * g
    v0 = v0_from_time(mu, L, t_hog)
    y = np.linspace(0, L, N)
    v = np.sqrt(np.maximum(v0**2 - 2*a*y, 1e-12))
    logistic = 1.0 / (1.0 + np.exp(-kappa*(y - y0)))
    curvature = (C / (v**n)) * (1.0 + beta*logistic)
    x = np.cumsum((curvature[:-1] + curvature[1:]) * 0.5 * (y[1]-y[0]))
    x = np.concatenate([[0.0], x])
    return y, x

def error(params):
    mu, C, n, beta, y0, kappa = params
    err = 0.0
    for t_hog, target in anchors.items():
        y, x = path_xy(mu, C, n, beta, y0, kappa, t_hog)
        x_tee = np.interp(y_tee, y, x)
        err += (x_tee - target)**2
    return err

# Initial guess and bounds
x0 = [0.015, 500, 2.0, 0.5, 90.0, 0.2]
bounds = [(0.005, 0.05), (10, 2000), (0.5, 4.0), (0, 2), (70, 100), (0.05, 1.0)]
res = minimize(error, x0, bounds=bounds)

mu, C, n, beta, y0, kappa = res.x
print("Fitted params:", res.x)

# Plot fitted paths
plt.figure(figsize=(9,6))
for t_hog in anchors.keys():
    y, x = path_xy(mu, C, n, beta, y0, kappa, t_hog)
    plt.plot(y, x/12.0, label=f"{t_hog:.1f}s")  # <-- convert to feet
    # Mark anchor point at tee
    x_tee = np.interp(y_tee, y, x)
    plt.scatter([y_tee], [x_tee/12.0], marker='o', color='k')  # <-- convert to feet

plt.axvline(y_tee, color='gray', linestyle='--')
plt.text(y_tee, 0, "Tee", rotation=90, va='bottom', ha='right')
plt.xlabel("Down-ice distance (ft)")
plt.ylabel("Curl offset (ft)")  # <-- now in feet
plt.title("Velocity-based Curling Stone Model (fitted to anchors)")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.show()
