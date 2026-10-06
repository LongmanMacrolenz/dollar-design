"""Illustration state, not FEA, a fatigue-life prediction, or a corrosion model.

The only engineering dimensions reused here are approved nominal thread forms.
Visual deformation is deliberately magnified; normalized loads have no MPa value.
"""
import math
FPS = 24
STARTS = (0, 6, 12, 18, 24, 30, 36)
DURATION = 42
COUNT = FPS * DURATION

def ease(t, a, b):
    x = max(0., min(1., (t-a)/(b-a)))
    return x*x*(3-2*x)

def elastic_load(t):
    # Always unload to the original geometry before the chapter ends.
    return .65 * (ease(t,.7,2.8)-ease(t,3.4,5.3))

def fatigue_load(t):
    # All cycles stay tensile. This illustrates deformation, never endurance.
    if t < .7 or t >= 5.3:
        return 0.
    envelope = ease(t,.7,1.2)*(1-ease(t,4.8,5.3))
    return envelope * (.20 + .12*math.sin(2*math.pi*(t-.7)/.6))

def visual_stretch(load):
    return 1+.10*load

def chapter_at(t):
    return max(i for i,start in enumerate(STARTS) if t >= start)
