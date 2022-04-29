import {spawn} from 'child_process';

async function main() {
  try {
    await runGradlew();
  } catch (err) {
    console.log('An error occurred\n');
    console.error(err.message + '\n');
    console.log(err.stack);
  }
}

const runGradlew = () =>
  new Promise<any>((res, rej) => {
    const args = process.argv;
    args.splice(0, 2);
    const gFile = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    const gradlewSpawn = spawn(gFile, args, {
      cwd: './android',
      stdio: [process.stdin, process.stdout, process.stderr],
    });

    gradlewSpawn.on('error', rej);
    gradlewSpawn.on('close', res);
  });
main();
