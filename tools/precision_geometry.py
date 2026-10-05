"""Nominal geometry and right-hand screw kinematics for the original home film.

Sources already reviewed in this repository:
- ISO 68-1 basic 60-degree profile: site/lib.json, iso-68-1.
- ISO 4017/4032/4762/7089 nominal dimensions: app/base.html DIM and t_cad.js.
- Heavy-hex nominal width/height: e1_data.js HHN_IN, publicly available RCSC table.
The basic profile is not a manufacturing tolerance envelope or a torque calculation.
"""
from dataclasses import dataclass
import math

TAU = math.tau
MM = .01875


@dataclass(frozen=True)
class Thread:
    diameter: float
    pitch: float
    scale: float = MM

    @property
    def radius(self): return self.diameter*self.scale/2

    @property
    def lead(self): return self.pitch*self.scale

    @property
    def depth(self): return 5*math.sqrt(3)*self.lead/16

    def radius_at(self, angle, z, internal=False):
        # Right-handed helix, P/8 crest and P/4 root flats of the basic profile.
        phase = (z/self.lead-angle/TAU) % 1
        distance = min(phase, 1-phase)
        flank = max(0, min(1, (distance-1/16)/(5/16)))
        return self.radius-self.depth*flank + (.0005 if internal else -.0005)

    def compatible(self, other):
        return (math.isclose(self.diameter, other.diameter)
                and math.isclose(self.pitch, other.pitch))


def ease(t, a, b):
    x = max(0, min(1, (t-a)/(b-a)))
    return x*x*(3-2*x)


def engaged_pose(spec, seat, turns_remaining, reference=0):
    """Z and rotation share one lead; a seated rigid model does not sink or spin."""
    turns = max(0, turns_remaining)
    z = seat+turns*spec.lead
    angle = TAU*((seat-reference)/spec.lead+turns)
    return z, angle


def wrench_pose(spec, seat, t, start, period=.52, strokes=6, reference=0):
    """Six-point ring spanner: drive 60°, lift, reindex, lower. Stops at the seat."""
    elapsed = max(0, t-start)/period
    cycle = min(strokes, int(elapsed))
    phase = elapsed % 1 if cycle < strokes else 1
    drive = ease(phase, .03, .43) if cycle < strokes else 0
    done = min(strokes, cycle+drive)
    z, angle = engaged_pose(spec, seat, (strokes-done)/6, reference)
    lift = (.42*(ease(phase, .46, .60)-ease(phase, .80, .98))) if cycle < strokes else 0
    initial = engaged_pose(spec,seat,strokes/6,reference)[1]
    tool_angle = initial-TAU/6*drive+TAU/6*ease(phase,.62,.77) if cycle < strokes else initial
    return z, angle, lift, tool_angle


def ratchet_pose(spec, seat, t, start, period=.40, strokes=8, reference=0):
    """The bit stays in the recess on return; each drive advances one eighth turn."""
    elapsed = max(0, t-start)/period
    cycle = min(strokes, int(elapsed))
    phase = elapsed % 1 if cycle < strokes else 1
    drive = ease(phase, .04, .48) if cycle < strokes else 0
    done = min(strokes, cycle+drive)
    z, angle = engaged_pose(spec, seat, (strokes-done)/8, reference)
    initial = engaged_pose(spec,seat,strokes/8,reference)[1]
    handle_angle = initial-TAU/8*drive+TAU/8*ease(phase,.53,.97) if cycle < strokes else initial
    return z, angle, handle_angle

METRIC12 = Thread(12, 1.75)
METRIC16 = Thread(16, 2)
UNC34 = Thread(19.05, 2.54)
UN8_LARGE = Thread(38.1, 3.175, MM/2)
# Values are nominal envelope examples, not measured manufactured parts.
HEX12 = {'s':18, 'k':7.5, 'length':50}
SOCKET12 = {'dk':18, 'k':12, 's':10, 'depth':6, 'length':40}
NUT12 = {'s':18, 'm':10.8}
WASHER12 = {'id':13, 'od':24, 't':2.5}
HEAVY34 = {'s':31.75, 'm':.734*25.4}
HEAVY_LARGE = {'s':2.375*25.4, 'm':1.469*25.4}
