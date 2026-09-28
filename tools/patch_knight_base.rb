# encoding: UTF-8
game=ARGV[0]; ini_path=File.join(game,'Game.ini'); ini=File.binread(ini_path)
rel=ini[/^Scripts=(.+)$/i,1].to_s.strip.tr('\\','/'); abort 'Scripts entry missing' if rel.empty?
source_path=File.join(game,rel); scripts=Marshal.load(File.binread(source_path))
compat=<<'RUBY'
$joiplay=true
module Kernel
  def exit(*args); nil; end
end
class Win32API
  def initialize(*args); @func=args[1].to_s; end
  def web_input(key)
    case key.to_i
    when 9,90 then Input::A
    when 13,32,67 then Input::C
    when 27,88 then Input::B
    when 68 then Input::Z
    when 81 then Input::L
    when 83 then Input::Y
    when 87 then Input::R
    when 65 then Input::X
    when 16 then Input::SHIFT
    when 17 then Input::CTRL
    when 18 then Input::ALT
    else nil
    end
  end
  def call(*args)
    code=web_input(args[0])
    return(code && Input.trigger?(code) ? 1 : 0) if @func=='GetAsyncKeyState'
    return(code && Input.press?(code) ? -1 : 0) if @func=='GetKeyState'
    0
  end
  def Call(*args); call(*args); end
end
Font.default_name='NanumGothic'
module Audio
  def self.sl_stream(kind,*parts); puts((['SLAUDIO',kind]+parts.collect{|v|v.to_s}).join('|')); end
  def self.bgm_play(filename,volume=100,pitch=100); sl_stream('BGM_PLAY',filename,volume,pitch); end
  def self.bgm_stop; sl_stream('BGM_STOP'); end
  def self.bgm_fade(time); sl_stream('BGM_FADE',time); end
  def self.bgs_play(filename,volume=100,pitch=100); sl_stream('BGS_PLAY',filename,volume,pitch); end
  def self.bgs_stop; sl_stream('BGS_STOP'); end
  def self.bgs_fade(time); sl_stream('BGS_FADE',time); end
end
RUBY
scripts.insert(0,[0,'Web Compatibility',Zlib::Deflate.deflate(compat)])
def patch_begin_until(src)
  lines=src.lines
  lines.each_index do |i|
    m=lines[i].match(/^(\s*)end\s+until\s+(.+?)\s*$/); next unless m
    indent,cond=m[1],m[2]; j=i-1
    while j>=0
      if lines[j][/^\s*/]==indent && lines[j].strip=='begin'; lines[j]=indent+"loop do\n"; lines[i]=indent+"  break if #{cond}\n#{indent}end\n"; break; end
      j-=1
    end
  end
  lines.join
end
def patch_scene_loop(src)
  lines=src.lines; i=0
  while i<lines.length
    unless lines[i].strip=='loop do'; i+=1; next; end
    indent=lines[i][/^\s*/]; sig=[]; k=i+1
    while k<lines.length && sig.length<8
      s=lines[k].strip; sig<<[k,s,lines[k][/^\s*/]] unless s.empty?||s.start_with?('#'); k+=1
    end
    finish=nil
    finish=sig[6][0] if sig.length>=7&&sig[0][1]=='Graphics.update'&&sig[1][1]=='Input.update'&&sig[2][1]=='update'&&sig[3][1]=='if $scene != self'&&sig[4][1]=='break'&&sig[5][1]=='end'&&sig[6][1]=='end'&&sig[6][2]==indent
    finish=sig[4][0] if finish.nil?&&sig.length>=5&&sig[0][1]=='Graphics.update'&&sig[1][1]=='Input.update'&&sig[2][1]=='update'&&sig[3][1]=='break if $scene != self'&&sig[4][1]=='end'&&sig[4][2]==indent
    lines[i..finish]=[indent+"end\n\n"+indent+"def dispose\n"] if finish; i+=1
  end
  lines.join
end
id_sprite=<<'RUBY'
class Game_Character; attr_accessor :sprite_id; end
class Sprite_Character
  alias sl_id_original_update update
  def create_id_sprite(text)
    bitmap=Bitmap.new(160,16); bitmap.font.name='NanumGothic'; bitmap.font.size=12; bitmap.font.bold=false
    bitmap.font.color.set(0,0,0); bitmap.draw_text(0,-1,160,16,text,1); bitmap.draw_text(0,1,160,16,text,1); bitmap.draw_text(-1,0,160,16,text,1); bitmap.draw_text(1,0,160,16,text,1)
    bitmap.font.color.set(255,255,255); bitmap.draw_text(0,0,160,16,text,1)
    @_id_sprite=Sprite.new(self.viewport); @_id_sprite.bitmap=bitmap; @_id_sprite.opacity=255; @_id_sprite.ox=80; @_id_sprite.oy=14; @_id_sprite.x=self.x; @_id_sprite.y=self.y-self.oy/2; @_id_sprite.z=9999; @_id_sprite_visible=true
  end
  def dispose_id_sprite; if @_id_sprite!=nil; @_id_sprite.bitmap.dispose if @_id_sprite.bitmap!=nil&&!@_id_sprite.bitmap.disposed?; @_id_sprite.dispose; @_id_sprite=nil; end; @_id_sprite_visible=false; end
  def update_id_sprite; if @character.sprite_id!=nil&&@character.sprite_id.to_s!=''; create_id_sprite(@character.sprite_id) unless @_id_sprite_visible; @_id_sprite.x=self.x; @_id_sprite.y=self.y-self.oy; elsif @_id_sprite_visible; dispose_id_sprite; end; end
  def update; sl_id_original_update; update_id_sprite; end
end
RUBY
id_output=<<'RUBY'
class Game_Event
  alias sl_id_original_event_refresh refresh
  def refresh; sl_id_original_event_refresh; text=@event.name.dup; text.gsub!(/\[[Ii][Dd](.+?)\]/){@sprite_id=$1}; @sprite_id=nil if @erased||@character_name==''; end
end
class Game_Player
  alias sl_id_original_player_refresh refresh
  def refresh; sl_id_original_player_refresh; @sprite_id=nil if $game_party.actors.size>0; end
end
RUBY
browser_loop=<<'RUBY'
$prev_scene=nil
$sl_last_scene_name=nil
def main_update_loop
  begin
    if $scene!=nil
      active_scene=$scene; name=active_scene.class.to_s; puts('SLFRAME|'+name) if $sl_last_scene_name!=name; $sl_last_scene_name=name
      if active_scene!=$prev_scene; $prev_scene.dispose if $prev_scene!=nil&&$prev_scene.respond_to?(:dispose); active_scene.main; $prev_scene=active_scene; return if $scene!=active_scene; end
      Graphics.update; Input.update; active_scene.update if $scene==active_scene
    end
  rescue Exception=>e
    puts('SLRUNTIMEERR|'+e.class.to_s+'|'+e.message.to_s); e.backtrace[0,16].each{|line|puts('SLRUNTIMEBT|'+line.to_s)} if e.respond_to?(:backtrace)&&e.backtrace
  end
end
RUBY
plane=ids=fonts=0
font_rules=[[/((?:Font\.default_name)\s*=\s*)\[\s*["'][^"']*["']\s*\]/n,'\1"NanumGothic"'],[/(Font\.default_name\s*=\s*)["'][^"']*["']/n,'\1"NanumGothic"'],[/(\.font\.name\s*=\s*)["'][^"']*["']/n,'\1"NanumGothic"'],[/(\bFONT_NAME\s*=\s*)["'][^"']*["']/n,'\1"NanumGothic"']]
scripts.each_with_index do |entry,index|
  next unless entry.is_a?(Array)&&entry.length>=3; name=entry[1].to_s
  begin; text=Zlib::Inflate.inflate(entry[2]); rescue; next; end
  font_rules.each{|rx,rep|fonts+=text.scan(rx).length;text.gsub!(rx,rep)}
  text.gsub!('defined?($joiplay) && $joiplay','$joiplay == true')
  if index==111; text=id_sprite; ids+=1
  elsif index==112; text=id_output; ids+=1
  elsif text.match?(/^\s*class\s+Plane\s*<\s*Sprite\b/n); text="# native Plane used on web\n"; plane+=1; end
  text=patch_begin_until(text); text=patch_scene_loop(text) unless name=='Main'||name=='Scene_Map'
  if name=='Main'; text=browser_loop+text unless text.include?('def main_update_loop'); text.sub!(/\n\s*while\s+\$scene\s*!=\s*nil\s*\r?\n\s*\$scene\.main\s*\r?\n\s*end\s*/m,"\n"); end
  entry[2]=Zlib::Deflate.deflate(text)
end
abort "Plane patch=#{plane}" unless plane==1; abort "ID patch=#{ids}" unless ids==2; abort "font patch=#{fonts}" unless fonts>=10
def entry_for(scripts,name); e=scripts.find{|x|x.is_a?(Array)&&x.length>=3&&x[1].to_s==name}; abort "missing #{name}" unless e; e; end
def inflate(e); Zlib::Inflate.inflate(e[2]).force_encoding(Encoding::UTF_8); end
def deflate(e,s); e[2]=Zlib::Deflate.deflate(s); end
resolution=scripts[97]; rt=inflate(resolution); abort 'resolution script mismatch' unless rt.include?('$WINDOW_WIDTH = 800')&&rt.include?('Graphics.resize_screen'); abort 'resolution defined? remains' if rt.include?('defined?($joiplay)'); deflate(resolution,rt)
equip=entry_for(scripts,'Scene_Equip'); text=inflate(equip); eqrx=/    loop do\r?\n.*?^    end\r?\n(?=    #[^\n]*\r?\n    Graphics\.freeze)/m; abort 'Scene_Equip loop patch mismatch' unless text.scan(eqrx).size==1; text.sub!(eqrx,"  end\n  def dispose\n    $game_switches[49] = true\n"); deflate(equip,text)
save=entry_for(scripts,'Scene_Save'); text=inflate(save); n=0; text=text.sub(/    write_save_data\(file\)\r?\n    exit/){n+=1;"    write_save_data(file)\n    file.close\n    save_file_async(filename)"}; abort "Scene_Save persist patch=#{n}" unless n==1; deflate(save,text)
menu_fx=scripts.find{|e|e.is_a?(Array)&&e.length>=3&&((inflate(e).include?('XRXS_MP7_Module')) rescue false)}; abort 'menu lifecycle script missing' unless menu_fx
text=inflate(menu_fx); ds=/  def dispose_spriteset\r?\n.*?    @spriteset\.dispose\r?\n  end/m; abort 'dispose_spriteset mismatch' unless text.scan(ds).size==1; text.sub!(ds,"  def dispose_spriteset\n    if @spriteset != nil\n      @spriteset.dispose\n      @spriteset = nil\n    end\n  end")
wr=/  alias xrxs_mp7_main main\r?\n  def main\r?\n    create_spriteset\r?\n    xrxs_mp7_main\r?\n    dispose_spriteset\r?\n  end/; abort 'menu wrapper mismatch' unless text.scan(wr).size==8; text.gsub!(wr,"  alias xrxs_mp7_main main\n  def main\n    create_spriteset\n    xrxs_mp7_main\n  end\n  alias xrxs_mp7_dispose dispose\n  def dispose\n    xrxs_mp7_dispose\n    dispose_spriteset\n  end"); deflate(menu_fx,text)
multi=entry_for(scripts,'Multi-slot script : Windows'); text=inflate(multi); old_ms=/ alias g7_ms_scene_equip_main main\r?\n def main\r?\n  @additional_initialize_done = false\r?\n  g7_ms_scene_equip_main\r?\n  for i in 5\.\.\.@item_windows\.size\r?\n   @item_windows\[i\]\.dispose unless @item_windows\[i\]\.nil\?\r?\n  end\r?\n end/; abort 'multislot lifecycle mismatch' unless text.scan(old_ms).size==1; text.sub!(old_ms," alias g7_ms_scene_equip_main main\n def main\n  @additional_initialize_done = false\n  g7_ms_scene_equip_main\n end\n alias g7_ms_scene_equip_dispose dispose\n def dispose\n  if @item_windows != nil\n   for i in 5...@item_windows.size\n    @item_windows[i].dispose unless @item_windows[i].nil?\n   end\n  end\n  g7_ms_scene_equip_dispose\n end"); text.gsub!('if defined? xrxs_additional_refresh','if respond_to?(:xrxs_additional_refresh)'); deflate(multi,text)
mog=scripts.find{|e|e.is_a?(Array)&&e.length>=3&&((inflate(e).include?('alias shud_main main')) rescue false)}; abort 'MOG HUD missing' unless mog; text=inflate(mog); text.gsub!('Viewport.new(0, 0, 640, 480)','Viewport.new(0, 0, $WINDOW_WIDTH, $WINDOW_HEIGHT)'); deflate(mog,text)
title=entry_for(scripts,'Scene_Title'); text=inflate(title); menu_rx=/    s1 = "새로하기"\r?\n    s2 = "이어하기"\r?\n    s3 = "홈페이지"\r?\n    s4 = "종료하기"\r?\n    s5 = "만든사람"\r?\n    @command_window = Window_Command.new\(90, \[s1, s2, s3, s4, s5\]\)/; abort 'title menu cleanup mismatch' unless text.scan(menu_rx).size==1; text.sub!(menu_rx,"    s1 = \"새로하기\"\n    s2 = \"이어하기\"\n    s3 = \"종료하기\"\n    @command_window = Window_Command.new(90, [s1, s2, s3])"); case_rx=/      when 2[^\n]*\r?\n        OpenBrowser\([^\n]*\)\r?\n      when 3[^\n]*\r?\n        command_shutdown\r?\n      when 4[^\n]*\r?\n        command_made/; abort 'title command cleanup mismatch' unless text.scan(case_rx).size==1; text.sub!(case_rx,"      when 2\n        command_shutdown"); text.sub!(/  def command_made\r?\n.*?^  end\r?\n/m,''); text.sub!(/  def OpenBrowser\(url\)\r?\n.*?^  end\r?\n/m,''); deflate(title,text)
savewin=entry_for(scripts,'Window_SaveFile'); text=inflate(savewin); text.gsub!('일환소프트 싱글리니지','SLKnight'); deflate(savewin,text)
scripts.each{|e|next unless e.is_a?(Array)&&e.length>=3;begin;t=inflate(e);rescue;next;end;bad=t.downcase.include?('ihsoft')||t.include?('oilhwan')||t.include?('일환소프트')||t.downcase.include?('single lineage')||t.downcase.include?('duenter@hanmail.net');next unless bad;t=t.lines.reject{|ln|d=ln.downcase;d.include?('ihsoft')||ln.include?('oilhwan')||ln.include?('일환소프트')||d.include?('single lineage')||d.include?('duenter@hanmail.net')}.join;deflate(e,t)}
main=entry_for(scripts,'Main'); abort 'defined? regression in Main' if inflate(main).include?('defined?')
target=File.join(game,'Data','Scripts.rxdata'); File.binwrite(target,Marshal.dump(scripts)); File.delete(source_path) if File.expand_path(source_path)!=File.expand_path(target)
lines=ini.split(/\r?\n/).map{|line|line=~/^Scripts=/i ? 'Scripts=Data\\Scripts.rxdata' : line=~/^Title=/i ? 'Title=SLKnight' : line}; File.binwrite(ini_path,lines.join("\r\n")+"\r\n")
class RawMarshalObject
  def self._load(data); o=allocate; o.instance_variable_set(:@raw,data); o; end
  def _dump(_depth); @raw; end
end
class Tone<RawMarshalObject;end; class Color<RawMarshalObject;end; class Rect<RawMarshalObject;end; class Table<RawMarshalObject;end
module RPG
  class AudioFile;end; class Map;end; class Event;class Page;class Condition;end;class Graphic;end;end;end; class EventCommand;end; class MoveRoute;end; class MoveCommand;end
end
def iv(o,n); o.instance_variable_get("@#{n}"); end
def setiv(o,n,v); o.instance_variable_set("@#{n}",v); end
map_path=Dir.glob(File.join(game,'Data','*Map029.rxdata')).max_by{|p|File.size(p)}; abort 'Map029 missing' unless map_path&&File.size(map_path)>1000
map=Marshal.load(File.binread(map_path)); smith=(iv(map,:events)||{})[30]; abort 'blacksmith missing' unless smith; patched=0
(iv(smith,:pages)||[]).each do |page|
  route=iv(page,:move_route); next unless route
  (iv(route,:list)||[]).each do |cmd|
    next unless iv(cmd,:code)==44; audio=(iv(cmd,:parameters)||[])[0]; next unless audio
    an=iv(audio,:name).to_s.dup.force_encoding(Encoding::UTF_8); next unless an=='대장간 소리'||an=='대장간 소리2'
    vol,pitch=iv(audio,:volume).to_i,iv(audio,:pitch).to_i; code="dx=($game_player.x-@x).abs;dy=($game_player.y-@y).abs;d=[dx,dy].max;if d<=8;v=[#{vol}-d*3,6].max;$game_system.se_play(RPG::AudioFile.new(#{an.dump},v,#{pitch}));end"
    setiv(cmd,:code,45); setiv(cmd,:parameters,[code]); patched+=1
  end
end
abort "blacksmith patch=#{patched}" unless patched==4; File.binwrite(map_path,Marshal.dump(map))
puts 'SCRIPT_AND_MAP_PATCH_OK'
