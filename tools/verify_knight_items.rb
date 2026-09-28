module RPG;class Item;end;class AudioFile;end;end
p=Dir.glob('player/gameasync/Data/*Items.rxdata').max_by{|x|File.size(x)}
a=Marshal.load(File.binread(p))
abort 'courage item CE wrong' unless a[3].instance_variable_get(:@common_event_id)==8
abort 'transform item CE wrong' unless a[17].instance_variable_get(:@common_event_id)==6
puts 'ITEM_VERIFY_OK'
