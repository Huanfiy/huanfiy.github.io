source "https://rubygems.org"

# Jekyll核心
gem "jekyll", "~> 4.3"

# Jekyll插件
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.15"
  gem "jekyll-sitemap", "~> 1.4"
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-paginate", "~> 1.1"
  # gem "jekyll-archives"           # 可选：归档页面
  # gem "jekyll-redirect-from"      # 可选：URL重定向
  # gem "jekyll-compose"            # 可选：命令行创建文章
end

# 性能和功能增强
gem "sassc", "~> 2.4"              # Sass编译器
gem "image_optim", "~> 0.31"       # 图片优化
gem "html-proofer", "~> 3.19"      # HTML验证

# 开发工具
group :development do
  gem "webrick", "~> 1.7"          # 开发服务器
end

# Windows和JRuby支持
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Windows性能优化
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# JRuby支持
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby] 