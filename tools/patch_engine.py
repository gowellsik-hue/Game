from pathlib import Path
def repl(path, old, new, count=1):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n!=count: raise SystemExit(f'{path}: expected {count} copies, found {n}: {old!r}')
    p.write_text(s.replace(old,new,count))
repl('engine/src/config.cpp','fixedFramerate = 40;','fixedFramerate = 0;')
repl('engine/src/config.cpp','defScreenW = 640;','defScreenW = 800;')
repl('engine/src/config.cpp','defScreenH = 480;','defScreenH = 600;')
repl('engine/src/config.cpp','frameSkip = true;','frameSkip = false;')
repl('engine/src/config.cpp','PO_DESC(smoothScaling, bool, true)','PO_DESC(smoothScaling, bool, false)')
repl('engine/src/graphics.cpp','width = clamp(width, 1, 640);\n\theight = clamp(height, 1, 480);','width = clamp(width, 1, 800);\n\theight = clamp(height, 1, 600);')
p=Path('engine/binding-mruby/graphics-binding.cpp'); s=p.read_text()
marker='''MRB_FUNCTION(graphicsFrameReset)\n{\n\tMRB_FUN_UNUSED_PARAM;\n\n\tshState->graphics().frameReset();\n\n\treturn mrb_nil_value();\n}\n'''
add=marker+'''\nMRB_FUNCTION(graphicsResizeScreen)\n{\n\tMRB_FUN_UNUSED_PARAM;\n\tmrb_int width, height;\n\tmrb_get_args(mrb, "ii", &width, &height);\n\tGUARD_EXC( shState->graphics().resizeScreen(width, height); )\n\treturn mrb_nil_value();\n}\n'''
if s.count(marker)!=1: raise SystemExit('graphicsFrameReset marker mismatch')
s=s.replace(marker,add,1)
reg='\tmrb_define_module_function(mrb, module, "frame_reset", graphicsFrameReset, MRB_ARGS_NONE());'
if s.count(reg)!=1: raise SystemExit('frame_reset registration mismatch')
s=s.replace(reg,reg+'\n\tmrb_define_module_function(mrb, module, "resize_screen", graphicsResizeScreen, MRB_ARGS_REQ(2));',1)
p.write_text(s)
repl('engine/binding-mruby/binding-mruby.cpp','\tif (jsSkipFrame() == 1) return;','\t/* V14: Graphics.frame_rate is the only frame limiter. */')
repl('engine/build.sh','./emsdk install latest','./emsdk install 3.1.37')
repl('engine/build.sh','./emsdk activate latest','./emsdk activate 3.1.37')
p=Path('engine/extra/build_config.rb'); s=p.read_text()
gem="    conf.gem :github => 'pulsejet/mruby-marshal'"
pin="    conf.gem :github => 'mattn/mruby-onig-regexp', :checksum_hash => '25b152264cd4dfac84aa39e5fbb428ec84b95e6a'\n"+gem
if s.count(gem)!=1: raise SystemExit('mruby-marshal build_config marker mismatch')
p.write_text(s.replace(gem,pin,1))
print('ENGINE_PATCH_OK')
