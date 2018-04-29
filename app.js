const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const compression = require('compression');
const log4js = require('log4js');
const csrf = require('csurf');
// const auth = require('./config/auth.js');
const config = require('./config/config_web');
const mountRoute = require('./routes_mount.js');

const app = express();
const router = express.Router();

// 设置模板引擎为html
app.set('views', path.resolve(__dirname, './dist'));
app.set('view engine', 'html');
app.engine('html', require('ejs-mate'));

// 启用模板缓存。
app.set('view cache', true);

// 使用bodyParser中间件
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 使用cookie中间件
app.use(require('cookie-parser')(config.cookieSecret));

// 使用session中间件
app.use(session({
  name: config.sessionName,
  secret: config.sessionSecret,
  cookie: { maxAge: 1000 * 60 * 60 },
  rolling: true,
  resave: true,
  saveUninitialized: false,
}));

// Gzip压缩功能(效率优化)
app.use(compression());

// 配置禁止跨域防止CSRF攻击
app.use((req, res, next) => {
  if (!config.isCsrf) {
    next();
    return;
  }
  // 过滤无需跨域验证的地址列表(即不创建也不验证csrfToken),
  // 因为get请求常用于获取csrfToken(默认不验证get请求)，ignoreCsrfs慎用get请求类型
  if (!config.ignoreCsrfs.includes(req.path)) {
    csrf({ cookie: true })(req, res, next);
    return;
  }
  next();
});

// 设置csrfToken
app.use((req, res, next) => {
  // csrf中间件会在req上挂载csrfToken方法获取csrfToken
  // 挂载在res.locals上可以作用于模板
  res.locals.csrf = req.csrfToken ? req.csrfToken() : '';
  next();
});

// 日志管理
log4js.configure(config.loggerConfig);
global.logger = log4js.getLogger();
global.logger.debug('debug', 'DEBUG开启');

// 静态化dist文件
app.use(express.static(path.resolve(__dirname, './dist')));

// api接口路由
app.use('/api', mountRoute(router));

// 读取根目录index文件并渲染
app.get('*', (req, res) => { res.render('index'); });

// 错误处理/拦截跨域CSRF攻击
app.use((err, req, res, next) => {
  if (!config.isCsrf) {
    next();
    return;
  }
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(400);
    res.send('invalid csrf token');
    return;
  }
  // 处理全局错误
  global.logger.debug(err.type || 'SYSTEM', `ERROR_MESSAGE: ${err}`);
  res.status(500);
  res.send(`系统错误，我们会尽快修复${err}`);
});

// 启动 Web 服务
app.listen(config.sitePort, () => {
  console.warn(`listening on port ${config.sitePort} in mode`);
});
