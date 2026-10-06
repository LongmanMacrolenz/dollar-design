"""Original seven-chapter engineering film. Blender 4.3+, Cycles CPU.

blender -b -t 4 -P tools/render_material_film.py -- --out /tmp/frames
Drawing reveal and elastic deflection are conceptual, visibly magnified.
Hardness leaves an impression only in a separate sacrificial coupon.
Rust represents barrier damage, not a measured corrosion rate or colour ranking.
Geometry helpers are reused from the original studio renderer (no remote assets).
"""
import argparse, ast, math, sys, shutil, hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from precision_geometry import *
from material_film_model import *
import bpy
from mathutils import Vector, Matrix
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--frames',nargs='+',type=int);p.add_argument('--width',type=int,default=1200);p.add_argument('--samples',type=int,default=12);p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=COUNT-1);p.add_argument('--engine',choices=['cycles','eevee'],default='cycles')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES' if a.engine=='cycles' else 'BLENDER_EEVEE_NEXT'
scene.cycles.samples=a.samples;scene.cycles.use_denoising=False;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.13;scene.cycles.max_bounces=4;scene.cycles.seed=31;scene.render.use_persistent_data=True
scene.eevee.taa_render_samples=a.samples
scene.render.resolution_x=a.width;scene.render.resolution_y=a.width*3//4;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.fps=FPS
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.08,.12,.18,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.38
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
# Load only reusable function definitions, never the old scene or render loop.
source=ast.parse((Path(__file__).parent/'render_hero.py').read_text())
functions=['material','group','finish','box','cylinder','profile_radius','ring','path','thread_body','threaded_nut','bolt','stud','nut','washer','clip','cut']
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='material'],type_ignores=[]),'studio materials','exec'))
_mesh_cache={}
steel=material('Satin steel',(.32,.38,.44),.97,.25);zinc=material('Bright metal',(.48,.53,.58),.95,.22);iron=material('Dark steel',(.065,.08,.10),.9,.26)
body=material('Graphite testing instrument',(.035,.06,.09),.7,.3);floor=material('Navy seamless studio',(.009,.016,.026),.1,.46)
orange=material('Copper signal',(.72,.12,.035),.75,.26);blue=material('Blue illustrative coating',(.025,.18,.42),.35,.31);white=material('White illustrative coating',(.60,.66,.72),.55,.3);black=material('Black illustrative coating',(.022,.029,.034),.35,.33)
line=material('Technical drawing cyan',(.12,.48,.62),.2,.32)
node=line.node_tree.nodes.get('Principled BSDF');node.inputs['Emission Color'].default_value=(.08,.3,.44,1);node.inputs['Emission Strength'].default_value=.8
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in functions and n.name!='material'],type_ignores=[]),'studio geometry','exec'))
box('Studio floor',(200,200,.05),(0,0,-.04),floor,bevel=0)

def light(name,location,power,color,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector((0,0,1.5))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Large neutral softbox',(-3,-4,7),1600,(.85,.92,1),5)
light('Clean strip reflection',(4,2,5),2100,(1,1,1),3)
light('Warm edge highlight',(2,-1,3),500,(1,.5,.25),2.4)
cam=bpy.data.objects.new('Engineering studio camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=6.7
cam.location=(6,-9,6.0);cam.rotation_euler=(Vector((0,0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler()
groups=[]

def drawing_scene():
 root=group('01 / technical drawing to solid')
 solids=[bolt(root),nut(root),washer(root,True),box('Parallel key',(.25,.8,.22),(0,0,0),zinc,root,.04)]
 positions=[(-1.6,0,.55),(-.4,0,.65),(.7,0,.85),(1.6,0,.65)]
 outlines=[]
 for i,item in enumerate(solids):
  item.location=positions[i];item.scale=(1.7,)*3
  wire=group('Projected 2D outline',root);wire.location=positions[i]
  if i==0:
   pts=[(-.2,0,0),(.2,0,0),(.2,0,1.6),(.38,0,1.6),(.38,0,1.82),(-.38,0,1.82),(-.38,0,1.6),(-.2,0,1.6),(-.2,0,0)]
  elif i==1:
   pts=[(-.58,0,0),(.58,0,0),(.58,0,.6),(-.58,0,.6),(-.58,0,0)]
  elif i==2:
   pts=[(-.4,0,0),(.4,0,0),(.4,0,.10),(-.4,0,.10),(-.4,0,0)]
  else:pts=[(-.2,0,0),(.2,0,0),(.2,0,1.25),(-.2,0,1.25),(-.2,0,0)]
  path('Orthographic outline',pts,.006,line,wire)
  for z in (0,.7,1.4):path('Drawing datum',[(-.7,0,z),(.7,0,z)],.002,line,wire)
  outlines.append(wire)
 def update(t):
  for i,item in enumerate(solids):
   q=ease(t,.6+i*.32,2.5+i*.32)
   item.scale=(1.7,.002+1.698*q,1.7)
   item.rotation_euler=(.10*q,.20*q,.40*q)
   for o in [item,*item.children_recursive]:o.hide_render=q<.01
   for o in [outlines[i],*outlines[i].children_recursive]:o.hide_render=q>.96
 return root,update

def thread_scene():
 root=group('02 / UNC versus UNF basic profile')
 coarse=Thread(19.05,2.54,MM*1.55);fine=Thread(19.05,25.4/16,MM*1.55)
 items=[]
 for spec,x in [(coarse,-1.1),(fine,1.1)]:
  st=thread_body(root,spec,2.45,material=zinc);st.location=(x,0,.55)
  items.append(st)
  ring('Pitch datum ring',spec.radius+.015,spec.radius+.010,.012,(x,0,1.25),orange,root,bevel=0)
 def update(t):
  q=ease(t,.4,3.0)
  for o in items:o.rotation_euler.z=.6*q
 return root,update

def nut_scene():
 root=group('03 / regular illustrative nut and approved heavy envelope')
 spec=Thread(19.05,2.54,MM*2.2)
 # Regular height is an illustration, never an ASME min/max dimension.
 regular=threaded_nut(root,spec,28.575*spec.scale,.54*25.4*spec.scale,zinc,'Regular hex height illustrative')
 heavy=threaded_nut(root,spec,HEAVY34['s']*spec.scale,HEAVY34['m']*spec.scale,zinc,'RCSC 3/4 heavy nominal envelope')
 regular.location=(-1.2,0,.6);heavy.location=(1.2,0,.6)
 for item in (regular,heavy):
  path('Height witness line',[(.85,0,0),(.85,0,.95)],.005,line,item)
 def update(t):
  q=ease(t,.3,2.5)
  for item in (regular,heavy):item.rotation_euler.z=.35*q
 return root,update

def test_scene(fatigue=False):
 root=group('05 / cyclic tensile load' if fatigue else '04 / elastic tensile loading')
 test=group('Illustrative tensile bolt',root)
 spec=Thread(19.05,2.54,MM*1.4)
 thread_body(test,spec,2.6,material=zinc)
 cylinder('Bolt head',.58,.25,(0,0,2.72),zinc,test,6)
 test.location=(0,0,.7)
 upper=group('Moving test grip',root);upper.location=(0,0,3.4)
 box('Upper grip',(1.05,.78,.55),(0,0,0),body,upper,.045)
 box('Lower grip',(1.05,.78,.55),(0,0,.65),body,root,.045)
 for x in (-1.05,1.05):cylinder('Load frame column',.07,3.9,(x,.48,2.0),steel,root)
 box('Load frame base',(2.8,1.1,.16),(0,.30,.10),body,root,.03)
 box('Load frame beam',(2.8,1.1,.22),(0,.30,3.95),body,root,.03)
 def update(t):
  load=fatigue_load(t) if fatigue else elastic_load(t)
  stretch=visual_stretch(load)
  test.scale=(1/math.sqrt(stretch),1/math.sqrt(stretch),stretch)
  upper.location.z=3.4+2.6*(stretch-1)
 return root,update

def hardness_scene():
 root=group('06 / hardness on a separate witness coupon')
 box('Test table',(2.6,1.8,.22),(0,0,.25),body,root,.05)
 coupon=box('Separate sacrificial coupon',(1.9,1.3,.3),(0,0,.51),zinc,root,.035)
 # Genuine shallow impression, retained after indenter is withdrawn.
 bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=0,radius2=.12,depth=.25)
 cutter=bpy.context.object;cutter.name='Permanent impression matching the indenter';cutter.parent=root;cutter.location=(0,0,.64)
 bpy.context.view_layer.objects.active=coupon
 mod=coupon.modifiers.new('Permanent witness impression','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
 intact=box('Before test coupon',(1.9,1.3,.3),(0,0,.51),zinc,root,.035)
 indenter=group('Hardness indenter',root)
 cylinder('Instrument holder',.27,.75,(0,0,.63),steel,indenter)
 bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=0,radius2=.12,depth=.25)
 tip=bpy.context.object;tip.location=(0,0,.13);finish(tip,'Illustrative indentation tip',steel,indenter,.002)
 ref=bolt(root,mat=iron);ref.location=(1.5,.2,.4);ref.scale=(1.25,)*3
 def update(t):
  q=ease(t,.8,2.3)-ease(t,3.2,4.7)
  indenter.location.z=1.5-.99*q
  intact.hide_render=t>2.25;coupon.hide_render=t<=2.25
 return root,update

def rust_material(base,name):
 mat=base.copy();mat.name=name
 n=mat.node_tree.nodes;l=mat.node_tree.links;pbr=n.get('Principled BSDF')
 tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=17;tex.inputs['Detail'].default_value=3
 threshold=n.new('ShaderNodeMath');threshold.operation='GREATER_THAN';l.new(tex.outputs['Fac'],threshold.inputs[0]);threshold.inputs[1].default_value=1
 mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[1].default_value=pbr.inputs['Base Color'].default_value[:];mix.inputs[2].default_value=(.28,.075,.022,1)
 l.new(threshold.outputs[0],mix.inputs[0]);l.new(mix.outputs[0],pbr.inputs['Base Color'])
 metal=n.new('ShaderNodeMapRange');metal.inputs['From Min'].default_value=0;metal.inputs['From Max'].default_value=1;metal.inputs['To Min'].default_value=.8;metal.inputs['To Max'].default_value=0
 l.new(threshold.outputs[0],metal.inputs['Value']);l.new(metal.outputs['Result'],pbr.inputs['Metallic'])
 return mat,threshold.inputs[1]

def coating_scene():
 root=group('07 / generic protective layer and damaged layer')
 parameters=[]
 for i,mat in enumerate([zinc,blue,white,black]):
  coat,value=rust_material(mat,'Generic barrier visual '+str(i));parameters.append(value)
  item=bolt(root,mat=coat);item.location=(-1.65+i*1.1,0,.50);item.scale=(2.,)*3
 # Generic moisture particles: qualitative exposure, not a salt-spray apparatus.
 droplets=[]
 wet=material('Moisture glints',(.12,.3,.5),.2,.15)
 for i in range(12):
  drop=cylinder('Exposure droplet',.013,.055,(-2+(i*1.17)%4,.65,2.9),wet,root,12);droplets.append(drop)
 def update(t):
  environment=min(2,int(t/2))
  q=ease(t%2,.25,1.7)
  exposure=(0.,.48,.58)[environment]
  parameters[0].default_value=1-exposure*q
  # Same threshold for all colours: no invented coating performance ranking.
  for value in parameters[1:]:value.default_value=1-(0.,.18,.25)[environment]*q
  for i,drop in enumerate(droplets):
   drop.hide_render=environment==0
   drop.location.z=.50+(2.6-(t*.8+i*.20)%2.6)
 return root,update

groups=[drawing_scene(),thread_scene(),nut_scene(),test_scene(),test_scene(True),hardness_scene(),coating_scene()]
# Constant edge modifiers are baked once for stable highlights and faster frames.
bpy.ops.object.select_all(action='DESELECT')
meshes=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH')

def prepare(frame):
 t=frame/FPS;chapter=chapter_at(t);local=t-STARTS[chapter]
 target=Vector((0,0,1.9 if chapter in (3,4) else 1.25))
 cam.data.ortho_scale=7.4 if chapter in (3,4) else 6.7
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 for i,(root,update) in enumerate(groups):
  for o in [root,*root.children_recursive]:o.hide_render=i!=chapter
  if i==chapter:update(local)
 bpy.context.view_layer.update()
cache={}
for frame in a.frames or range(a.start,a.end+1):
 target=out/f'{frame:04d}.png'
 if target.exists() and not a.frames:continue
 scene.frame_set(frame);prepare(frame)
 state=tuple((o.name,tuple(round(v,8) for row in o.matrix_world for v in row)) for o in scene.objects if not o.hide_render and o.type in {'MESH','CAMERA'})
 if chapter_at(frame/FPS)==6:
  local=frame/FPS-36;environment=min(2,int(local/2))
  state+=(('corrosion',environment,round(ease(local%2,.25,1.7),8) if environment else 0),)
 key=hashlib.sha1(repr(state).encode()).hexdigest()
 if key in cache and cache[key].is_file():shutil.copyfile(cache[key],target);print('REUSED',frame,flush=True);continue
 scene.render.filepath=str(target);bpy.ops.render.render(write_still=True);cache[key]=target
 print('MATERIAL_FRAME',frame,'/',COUNT,flush=True)
