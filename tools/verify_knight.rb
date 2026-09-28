# encoding: UTF-8
a=Marshal.load(File.binread(ARGV[0]))
def s(a,n)
  e=a.find{|x|x.is_a?(Array)&&x.length>=3&&x[1].to_s==n}
  abort("missing #{n}") unless e
  Zlib::Inflate.inflate(e[2]).force_encoding(Encoding::UTF_8)
end

eq=s(a,'Scene_Equip')
abort 'equip still blocking' if eq.match?(/loop do.*?Graphics\.update.*?Input\.update.*?update/m)
abort 'equip unlock missing' unless eq.include?('$game_switches[49] = false')

mp=s(a,'Scene_Map')
abort 'map input reset missing' unless mp.include?('$game_switches[49] = false')
abort 'gated map Input.update remains' if mp.match?(/if \$game_switches\[49\] == false.*?Input\.update/m)

sv=s(a,'Scene_Save')
abort 'save persist missing' unless sv.include?('save_file_async(filename)')&&sv.include?('file.close')
abort 'save unlock missing' unless sv.include?('SLSAVE_UNLOCK')
abort 'save still returns menu' if sv.include?('Scene_Menu.new(4)')

mob=s(a,'Mobile Diablo Assist')
abort 'auto attack missing' unless mob.include?('sl_mobile_enemy_event?')
abort 'quick config missing' unless mob.include?('Scene_MobileQuick')
abort 'quick F5 missing' unless mob.include?('Input::F5')
abort 'quick F9 missing' unless mob.include?('Input::F9')

all=a.map{|e|begin Zlib::Inflate.inflate(e[2]).force_encoding(Encoding::UTF_8) rescue '' end}.join("\n")
abort 'branding remains' if all.downcase.include?('ihsoft')||all.include?('oilhwan')||all.include?('일환소프트')||all.downcase.include?('single lineage')||all.downcase.include?('duenter@hanmail.net')
abort 'XRXS wrapper remains' if all.include?('XRXS_MP7_Module')

puts 'SCRIPT_V145_VERIFY_OK'
