"""Guard the illustration's reversible loads and chapter/frame contract."""
import math, unittest
from material_film_model import FPS,COUNT,DURATION,STARTS,elastic_load,fatigue_load,visual_stretch,chapter_at

class IllustrationContract(unittest.TestCase):
    def test_full_timeline_and_chapter_boundaries(self):
        self.assertEqual(COUNT,1008);self.assertEqual(COUNT/FPS,DURATION)
        for i,start in enumerate(STARTS):
            self.assertEqual(chapter_at(start),i)
            self.assertEqual(chapter_at(start+6-1/FPS),i)
    def test_tension_never_exceeds_illustrative_elastic_window(self):
        loads=[elastic_load(i/FPS) for i in range(6*FPS)]
        self.assertTrue(all(0<=x<=.65+1e-12 for x in loads))
        self.assertAlmostEqual(max(loads),.65)
        self.assertEqual(loads[-1],0)
    def test_cycles_are_tensile_and_fully_unload(self):
        loads=[fatigue_load(i/FPS) for i in range(6*FPS)]
        self.assertTrue(all(0<=x<=.32+1e-12 for x in loads))
        self.assertGreater(max(loads),.31)
        self.assertEqual(loads[0],0);self.assertEqual(loads[-1],0)
    def test_recovery_has_no_residual_stretch(self):
        for load in [elastic_load(0),elastic_load(5.5),fatigue_load(0),fatigue_load(5.5)]:
            stretch=visual_stretch(load)
            self.assertEqual(stretch,1.)
            self.assertEqual(1/math.sqrt(stretch),1.)
    def test_visual_stretch_is_schematic_volume_preserving(self):
        for t in [i/FPS for i in range(6*FPS)]:
            for load in [elastic_load(t),fatigue_load(t)]:
                stretch=visual_stretch(load)
                self.assertAlmostEqual(stretch*(1/math.sqrt(stretch))**2,1.)

if __name__=='__main__':unittest.main()
