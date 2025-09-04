#!/usr/bin/env python3
# curling_pivot_model.py
# Forward simulation of a curling draw shot using Leaney (2020)'s force model:
#   - Kinetic friction: μ(v) = μ0 * v**(-1/2)  [Eq. (1)]
#   - Force/torque balance integrated over the running band [Eqs. (2)-(4)]
#   - Local band velocity: v_local(phi) from translational + rotational components
#   - Added "pivot" lateral force f_p = f_N * μ_p * V_hat_perp with μ_p ∝ μ0 * (|ω| r)^(-1/2)  [Eq. (5)]
#   - Extra opposing torque from pivot term to match observed rotational deceleration
# References:
#   Leaney, S. (2020), "Curling rock physics and smartphone rotation data", GeoConvention 2020.
#   See μ(v) law, equations of motion, local band kinematics, and pivot force: pp. 3–4.  Rotation fit: pp. 6–7.
#   PDF excerpts cited in the chat for traceability.

import argparse
import csv
import math
import sys
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
import matplotlib.pyplot as plt


@dataclass
class Params:
    # Physical constants
    m: float = 19.0           # rock mass [kg]
    g: float = 9.81           # gravity [m/s^2]
    R: float = 0.145          # rock radius [m] (≈ 29 cm diameter)
    r_band: float = 0.065     # radius to running band center [m] (paper uses 0.065 m)
    # Friction law μ(v) = μ0 * v^(-1/2)
    mu0: float = 0.008        # baseline coefficient factor (typical order per literature)
    # Pivot force scaling: μ_p = alpha * μ0 * (|ω| r_band)^(-1/2)
    alpha: float = 0.014      # dimensionless weight (see Fig. 4/5 discussion in paper)
    # Integration / discretization
    segments: int = 360       # angular segments around running band
    dt: float = 0.01          # time step [s]
    t_max: float = 60.0       # max simulated time [s]
    v_stop: float = 0.01      # stop threshold for translational speed [m/s]
    w_stop: float = 0.02      # stop threshold for angular speed [rad/s]
    # Numerical guards
    v_eps: float = 1e-6       # epsilon to avoid division by zero


@dataclass
class State:
    t: float
    x: float
    y: float
    vx: float
    vy: float
    w: float  # angular velocity (rad/s)


def unit(vx: float, vy: float, eps: float) -> Tuple[float, float, float]:
    s = math.hypot(vx, vy)
    if s < eps:
        return 0.0, 0.0, eps
    return vx / s, vy / s, s


def simulate_draw(
    V0: float,
    turn: str,
    omega0: float,
    p: Params,
    sweep_factor: float = 1.0,
) -> List[State]:
    """
    Simulate a draw shot starting with translational speed V0 along +x and angular speed omega0.
    turn: 'in' (CCW, positive ω) or 'out' (CW, negative ω). If omega0 sign disagrees, it is enforced.
    sweep_factor: multiply μ0 by this factor (<1 reduces friction to emulate sweeping; >1 increases).
    """
    # Enforce sign convention: positive ω = CCW = 'in' per paper text (y to left)
    w0 = abs(omega0) if turn.lower().startswith("in") else -abs(omega0)

    # Precompute
    m, g, R, r = p.m, p.g, p.R, p.r_band
    I = 0.5 * m * R * R  # about vertical axis through COM [Eq. (4)]
    mu0 = p.mu0 * sweep_factor

    # Discretize circumference
    phis = np.linspace(0.0, 2.0 * math.pi, p.segments, endpoint=False)
    cosφ = np.cos(phis)
    sinφ = np.sin(phis)
    dN = (m * g) / p.segments  # distribute normal force uniformly

    # State
    s = State(t=0.0, x=0.0, y=0.0, vx=V0, vy=0.0, w=w0)
    out = [s]

    n_steps = int(p.t_max / p.dt)
    for _ in range(n_steps):
        # Stop condition
        if math.hypot(s.vx, s.vy) < p.v_stop and abs(s.w) < p.w_stop:
            break

        # Summation of forces and torques around the running band [Eqs. (2)-(4)]
        Fx = 0.0
        Fy = 0.0
        tau = 0.0

        # Local band velocities v_local(phi) = V + ω × r_hat * r
        # v_local_x = Vx - ω r sinφ ; v_local_y = Vy + ω r cosφ  (paper text)
        vloc_x = s.vx - s.w * r * sinφ
        vloc_y = s.vy + s.w * r * cosφ

        # |v_local| and unit vectors
        vmag = np.hypot(vloc_x, vloc_y)
        vmag_safe = np.maximum(vmag, p.v_eps)
        vhat_x = vloc_x / vmag_safe
        vhat_y = vloc_y / vmag_safe

        # μ(|v_local|) = μ0 * |v_local|^{-1/2}  [Eq. (1)]
        mu_local = mu0 * np.power(vmag_safe, -0.5)

        # Kinetic friction contributions (opposes v_local)
        dF_x = -(dN * mu_local) * vhat_x
        dF_y = -(dN * mu_local) * vhat_y

        # Sum forces
        Fx += float(np.sum(dF_x))
        Fy += float(np.sum(dF_y))

        # Torque τ_z = Σ (r_vec × dF)_z, with r_vec = (r cosφ, r sinφ, 0)
        # τ_z = r_x * dF_y - r_y * dF_x
        rx = r * cosφ
        ry = r * sinφ
        tau += float(np.sum(rx * dF_y - ry * dF_x))

        # Pivot force term (Leaney Eq. (5)): f_p = f_N * μ_p * V̂⊥  (added to (2),(3)),
        # with μ_p built from the same law using rotational speed v=|ω| r, then scaled by alpha.
        # Direction: toward slow side (left of V for +ω, right for −ω), i.e., sign(ω) * left-perp of V̂.
        Vhx, Vhy, Vmag = unit(s.vx, s.vy, p.v_eps)
        V_perp_left = (-Vhy, Vhx)  # +90° rotation of V̂

        # μ_p = alpha * μ0 * (max(|ω| r, eps))^{-1/2}
        v_rot = max(abs(s.w) * r, p.v_eps)
        mu_p = p.alpha * mu0 * (v_rot ** -0.5)

        Fp_mag = (m * g) * mu_p  # use full normal load for the net pivot term
        sgnw = 0.0 if abs(s.w) < 1e-12 else (1.0 if s.w > 0.0 else -1.0)

        Fx += sgnw * Fp_mag * V_perp_left[0]
        Fy += sgnw * Fp_mag * V_perp_left[1]

        # Extra opposing torque from the pivot term (improves ω(t) fit vs. standard model)
        # Treat pivot as an effective rim force producing torque opposite ω's sign.
        tau += -sgnw * Fp_mag * r

        # Time integration (explicit Euler; small dt)
        ax = Fx / m
        ay = Fy / m
        alpha_z = tau / I

        vx_next = s.vx + p.dt * ax
        vy_next = s.vy + p.dt * ay
        w_next = s.w + p.dt * alpha_z

        x_next = s.x + p.dt * vx_next
        y_next = s.y + p.dt * vy_next

        s = State(t=s.t + p.dt, x=x_next, y=y_next, vx=vx_next, vy=vy_next, w=w_next)
        out.append(s)

    return out


def write_csv(path: str, traj: List[State]) -> None:
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t_s", "x_m", "y_m", "vx_mps", "vy_mps", "omega_radps"])
        for s in traj:
            w.writerow([f"{s.t:.4f}", f"{s.x:.6f}", f"{s.y:.6f}", f"{s.vx:.6f}", f"{s.vy:.6f}", f"{s.w:.6f}"])


def main():
    ap = argparse.ArgumentParser(description="Curling draw-shot simulator (Leaney 2020 force model).")
    ap.add_argument("--V0", type=float, default=3.0, help="Initial translational speed along +x [m/s].")
    ap.add_argument("--omega0", type=float, default=1.45, help="Initial angular speed magnitude [rad/s].")
    ap.add_argument("--turn", choices=["in", "out"], default="out", help="Spin direction: 'in' (CCW) or 'out' (CW).")
    ap.add_argument("--mu0", type=float, default=0.008, help="μ0 in μ(v)=μ0*v^(-1/2).")
    ap.add_argument("--alpha", type=float, default=0.014, help="Pivot friction weight (μ_p scaling).")
    ap.add_argument("--segments", type=int, default=360, help="Running band discretization segments.")
    ap.add_argument("--dt", type=float, default=0.01, help="Time step [s].")
    ap.add_argument("--tmax", type=float, default=60.0, help="Max simulation time [s].")
    ap.add_argument("--rband", type=float, default=0.065, help="Running band radius [m].")
    ap.add_argument("--R", type=float, default=0.145, help="Rock radius [m].")
    ap.add_argument("--sweep", type=float, default=1.0, help="Friction multiplier (<1 sweeps; >1 keener ice).")
    ap.add_argument("--csv", type=str, default="trajectory.csv", help="Output CSV path.")
    ap.add_argument("--no-plot", action="store_true", help="Disable plots.")
    args = ap.parse_args()

    p = Params(
        mu0=args.mu0,
        alpha=args.alpha,
        segments=args.segments,
        dt=args.dt,
        t_max=args.tmax,
        r_band=args.rband,
        R=args.R,
    )

    traj = simulate_draw(V0=args.V0, turn=args.turn, omega0=args.omega0, p=p, sweep_factor=args.sweep)
    write_csv(args.csv, traj)

    # Final displacement and curl
    xf, yf = traj[-1].x, traj[-1].y
    sys.stdout.write(f"Final position: x={xf:.2f} m, y={yf:.2f} m (curl)\n")
    sys.stdout.write(f"Total time: {traj[-1].t:.2f} s, terminal |v|={math.hypot(traj[-1].vx, traj[-1].vy):.3f} m/s, |ω|={abs(traj[-1].w):.3f} rad/s\n")
    sys.stdout.write(f"CSV written: {args.csv}\n")

    if not args.no_plot:
        t = np.array([s.t for s in traj])
        x = np.array([s.x for s in traj])
        y = np.array([s.y for s in traj])
        w = np.array([s.w for s in traj])

        # Trajectory
        plt.figure()
        plt.plot(x, y)
        plt.xlabel("Down-ice x [m]")
        plt.ylabel("Across-ice y [m] (curl)")
        plt.title("Curling draw trajectory")

        # Angular velocity
        plt.figure()
        plt.plot(t, w)
        plt.xlabel("Time [s]")
        plt.ylabel("Angular velocity ω [rad/s]")
        plt.title("Rotation decay")

        # Down-ice speed
        plt.figure()
        plt.plot(t, np.hypot(np.gradient(x, t), np.gradient(y, t)))
        plt.xlabel("Time [s]")
        plt.ylabel("Speed [m/s]")
        plt.title("Speed vs time")

        plt.show()


if __name__ == "__main__":
    main()
