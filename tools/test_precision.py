"""Check physical invariants of the original film without installing Blender.

The tests exercise thread phase, axial lead, seating and tool disengagement.
They do not certify a manufactured part, a tolerance class or a torque value.
"""
import math
import unittest

from precision_geometry import (
    METRIC12, METRIC16, UNC34, UN8_LARGE, HEAVY34, MM,
    engaged_pose, wrench_pose, ratchet_pose,
)


class PrecisionMotion(unittest.TestCase):
    def test_rotation_and_advance_have_the_same_lead(self):
        for spec in (METRIC12, METRIC16, UNC34, UN8_LARGE):
            positions = [engaged_pose(spec, 1.295, t, .20) for t in (0, .125, .5, 1, 2)]
            for (z0, a0), (z1, a1) in zip(positions, positions[1:]):
                self.assertAlmostEqual((z1-z0)/(a1-a0), spec.lead/math.tau)
            # A whole revolution advances one pitch even for differently scaled examples.
            self.assertAlmostEqual(positions[3][0]-positions[0][0], spec.pitch*spec.scale)

    def test_mating_profiles_share_phase_throughout_travel(self):
        # Sample in world coordinates; transform to the moving nut's coordinates.
        # A rotating but stationary nut, or an arbitrary drop, would cross the flanks.
        for spec in (METRIC12, METRIC16, UNC34, UN8_LARGE):
            reference = .20
            for turns in (0, .03125, .125, .333, .75, 1):
                nut_z, nut_angle = engaged_pose(spec, 1.295, turns, reference)
                for angle_step in range(13):
                    world_angle = angle_step*math.tau/13
                    for axial_step in range(19):
                        world_z = 1.30+axial_step*spec.lead/19
                        male = spec.radius_at(world_angle, world_z-reference)
                        female = spec.radius_at(world_angle-nut_angle, world_z-nut_z, internal=True)
                        self.assertAlmostEqual(female-male, .001, places=10)

    def test_seating_prevents_penetration_and_further_rotation(self):
        for spec in (METRIC12, METRIC16, UNC34, UN8_LARGE):
            seated = engaged_pose(spec, 1.295, 0, .20)
            for turns in (-.01, -.25, -1):
                self.assertEqual(engaged_pose(spec, 1.295, turns, .20), seated)
            for turns in (0, .01, .5, 1):
                self.assertGreaterEqual(engaged_pose(spec, 1.295, turns, .20)[0], 1.295)

    def test_six_point_wrench_reindexes_only_when_clear(self):
        height = HEAVY34['m']*MM
        previous_z = float('inf')
        previous_tool = None
        for i in range(4201):
            t=2.10+i/1000
            z, nut, lift, tool = wrench_pose(UNC34, 1.295, t, 2.10, reference=.20)
            self.assertLessEqual(z, previous_z+1e-12)
            self.assertGreaterEqual(z, 1.295)
            # Ring centre is 0.18 above the nut base; thickness is 0.09.
            if .18-.09/2+lift < height:
                angle_error = (tool-nut+math.pi/6)%(math.pi/3)-math.pi/6
                self.assertAlmostEqual(angle_error, 0, places=9)
            if previous_tool is not None:
                # Fastest reindex: smoothstep peak speed is 1.5 × angle / duration.
                max_step = 1.5*(math.pi/3)/(.15*.52)/1000
                self.assertLessEqual(abs(tool-previous_tool), max_step+1e-6)
            previous_z, previous_tool = z, tool
        self.assertAlmostEqual(previous_z, 1.295)

    def test_ratchet_return_does_not_unscrew_or_jump(self):
        previous_z=float('inf')
        previous_handle=None
        reference=1.35
        for i in range(3901):
            t=1.70+i/1000
            z, screw, handle=ratchet_pose(METRIC12, 1.146875, t, 1.70, reference=reference)
            self.assertLessEqual(z, previous_z+1e-12)
            self.assertGreaterEqual(z, 1.146875)
            self.assertAlmostEqual(z-reference, screw/math.tau*METRIC12.lead)
            if previous_handle is not None:
                self.assertLess(abs(handle-previous_handle), .02)
            previous_z,previous_handle=z,handle
        for cycle in range(8):
            t=1.70+cycle*.40
            drive_end=ratchet_pose(METRIC12,1.146875,t+.40*.50,1.70,reference=reference)
            return_end=ratchet_pose(METRIC12,1.146875,t+.40*.97,1.70,reference=reference)
            self.assertEqual(drive_end[:2],return_end[:2])
            self.assertGreater(return_end[2],drive_end[2])
        self.assertAlmostEqual(previous_z,1.146875)

    def test_similar_diameter_does_not_make_threads_compatible(self):
        from precision_geometry import Thread
        self.assertFalse(Thread(16,2).compatible(Thread(15.875,2.54)))
        self.assertFalse(Thread(19.05,2.54).compatible(Thread(19.05,3.175)))
        self.assertTrue(METRIC12.compatible(Thread(12,1.75)))


if __name__ == '__main__':
    unittest.main()
