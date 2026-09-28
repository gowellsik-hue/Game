a=Marshal.load(File.binread(ARGV[0]))
names=a.select{|e|e.is_a?(Array)&&e.length>=3}.map{|e|e[1].to_s}
abort 'Fairy mobile assist missing' unless names.include?('Mobile Diablo Assist')
abort 'Fairy web resolution missing' unless names.include?('Web Resolution 800x600')
puts 'FAIRY_SCRIPT_VERIFY_OK'
