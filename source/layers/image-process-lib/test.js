const CHILD = require('child_process');
const FS = require('fs');

(async () => {
  const file = process.argv[2];

  let response = await new Promise((resolve, reject) => {
    const readstream = FS.createReadStream(file);

    const options = {
      cwd: undefined,
      env: {
        ...process.env,
        PERL5LIB: [
          '/opt/lib',
          '/opt/lib/site_perl',
        ].join(':'),
      },
      stdio: [
        'pipe',
        undefined,
        undefined,
      ],
    };

    const cmdlineOpts = [
      '-w',
      '/opt/bin/exiftool',
      '-json',
      '-coordFormat',
      '%d %d %.8f',
      '-',
    ];

    const chunks = [];
    const spawned = CHILD.spawn(
      '/opt/bin/perl',
      cmdlineOpts,
      options
    );

    spawned.on('error', (e) => {
      console.error(
        '[ERR]:',
        'spawn.error:',
        e
      );
      reject(e);
    });

    spawned.on('exit', (code) => {
      console.log(
        '== spawned.exit =='
      );
      if (code !== 0) {
        console.error(
          '[ERR]:',
          'spawn.exit:',
          'code:',
          code
        );
        reject(new Error('exiftool returns non-zero'));
      }

      resolve(Buffer.concat(chunks));
    });

    spawned.stdout.on('data', (chunk) => {
      console.log(
        'spawned.stdout.data:',
        'received:',
        chunk.byteLength
      );
      chunks.push(chunk);
    });

    console.log(
      '== readstream.pipe to stdio =='
    );
    readstream.pipe(spawned.stdio[0]);
  });

  response = JSON.parse(response.toString());

  console.log(
    'response',
    JSON.stringify(response, null, 2)
  );
})();
