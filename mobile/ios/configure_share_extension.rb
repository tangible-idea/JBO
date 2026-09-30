require 'xcodeproj'

project_path = File.expand_path('Runner.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)
unless project.targets.any? { |target| target.name == 'ShareExtension' }
  runner = project.targets.find { |target| target.name == 'Runner' }
  extension = project.new_target(:app_extension, 'ShareExtension', :ios, '13.0')
  group = project.main_group.new_group('ShareExtension', 'ShareExtension')
  source = group.new_file('ShareViewController.swift')
  group.new_file('Info.plist')
  group.new_file('ShareExtension.entitlements')
  extension.source_build_phase.add_file_reference(source)
  extension.build_configurations.each do |config|
    settings = config.build_settings
    settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'net.tangibleidea.mobile.ShareExtension'
    settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
    settings['INFOPLIST_FILE'] = 'ShareExtension/Info.plist'
    settings['CODE_SIGN_ENTITLEMENTS'] = 'ShareExtension/ShareExtension.entitlements'
    settings['SWIFT_VERSION'] = '5.0'
    settings['TARGETED_DEVICE_FAMILY'] = '1,2'
    settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
    settings['SKIP_INSTALL'] = 'YES'
    settings['CODE_SIGN_STYLE'] = 'Automatic'
    settings['DEVELOPMENT_TEAM'] = runner.build_configurations.first.build_settings['DEVELOPMENT_TEAM']
    settings['FLUTTER_BUILD_NAME'] = '1.0.0'
    settings['FLUTTER_BUILD_NUMBER'] = '1'
  end
  runner.build_configurations.each do |config|
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'Runner/Runner.entitlements'
  end
  phase = runner.new_copy_files_build_phase('Embed Foundation Extensions')
  phase.dst_subfolder_spec = '13'
  phase.add_file_reference(extension.product_reference, true)
  runner.add_dependency(extension)
  # CocoaPods makes the plugin module available to the extension during compilation.
  project.save
end
extension = project.targets.find { |target| target.name == 'ShareExtension' }
extension.build_configurations.each { |config| config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)' }
runner = project.targets.find { |target| target.name == 'Runner' }
embed = runner.build_phases.find { |phase| phase.display_name == 'Embed Foundation Extensions' }
thin = runner.build_phases.find { |phase| phase.display_name == 'Thin Binary' }
if embed && thin
  runner.build_phases.delete(embed)
  runner.build_phases.insert(runner.build_phases.index(thin), embed)
end
project.save
