module RPG; class Item;end; class AudioFile;end; end
path=Dir.glob('player/gameasync/Data/*Items.rxdata').max_by{|p|File.size(p)}; abort 'Items data missing' unless path&&File.size(path)>1000
items=Marshal.load(File.binread(path)); abort 'item 3 missing' unless items[3]; abort 'item 17 missing' unless items[17]
items[3].instance_variable_set(:@common_event_id,8)
abort 'transform common event changed' unless items[17].instance_variable_get(:@common_event_id)==6
File.binwrite(path,Marshal.dump(items)); puts 'ITEM_USE_PATCH_OK'
