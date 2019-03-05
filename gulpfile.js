const gulp = require('gulp');
const util = require('gulp-util');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const ts = require('gulp-typescript');
const { exec } = require('child_process');

// process.stdout.setEncoding('utf8')
let compiling = false;
let recompile = false;
let runtime = null;
let redis = null;

const stopRuntime = () => {
  util.log('--- Stopping Test Server ---\n'.yellow)
  if (runtime) {
    runtime.kill();
    runtime = null;
  } else {
    throw new Error('Tried to kill non existent child proces'.red);
  }
}

const murderRedis = () => new Promise(resolve => {
  const serialKiller = exec('docker container rm -f redis-authorizer');
  serialKiller.stdout.on('data', (chunk) => process.stdout.write(chunk))
  serialKiller.stderr.on('data', (chunk) => process.stderr.write(chunk))
  serialKiller.on('close', (code) => {
    if (code > 0) {
      util.log('FAILED TO KILL REDIS CONTAINER'.red);
      process.exit(code);
    }
    resolve();
  })
})

let retry = 0;

const startRedis = async () => {
  console.log('--- Starting Redis Container ---\n'.green)
  const redis = exec(path.resolve(__dirname, 'dev', 'redis'));
  redis.stdout.on('data', (chunk) => process.stdout.write(chunk.yellow))
  redis.stderr.on('data', (chunk) => process.stderr.write(chunk.red))
  return redis.on('close', (code => {
    if (code > 0) {
      if (code === 125 && retry < 10) {
        retry++;
        murderRedis()
          .then(() => startRedis);
        return;
      }
      return util.log(`--- Redis exited with code ${code} :'( ---\n\n`.red);
      process.exit(code);
    }
    return util.log('--- Redis exited cleanly! ---'.green);
  }))
}

const startApp = () => new Promise(resolve => {
  util.log('--- Starting Test Server ---\n'.green)
  runtime = exec(`node ${path.join(__dirname, 'testServer')}`)
  runtime.stdout.on('data', (chunk) => process.stdout.write(chunk.blue))
  runtime.stderr.on('data', (chunk) => process.stderr.write(chunk.red))
  runtime.on('close', (code => {
    if (code > 0) return util.log(`--- Test Server exited with code ${code} :'( ---\n\n`.red);
    return util.log('--- Test Server exited cleanly! ---'.green);
  }));
  resolve();
})

const rm = (path) => new Promise(resolve => {
  fs.unlink(path, (err) => {
    if (err) throw err;
    resolve();
  })
})

const rmrf = async (p) => {
  const items = fs.readdirSync(p);
  const len = items.length;
  let files = [];
  let directories = []

  for (let i = 0; i < len; i += 1) {
    const item = items[i];
    const itemPath = path.join(p, item);
    if (fs.statSync(itemPath).isDirectory())
      await rmrf(itemPath) 
    else
      rm(itemPath)
  }

  return new Promise(resolve => {
    fs.rmdir(p, (err) => {
      if (err) throw err;
      resolve();
    })
  });
}

const compileTo = (dest) => {
  const proj = ts.createProject(path.join(__dirname, 'tsconfig.lax.json'));
  return proj.src().pipe(proj()).js.pipe(gulp.dest(dest))
}

gulp.task('startApp', startApp)

gulp.task('stopApp', async () => {
  if (runtime) return stopRuntime();
  return
})

gulp.task('dev', () => {
  util.log('--- server development mode ---\n'.green);
  if (!redis) startRedis();

  return gulp.watch(
    'src/**/*',
    { ignoreInitial: false },
    gulp.series('stopApp', 'cleanTmp', 'compileTmp', 'startApp'),
  )
})

gulp.task('compileTmp', () => {
  const dest = path.join(__dirname, 'testServer', '_authorizer');
  return compileTo(dest);
})

gulp.task('cleanTmp', () => rmrf(path.join(__dirname, 'testServer', '_authorizer')))

gulp.task('mocha', () => new Promise(resolve => { 
  const mocha = path.resolve(
    __dirname, 
    'node_modules', 
    'mocha', 
    'bin', 
    'mocha'
  )

  const proc = exec(`node ${mocha} tmp/**/*.test.js`);
  let output = [];
  proc.stdout.on('data', (chunk) => process.stdout.write(chunk.toString().blue))
  proc.stderr.on('data', (chunk) => process.stderr.write(chunk.toString().red))
  proc.on('close', () => resolve());
}))

gulp.task(
  'test', 
  gulp.series('compileTmp', 'mocha', 'cleanTmp'))