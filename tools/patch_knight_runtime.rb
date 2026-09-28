# encoding: UTF-8
require 'zlib'
root = ARGV.fetch(0)
path = File.join(root, 'gameasync', 'Data', 'Scripts.rxdata')
scripts = Marshal.load(File.binread(path))

def entry_for(scripts, name)
  e = scripts.find { |x| x.is_a?(Array) && x.length >= 3 && x[1].to_s == name }
  abort "missing script #{name}" unless e
  e
end

def src(e)
  Zlib::Inflate.inflate(e[2]).force_encoding(Encoding::UTF_8)
end

def put(e, s)
  e[2] = Zlib::Deflate.deflate(s)
end

# Map: always clear the old input-lock switch. This also recovers existing saves that stored switch 49=true.
map = entry_for(scripts, 'Scene_Map')
text = src(map)
n=0
text=text.sub(/  def main\r?\n/){n+=1;"  def main\n    $game_switches[49] = false\n"}
abort "Scene_Map main patch=#{n}" unless n==1
rx=/     if \$game_switches\[49\] == false\r?\n     Input\.update\s*\r?\n     end\r?\n/
abort 'Scene_Map gated Input.update missing' unless text.match?(rx)
text.sub!(rx,"     Input.update\n")
# Mobile buttons use normal RGSS inputs directly. This avoids colliding with the original F/5/6/7/8 Keyboard shortcuts.
text.gsub!('if Keyboard.testkey(9) &&', 'if (Keyboard.testkey(9) || Input.trigger?(Input::Y)) &&')
text.gsub!('&& Keyboard.testkey(69) &&', '&& (Keyboard.testkey(69) || Input.trigger?(Input::X)) &&')
put(map, text)

# Equip: disposing the equipment screen must unlock input, not lock it.
equip = entry_for(scripts, 'Scene_Equip')
text = src(equip)
abort 'equip lock marker missing' unless text.include?('$game_switches[49] = true')
text.sub!('$game_switches[49] = true', '$game_switches[49] = false')
put(equip, text)

# Save: explicitly clear the stale input lock on save/cancel return paths.
save = entry_for(scripts, 'Scene_Save')
text = src(save)
unless text.include?('SLSAVE_UNLOCK')
  text.sub!('    save_file_async(filename)', "    save_file_async(filename)\n    $game_switches[49] = false\n    puts('SLSAVE_UNLOCK')") or abort 'save async marker missing'
  n=0
  text=text.sub(/  def on_cancel\r?\n/){n+=1;"  def on_cancel\n    $game_switches[49] = false\n"}
  abort "save cancel patch=#{n}" unless n==1
end
# V14.4b already returns to Scene_Map; only replace the legacy menu target when it is still present.
text.gsub!('$scene = Scene_Menu.new(4)', '$scene = Scene_Map.new')
put(save, text)

# Disable the old XRXS menu transparency wrapper on web. It owns a second spriteset
# lifecycle and can deadlock the browser-driven scene loop.
menu_fx = scripts.find do |e|
  next false unless e.is_a?(Array) && e.length >= 3
  begin
    src(e).include?('XRXS_MP7_Module')
  rescue
    false
  end
end
put(menu_fx, "# web: XRXS menu transparency disabled\n") if menu_fx

# Mobile auto attack + actual inventory-item quick slots.
assist = <<'RUBY'
# SLKnight V14.5 mobile runtime additions.
$mobile_auto_attack_active = false
$mobile_auto_attack_event_id = 0
$mobile_auto_attack_cooldown = 0

class Game_Event
  def sl_mobile_enemy_event?
    event_data = instance_variable_get(:@event)
    page_data = instance_variable_get(:@page)
    erased = instance_variable_get(:@erased)
    return false if event_data == nil || page_data == nil || erased
    name = event_data.instance_variable_get(:@name).to_s
    return false unless name[0,3] == "[ID"
    return false if self.through
    return false unless self.trigger == 2
    true
  end
end

class Interpreter
  alias sl_mobile_original_command_111 command_111
  def command_111
    if $mobile_auto_attack_active &&
       @event_id == $mobile_auto_attack_event_id &&
       @parameters[0] == 11 && @parameters[1] == 13
      $mobile_auto_attack_active = false
      @branch[@list[@index].indent] = true
      @branch.delete(@list[@index].indent)
      return true
    end
    sl_mobile_original_command_111
  end
end

class Game_System
  def sl_quick_items
    @sl_quick_items = [114, 3, 17, 2] if @sl_quick_items == nil
    @sl_quick_items
  end
  def sl_quick_items=(v)
    @sl_quick_items = v
  end
end

module SLMobileQuick
  def self.emit_labels
    ids=$game_system.sl_quick_items
    ids.each_with_index do |id,i|
      item=(id.to_i>0 && $data_items) ? $data_items[id.to_i] : nil
      name=item ? item.name.to_s.gsub('|','/') : '비어있음'
      puts('SLQS|'+(i+1).to_s+'|'+name)
    end
  end

  def self.use(slot)
    return if $game_party == nil || $game_system == nil
    ids = $game_system.sl_quick_items
    id = ids[slot].to_i
    item = (id > 0 && $data_items) ? $data_items[id] : nil
    unless item && item.is_a?(RPG::Item) && $game_party.item_number(id) > 0
      $game_system.se_play($data_system.buzzer_se) if $data_system
      return
    end

    # The original game treats item 114 (Ent stem) as the healing hotkey.
    if id == 114
      if $game_switches[367] == true && $game_party.item_number(114) >= 1
        $game_party.lose_item(114, 1)
        $game_temp.common_event_id = 2
        if $game_switches[1081] == true && defined?($p) && $p
          $p.drawPHP($game_party.actors[0].hp, $game_party.actors[0].maxhp,
                     $game_party.actors[0].sp, $game_party.actors[0].maxsp)
        end
        $KeyIcon.ShowIcon if defined?($KeyIcon) && $KeyIcon
      else
        $game_system.se_play($data_system.buzzer_se)
      end
      return
    end

    unless $game_party.item_can_use?(id)
      $game_system.se_play($data_system.buzzer_se)
      return
    end

    used = false
    if item.scope >= 3
      if item.scope == 4 || item.scope == 6
        for actor in $game_party.actors
          used |= actor.item_effect(item)
        end
      else
        actor = $game_party.actors[0]
        used = actor ? actor.item_effect(item) : false
      end
    elsif item.common_event_id > 0
      used = true
    end

    if used
      $game_system.se_play(item.menu_se)
      $game_party.lose_item(id, 1) if item.consumable
      $game_temp.common_event_id = item.common_event_id if item.common_event_id > 0
      $KeyIcon.ShowIcon if defined?($KeyIcon) && $KeyIcon
      Guage.show if defined?(Guage)
    else
      $game_system.se_play($data_system.buzzer_se)
    end
  end
end

class Scene_MobileQuick
  def initialize(slot_index = 0)
    @slot_index = slot_index
  end

  def main
    @help_window = Window_Help.new
    @help_window.set_text("빠른슬롯을 선택한 뒤 소지 아이템을 지정하세요.")
    build_slot_window
    @item_window = Window_Item.new
    @item_window.help_window = @help_window
    @item_window.active = false
    @item_window.visible = false
    Graphics.transition
  end

  def build_slot_window
    old_index = @slot_window ? @slot_window.index : @slot_index
    @slot_window.dispose if @slot_window
    names = []
    $game_system.sl_quick_items.each_with_index do |id, i|
      item = (id.to_i > 0 && $data_items) ? $data_items[id.to_i] : nil
      label = item ? item.name.to_s : "비어 있음"
      names << "#{i+1}. #{label}"
    end
    @slot_window = Window_Command.new(300, names)
    @slot_window.x = 0
    @slot_window.y = 64
    @slot_window.index = [[old_index, 0].max, 3].min
  end

  def dispose
    Graphics.freeze
    @help_window.dispose if @help_window
    @slot_window.dispose if @slot_window
    @item_window.dispose if @item_window
  end

  def update
    @help_window.update
    @slot_window.update
    @item_window.update
    if @slot_window.active
      if Input.trigger?(Input::B)
        $game_system.se_play($data_system.cancel_se)
        $scene = Scene_Map.new
        return
      end
      if Input.trigger?(Input::C)
        $game_system.se_play($data_system.decision_se)
        @slot_index = @slot_window.index
        @slot_window.active = false
        @item_window.visible = true
        @item_window.active = true
        @item_window.index = 0
        @help_window.set_text("이 슬롯에 넣을 소지 아이템을 선택하세요.")
        return
      end
    else
      if Input.trigger?(Input::B)
        $game_system.se_play($data_system.cancel_se)
        @item_window.active = false
        @item_window.visible = false
        @slot_window.active = true
        @help_window.set_text("빠른슬롯을 선택한 뒤 소지 아이템을 지정하세요.")
        return
      end
      if Input.trigger?(Input::C)
        item = @item_window.item
        unless item && item.is_a?(RPG::Item)
          $game_system.se_play($data_system.buzzer_se)
          return
        end
        $game_system.sl_quick_items[@slot_index] = item.id
        $game_system.se_play($data_system.decision_se)
        @item_window.active = false
        @item_window.visible = false
        build_slot_window
        @slot_window.active = true
        @help_window.set_text("지정 완료. 다른 슬롯도 설정할 수 있습니다.")
        return
      end
    end
  end
end

class Game_Player
  alias sl_mobile_original_update update
  def update
    sl_mobile_original_update
    $mobile_auto_attack_cooldown -= 1 if $mobile_auto_attack_cooldown > 0
    $mobile_auto_attack_active = false if $mobile_auto_attack_active && $mobile_auto_attack_cooldown <= 8
    return if moving? || @move_route_forcing
    return if $game_temp.message_window_showing
    return if $game_system.map_interpreter.running?
    return if $game_switches[743]
    return if $mobile_auto_attack_cooldown > 0
    target = nil
    for event in $game_map.events.values
      next unless event.sl_mobile_enemy_event?
      dx = event.x - self.x
      dy = event.y - self.y
      if dx.abs + dy.abs == 1
        target = event
        break
      end
    end
    return if target == nil
    dx = target.x - self.x
    dy = target.y - self.y
    dx > 0 ? turn_right : dx < 0 ? turn_left : dy > 0 ? turn_down : turn_up
    target.turn_toward_player
    $mobile_auto_attack_event_id = target.id
    $mobile_auto_attack_active = true
    $mobile_auto_attack_cooldown = 20
    target.start
  end
end

# F5 opens quick-slot configuration; F6-F9 use slots 1-4.
class Scene_Map
  alias sl_mobile_quick_main main
  def main
    SLMobileQuick.emit_labels
    sl_mobile_quick_main
  end
  alias sl_mobile_quick_update update
  def update
    if Input.trigger?(Input::F5)
      $scene = Scene_MobileQuick.new
      return
    end
    if Input.trigger?(Input::F6); SLMobileQuick.use(0); end
    if Input.trigger?(Input::F7); SLMobileQuick.use(1); end
    if Input.trigger?(Input::F8); SLMobileQuick.use(2); end
    if Input.trigger?(Input::F9); SLMobileQuick.use(3); end
    sl_mobile_quick_update
  end
end
RUBY

# Remove an older injected copy if present, then insert immediately before Main.
scripts.reject! { |e| e.is_a?(Array) && e[1].to_s == 'Mobile Diablo Assist' }
main_index = scripts.index { |e| e.is_a?(Array) && e[1].to_s == 'Main' }
abort 'Main script missing for mobile assist' unless main_index
scripts.insert(main_index, [99999991, 'Mobile Diablo Assist', Zlib::Deflate.deflate(assist)])

File.binwrite(path, Marshal.dump(scripts))
puts 'V145_GAME_PATCH_OK'
